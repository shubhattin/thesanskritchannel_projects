import { Effect } from 'effect';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { image_system_prompt_templates } from '~/db/schema';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { dbRun } from '~/effect/database';
import { ConflictError, DatabaseError, NotFoundError } from '~/effect/errors';

const template_title_schema = z.string().trim().min(1).max(200);

/** True for postgres unique-violations (title race between lookup and write). */
const isUniqueViolationCause = (cause: unknown): boolean => {
  if (cause === null || cause === undefined || typeof cause !== 'object') return false;
  if ('code' in cause && cause.code === '23505') return true;
  return (
    'message' in cause &&
    typeof cause.message === 'string' &&
    /unique|duplicate key/i.test(cause.message)
  );
};

const list_templates_route = protectedAdminProcedure.query(() =>
  runTrpcEffect(
    Effect.gen(function* () {
      return yield* dbRun('image_system_prompts.list', (db) =>
        db
          .select({
            id: image_system_prompt_templates.id,
            title: image_system_prompt_templates.title,
            content: image_system_prompt_templates.content,
            created_at: image_system_prompt_templates.created_at,
            updated_at: image_system_prompt_templates.updated_at
          })
          .from(image_system_prompt_templates)
          .orderBy(asc(image_system_prompt_templates.id))
      );
    })
  )
);

const get_template_route = protectedAdminProcedure
  .input(z.object({ id: z.int() }))
  .query(({ input: { id } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const row = yield* dbRun('image_system_prompts.get', (db) =>
          db.query.image_system_prompt_templates.findFirst({
            where: (tbl, { eq: eqOp }) => eqOp(tbl.id, id)
          })
        );
        if (!row) {
          return yield* Effect.fail(
            NotFoundError.make({
              resource: 'system_prompt_template',
              message: 'Template not found'
            })
          );
        }
        return row;
      })
    )
  );

const create_template_route = protectedAdminProcedure
  .input(z.object({ title: template_title_schema }))
  .mutation(({ input: { title } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const existing = yield* dbRun('image_system_prompts.create.lookup', (db) =>
          db.query.image_system_prompt_templates.findFirst({
            where: (tbl, { eq: eqOp }) => eqOp(tbl.title, title)
          })
        );
        if (existing) {
          return yield* Effect.fail(
            ConflictError.make({ message: 'A template with this title already exists' })
          );
        }
        const rows = yield* dbRun('image_system_prompts.create', (db) =>
          db.insert(image_system_prompt_templates).values({ title, content: '' }).returning()
        ).pipe(
          Effect.catchIf(
            // SAFETY: predicate only matches postgres unique-violations; all other
            // errors pass through untouched via the default orElse rethrow.
            (err): err is DatabaseError =>
              err instanceof DatabaseError && isUniqueViolationCause(err.cause),
            () =>
              Effect.fail(
                ConflictError.make({ message: 'A template with this title already exists' })
              )
          )
        );
        const created = rows[0];
        if (!created) {
          return yield* Effect.fail(
            ConflictError.make({ message: 'A template with this title already exists' })
          );
        }
        return created;
      })
    )
  );

const update_template_route = protectedAdminProcedure
  .input(
    z.object({
      id: z.int(),
      title: template_title_schema.optional(),
      content: z.string().max(20000).optional()
    })
  )
  .mutation(({ input: { id, title, content } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const existing = yield* dbRun('image_system_prompts.update.lookup', (db) =>
          db.query.image_system_prompt_templates.findFirst({
            where: (tbl, { eq: eqOp }) => eqOp(tbl.id, id)
          })
        );
        if (!existing) {
          return yield* Effect.fail(
            NotFoundError.make({
              resource: 'system_prompt_template',
              message: 'Template not found'
            })
          );
        }
        if (title !== undefined && title !== existing.title) {
          const clash = yield* dbRun('image_system_prompts.update.clash', (db) =>
            db.query.image_system_prompt_templates.findFirst({
              where: (tbl, { eq: eqOp }) => eqOp(tbl.title, title)
            })
          );
          if (clash) {
            return yield* Effect.fail(
              ConflictError.make({ message: 'A template with this title already exists' })
            );
          }
        }
        const rows = yield* dbRun('image_system_prompts.update', (db) =>
          db
            .update(image_system_prompt_templates)
            .set({ title: title ?? existing.title, content: content ?? existing.content })
            .where(eq(image_system_prompt_templates.id, id))
            .returning()
        ).pipe(
          Effect.catchIf(
            // SAFETY: predicate only matches postgres unique-violations; all other
            // errors pass through untouched via the default orElse rethrow.
            (err): err is DatabaseError =>
              err instanceof DatabaseError && isUniqueViolationCause(err.cause),
            () =>
              Effect.fail(
                ConflictError.make({ message: 'A template with this title already exists' })
              )
          )
        );
        const updated = rows[0];
        if (!updated) {
          return yield* Effect.fail(
            NotFoundError.make({
              resource: 'system_prompt_template',
              message: 'Template not found'
            })
          );
        }
        return updated;
      })
    )
  );

const delete_template_route = protectedAdminProcedure
  .input(z.object({ id: z.int() }))
  .mutation(({ input: { id } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const existing = yield* dbRun('image_system_prompts.delete.lookup', (db) =>
          db.query.image_system_prompt_templates.findFirst({
            where: (tbl, { eq: eqOp }) => eqOp(tbl.id, id)
          })
        );
        if (!existing) {
          return yield* Effect.fail(
            NotFoundError.make({
              resource: 'system_prompt_template',
              message: 'Template not found'
            })
          );
        }
        yield* dbRun('image_system_prompts.delete', async (db) => {
          await db
            .delete(image_system_prompt_templates)
            .where(eq(image_system_prompt_templates.id, id));
        });
        return { success: true };
      })
    )
  );

export const image_system_prompts_router = t.router({
  list: list_templates_route,
  get: get_template_route,
  create: create_template_route,
  update: update_template_route,
  delete: delete_template_route
});
