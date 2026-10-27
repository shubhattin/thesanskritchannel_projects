import { Effect } from 'effect';
import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { agent_chats, agent_messages } from '~/db/schema';
import { dbRunHttp, dbTransaction } from '~/effect/database';
import { NotFoundError } from '~/effect/errors';
import type { AgentModelId } from '~/agents/models';
import type { AgentUIMessage } from '~/agents/ui_message';

/** Chats are private to the admin who started them. */
const ownedChat = (id: string, user_id: string) =>
  and(eq(agent_chats.id, id), eq(agent_chats.user_id, user_id));

export const createAgentChat = Effect.fn('agents.create_chat')(function* (input: {
  id: string;
  model: AgentModelId;
  user_id: string;
}) {
  const [chat] = yield* dbRunHttp('agents.insert_chat', (client) =>
    client.insert(agent_chats).values(input).returning()
  );
  return chat!;
});

export const listAgentChats = Effect.fn('agents.list_chats')(function* (user_id: string) {
  return yield* dbRunHttp('agents.list_chats', (client) =>
    client
      .select({
        id: agent_chats.id,
        title: agent_chats.title,
        updated_at: agent_chats.updated_at,
        streaming: agent_chats.streaming
      })
      .from(agent_chats)
      .where(eq(agent_chats.user_id, user_id))
      .orderBy(desc(agent_chats.updated_at))
      .limit(300)
  );
});

export const findAgentChat = Effect.fn('agents.find_chat')(function* (id: string, user_id: string) {
  const [chat] = yield* dbRunHttp('agents.find_chat', (client) =>
    client.select().from(agent_chats).where(ownedChat(id, user_id)).limit(1)
  );
  if (!chat) {
    return yield* Effect.fail(
      NotFoundError.make({ resource: 'agent_chat', message: 'Chat not found' })
    );
  }
  return chat;
});

export const loadAgentMessages = Effect.fn('agents.load_messages')(function* (chatId: string) {
  const rows = yield* dbRunHttp('agents.load_messages', (client) =>
    client
      .select({
        id: agent_messages.id,
        role: agent_messages.role,
        parts: agent_messages.parts,
        metadata: agent_messages.metadata
      })
      .from(agent_messages)
      .where(eq(agent_messages.chat_id, chatId))
      .orderBy(asc(agent_messages.position))
  );
  return rows.map((row): AgentUIMessage => ({
    id: row.id,
    role: row.role,
    parts: row.parts,
    metadata: row.metadata ?? undefined
  }));
});

/**
 * Make the stored conversation equal `messages`: upsert each, and drop rows a retry replaced
 * (a regenerated reply gets a new id).
 */
export const saveAgentMessages = Effect.fn('agents.save_messages')(function* (input: {
  chatId: string;
  messages: AgentUIMessage[];
  model: AgentModelId;
  title?: string;
}) {
  yield* dbTransaction('agents.save_messages', async (tx) => {
    // Message ids come from the client: ignore any that belong to another chat instead of
    // overwriting that chat's rows via the id-keyed upsert below.
    const incomingIds = input.messages.map((message) => message.id);
    const owned =
      incomingIds.length > 0
        ? await tx
            .select({ id: agent_messages.id, chat_id: agent_messages.chat_id })
            .from(agent_messages)
            .where(inArray(agent_messages.id, incomingIds))
        : [];
    const foreignIds = new Set(
      owned.filter((row) => row.chat_id !== input.chatId).map((row) => row.id)
    );
    const messages = input.messages.filter((message) => !foreignIds.has(message.id));
    if (messages.length > 0) {
      await tx
        .insert(agent_messages)
        .values(
          messages.map((message, position) => ({
            id: message.id,
            chat_id: input.chatId,
            role: message.role,
            parts: message.parts,
            metadata: message.metadata ?? null,
            position
          }))
        )
        .onConflictDoUpdate({
          target: agent_messages.id,
          set: {
            parts: sql`excluded.parts`,
            metadata: sql`excluded.metadata`,
            position: sql`excluded.position`
          }
        });
      await tx.delete(agent_messages).where(
        and(
          eq(agent_messages.chat_id, input.chatId),
          notInArray(
            agent_messages.id,
            messages.map((message) => message.id)
          )
        )
      );
    }
    await tx
      .update(agent_chats)
      .set({
        model: input.model,
        updated_at: new Date(),
        title: input.title || undefined
      })
      .where(eq(agent_chats.id, input.chatId));
  });
});

export const renameAgentChat = Effect.fn('agents.rename_chat')(function* (input: {
  id: string;
  user_id: string;
  title: string;
}) {
  yield* dbRunHttp('agents.rename_chat', (client) =>
    client
      .update(agent_chats)
      .set({ title: input.title })
      .where(ownedChat(input.id, input.user_id))
      .returning()
  );
});

/**
 * Mark a chat as (not) streaming — set when a reply starts, cleared when it lands or fails.
 * A new reply also clears any stop request left from the last one.
 */
export const setChatStreaming = Effect.fn('agents.set_streaming')(function* (
  id: string,
  streaming: boolean
) {
  yield* dbRunHttp('agents.set_streaming', (client) =>
    client
      .update(agent_chats)
      .set(streaming ? { streaming, stop_requested_at: null } : { streaming })
      .where(eq(agent_chats.id, id))
      .returning()
  );
});

/** Ask the reply streaming for this chat to stop (it may run on another server instance). */
export const requestChatStop = Effect.fn('agents.request_stop')(function* (
  id: string,
  user_id: string
) {
  yield* dbRunHttp('agents.request_stop', (client) =>
    client
      .update(agent_chats)
      .set({ stop_requested_at: sql`now()` })
      .where(and(ownedChat(id, user_id), eq(agent_chats.streaming, true)))
      .returning()
  );
});

export const isChatStopRequested = Effect.fn('agents.is_stop_requested')(function* (id: string) {
  const [chat] = yield* dbRunHttp('agents.is_stop_requested', (client) =>
    client
      .select({ stop_requested_at: agent_chats.stop_requested_at })
      .from(agent_chats)
      .where(eq(agent_chats.id, id))
      .limit(1)
  );
  return chat?.stop_requested_at != null;
});

export const deleteAgentChat = Effect.fn('agents.delete_chat')(function* (
  id: string,
  user_id: string
) {
  yield* dbRunHttp('agents.delete_chat', (client) =>
    client.delete(agent_chats).where(ownedChat(id, user_id)).returning()
  );
});
