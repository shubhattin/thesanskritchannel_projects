import { Effect } from 'effect';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { agent_model_id_schema } from '~/agents/models';
import { loadInstructionSections } from '~/agents/server/create_agent';
import {
  createAgentChat,
  deleteAgentChat,
  findAgentChat,
  listAgentChats,
  loadAgentMessages,
  renameAgentChat,
  requestChatStop
} from '~/agents/server/chat_store';

const chat_id_schema = z.string().min(1).max(64);

const list_chats_route = protectedAdminProcedure.query(({ ctx }) =>
  runTrpcEffect(listAgentChats(ctx.user.id))
);

const get_chat_route = protectedAdminProcedure
  .input(z.object({ id: chat_id_schema }))
  .query(({ input, ctx }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const chat = yield* findAgentChat(input.id, ctx.user.id);
        const messages = yield* loadAgentMessages(input.id);
        return { chat, messages };
      })
    )
  );

const create_chat_route = protectedAdminProcedure
  .input(z.object({ id: chat_id_schema, model: agent_model_id_schema }))
  .mutation(({ input, ctx }) => runTrpcEffect(createAgentChat({ ...input, user_id: ctx.user.id })));

const rename_chat_route = protectedAdminProcedure
  .input(z.object({ id: chat_id_schema, title: z.string().trim().min(1).max(120) }))
  .mutation(({ input, ctx }) => runTrpcEffect(renameAgentChat({ ...input, user_id: ctx.user.id })));

const delete_chat_route = protectedAdminProcedure
  .input(z.object({ id: chat_id_schema }))
  .mutation(({ input, ctx }) => runTrpcEffect(deleteAgentChat(input.id, ctx.user.id)));

/** Stop the chat's reply for real: it otherwise keeps generating server-side once the tab lets go. */
const stop_reply_route = protectedAdminProcedure
  .input(z.object({ id: chat_id_schema }))
  .mutation(({ input, ctx }) => runTrpcEffect(requestChatStop(input.id, ctx.user.id)));

/** Everything the agent reads before the conversation, for the Context dialog. */
const get_context_route = protectedAdminProcedure.query(() =>
  runTrpcEffect(loadInstructionSections())
);

export const agents_router = t.router({
  list_chats: list_chats_route,
  get_chat: get_chat_route,
  create_chat: create_chat_route,
  rename_chat: rename_chat_route,
  delete_chat: delete_chat_route,
  stop_reply: stop_reply_route,
  get_context: get_context_route
});
