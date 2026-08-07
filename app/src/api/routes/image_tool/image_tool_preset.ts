import { Effect } from 'effect';
import { asc, eq, like } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, protectedProcedure, t } from '~/api/trpc_init';
import {
  from_db_key,
  image_tool_preset_config_schema,
  is_image_tool_preset_db_key,
  is_reserved_image_tool_preset_name,
  to_db_key,
  type ImageToolPresetListItem
} from '~/components/pages/main_app/image_tool/image_tool_preset_schema';
import { other } from '~/db/schema';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { dbRun } from '~/effect/database';
import { ConflictError, NotFoundError } from '~/effect/errors';

const preset_name_schema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((name) => !is_reserved_image_tool_preset_name(name), {
    message: 'Preset name is reserved'
  });

const list_presets_route = protectedProcedure.query(() =>
  runTrpcEffect(
    Effect.gen(function* () {
      const rows = yield* dbRun('image_tool_preset.list', (db) =>
        db
          .select()
          .from(other)
          .where(like(other.key, `${to_db_key('')}%`))
          .orderBy(asc(other.key))
      );

      const presets: ImageToolPresetListItem[] = [];
      for (const row of rows) {
        if (!is_image_tool_preset_db_key(row.key)) continue;
        const parsed = image_tool_preset_config_schema.safeParse(row.value);
        if (!parsed.success) continue;
        presets.push({
          name: from_db_key(row.key),
          config: parsed.data
        });
      }
      return presets;
    })
  )
);

const upsert_preset_route = protectedAdminProcedure
  .input(
    z.object({
      name: preset_name_schema,
      config: z.unknown(),
      update: z.boolean()
    })
  )
  .mutation(({ input: { name, config, update } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const parsed_config = image_tool_preset_config_schema.parse(config);
        const key = to_db_key(name);

        const existing = yield* dbRun('image_tool_preset.upsert.lookup', (db) =>
          db.query.other.findFirst({
            where: (tbl, { eq: eqOp }) => eqOp(tbl.key, key)
          })
        );

        if (!update) {
          if (existing) {
            return yield* Effect.fail(
              ConflictError.make({ message: 'A preset with this name already exists' })
            );
          }
          yield* dbRun('image_tool_preset.insert', async (db) => {
            await db.insert(other).values({ key, value: parsed_config });
          });
          return { name, config: parsed_config };
        }

        if (!existing) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'preset', message: 'Preset not found' })
          );
        }

        yield* dbRun('image_tool_preset.update', async (db) => {
          await db.update(other).set({ value: parsed_config }).where(eq(other.key, key));
        });
        return { name, config: parsed_config };
      })
    )
  );

const delete_preset_route = protectedAdminProcedure
  .input(z.object({ name: preset_name_schema }))
  .mutation(({ input: { name } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const key = to_db_key(name);
        const existing = yield* dbRun('image_tool_preset.delete.lookup', (db) =>
          db.query.other.findFirst({
            where: (tbl, { eq: eqOp }) => eqOp(tbl.key, key)
          })
        );

        if (!existing) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'preset', message: 'Preset not found' })
          );
        }

        yield* dbRun('image_tool_preset.delete', async (db) => {
          await db.delete(other).where(eq(other.key, key));
        });
        return { success: true };
      })
    )
  );

export const image_tool_preset_router = t.router({
  list_presets: list_presets_route,
  upsert_preset: upsert_preset_route,
  delete_preset: delete_preset_route
});
