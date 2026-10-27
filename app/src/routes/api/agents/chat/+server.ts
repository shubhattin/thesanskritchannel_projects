import { error } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { consumeStream, createIdGenerator, convertToModelMessages, validateUIMessages } from 'ai';
import { Effect } from 'effect';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { protected_admin_route_check } from '~/api/api_init';
import { agent_model_id_schema } from '~/agents/models';
import {
  findAgentChat,
  isChatStopRequested,
  loadAgentMessages,
  requestChatStop,
  saveAgentMessages,
  setChatStreaming
} from '~/agents/server/chat_store';
import { generateChatTitle } from '~/agents/server/chat_title';
import { withHistoryCacheBreakpoint } from '~/agents/server/chat_messages';
import { createAgent } from '~/agents/server/create_agent';
import { createReplyMeter } from '~/agents/server/cost';
import type { AgentUIMessage } from '~/agents/ui_message';
import { enqueueBackground } from '~/effect/background';
import { BadRequestError } from '~/effect/errors';
import { getAppRuntime, runRouteEffect, runServerEffect } from '~/effect/app_runtime.server';

/** Long agent turns (many tool calls) need more than the default function duration. */
export const config: Config = { maxDuration: 300 };

const body_schema = z.object({
  id: z.string().min(1).max(64),
  /** Only the new user message; history is loaded from the database. */
  message: z.object({ id: z.string().min(1), role: z.literal('user') }).passthrough(),
  model: agent_model_id_schema
});

const generateMessageId = createIdGenerator({ prefix: 'msg', size: 16 });

const firstText = (message: AgentUIMessage) =>
  message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join(' ')
    .trim();

/**
 * Wait until the chat's in-flight turn is saved: a stopped reply still landing, or a step that
 * ended mid-stream. Otherwise its late save would drop the turn that follows.
 */
const waitForSavedTurn = Effect.fn('agents.wait_for_saved_turn')(function* (
  chatId: string,
  userId: string
) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const chat = yield* findAgentChat(chatId, userId);
    if (!chat.streaming) return chat;
    yield* Effect.sleep('250 millis');
  }
  return yield* Effect.fail(
    BadRequestError.make({
      message: 'The previous reply is still being saved, try again in a moment'
    })
  );
});

/** The chat once any in-flight turn is saved; a new message stops that turn first. */
const chatForTurn = Effect.fn('agents.chat_for_turn')(function* (chatId: string, userId: string) {
  const chat = yield* findAgentChat(chatId, userId);
  if (!chat.streaming) return chat;
  // Send now, or Stop then send: the new message replaces whatever is still replying.
  yield* requestChatStop(chatId, userId);
  return yield* waitForSavedTurn(chatId, userId);
});

const STOP_POLL_MS = 1_000;

/**
 * Aborts the reply when an explicit Stop is recorded for the chat. The request may be served by
 * another instance than the Stop, so this polls the database rather than listening in memory.
 */
function watchForStop(chatId: string, controller: AbortController) {
  const runtime = getAppRuntime();
  const timer = setInterval(() => {
    void runtime
      .runPromise(isChatStopRequested(chatId))
      .then((stop) => {
        if (stop) controller.abort();
      })
      .catch(() => undefined);
  }, STOP_POLL_MS);
  const clear = () => clearInterval(timer);
  controller.signal.addEventListener('abort', clear, { once: true });
  return clear;
}

export const POST: RequestHandler = async ({ request, url }) => {
  // JSON + cookie auth: reject cross-site posts outright.
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) throw error(403, 'Cross-site request rejected');

  const user = await runServerEffect(protected_admin_route_check(request.headers));
  if (!user) throw error(401, 'UNAUTHORIZED');

  const parsed = body_schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const { id, model } = parsed.data;
  const runtime = getAppRuntime();

  return runRouteEffect(
    Effect.gen(function* () {
      const chat = yield* chatForTurn(id, user.id);
      const previous = yield* loadAgentMessages(id);
      const { agent, tools } = yield* createAgent(model);

      // A retry resends a message that may already be stored: replay history up to it.
      const resent = previous.findIndex((message) => message.id === parsed.data.message.id);
      const history = resent === -1 ? previous : previous.slice(0, resent);

      const messages = yield* Effect.tryPromise({
        try: () =>
          validateUIMessages<AgentUIMessage>({
            messages: [...history, parsed.data.message],
            tools
          }),
        catch: () => BadRequestError.make({ message: 'Invalid message' })
      });

      // Title the chat in parallel with the first reply.
      const newMessage = messages.at(-1)!;
      const titlePromise =
        !chat.title && history.length === 0
          ? runtime.runPromise(generateChatTitle(firstText(newMessage)))
          : null;

      const meter = createReplyMeter(model, undefined);

      yield* setChatStreaming(id, true);
      const stop = new AbortController();
      const stopWatching = watchForStop(id, stop);
      const result = yield* Effect.promise(async () =>
        agent.stream({
          prompt: withHistoryCacheBreakpoint(await convertToModelMessages(messages, { tools })),
          abortSignal: stop.signal
        })
      ).pipe(
        Effect.onError(() => {
          stopWatching();
          return Effect.ignore(setChatStreaming(id, false));
        })
      );

      return result.toUIMessageStreamResponse<AgentUIMessage>({
        originalMessages: messages,
        generateMessageId,
        // Keep generating (and saving) even if the admin closes the tab mid-reply.
        consumeSseStream: ({ stream }) =>
          runtime.runSync(enqueueBackground(() => consumeStream({ stream }))),
        // Actual cost and tokens, emitted after every step.
        messageMetadata: ({ part }) => meter(part),
        onEnd: async ({ messages: finished }) => {
          try {
            const title = titlePromise ? await titlePromise : undefined;
            await runtime.runPromise(
              saveAgentMessages({ chatId: id, messages: finished, model, title })
            );
          } finally {
            stopWatching();
            await runtime.runPromise(setChatStreaming(id, false));
          }
        },
        onError: (cause) => {
          stopWatching();
          void runtime.runPromise(setChatStreaming(id, false));
          return cause instanceof Error ? cause.message : 'The agent failed to reply.';
        }
      });
    }),
    { onSuccess: (response) => response }
  );
};
