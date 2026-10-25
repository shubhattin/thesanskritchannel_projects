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
  loadAgentMessages,
  saveAgentMessages,
  setChatStreaming
} from '~/agents/server/chat_store';
import { generateChatTitle } from '~/agents/server/chat_title';
import { createAgent } from '~/agents/server/create_agent';
import type { AgentMessageMetadata, AgentUIMessage } from '~/agents/ui_message';
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
      const chat = yield* findAgentChat(id, user.id);
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

      yield* setChatStreaming(id, true);
      const result = yield* Effect.promise(async () =>
        agent.stream({ prompt: await convertToModelMessages(messages, { tools }) })
      ).pipe(Effect.onError(() => Effect.ignore(setChatStreaming(id, false))));

      return result.toUIMessageStreamResponse<AgentUIMessage>({
        originalMessages: messages,
        generateMessageId,
        // Keep generating (and saving) even if the admin closes the tab mid-reply.
        consumeSseStream: ({ stream }) =>
          runtime.runSync(enqueueBackground(() => consumeStream({ stream }))),
        messageMetadata: ({ part }): AgentMessageMetadata | undefined => {
          if (part.type === 'start') return { model };
          if (part.type === 'finish') {
            return {
              model,
              usage: {
                inputTokens: part.totalUsage.inputTokens,
                outputTokens: part.totalUsage.outputTokens,
                cachedInputTokens: part.totalUsage.inputTokenDetails?.cacheReadTokens,
                reasoningTokens: part.totalUsage.outputTokenDetails?.reasoningTokens
              }
            };
          }
          return undefined;
        },
        onEnd: async ({ messages: finished }) => {
          try {
            const title = titlePromise ? await titlePromise : undefined;
            await runtime.runPromise(
              saveAgentMessages({ chatId: id, messages: finished, model, title })
            );
          } finally {
            await runtime.runPromise(setChatStreaming(id, false));
          }
        },
        onError: (cause) => {
          void runtime.runPromise(setChatStreaming(id, false));
          return cause instanceof Error ? cause.message : 'The agent failed to reply.';
        }
      });
    }),
    { onSuccess: (response) => response }
  );
};
