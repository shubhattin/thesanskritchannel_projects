import { Effect } from 'effect';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { site_lekhas } from '~/db/schema';
import { SiteLekhaSchemaZod } from '~/db/schema_zod';
import { delay_dev } from '~/tools/delay';
import {
  CACHE,
  invalidate_and_refresh_cached,
  NO_CACHE_PARAMS
} from '~/utils/cache.server/cached_loader.server';
import {
  lekhaUrlSlugify,
  normalizeLekhaTextFields,
  sanitizeAndFormatLekhaMarkdownForStorage
} from '~/lib/carta_markdown/markdown';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { enqueueBackground } from '~/effect/background';
import { dbRun } from '~/effect/database';
import { BadRequestError, NotFoundError } from '~/effect/errors';

const lekha_post_input = SiteLekhaSchemaZod.omit({
  id: true,
  created_at: true,
  published_at: true,
  updated_at: true
});

async function normalizeLekhaPostForStorage(post_data: z.infer<typeof lekha_post_input>) {
  const trimmed = normalizeLekhaTextFields(post_data);
  const content = await sanitizeAndFormatLekhaMarkdownForStorage(trimmed.content);

  return {
    tags: trimmed.tags,
    title: trimmed.title,
    description: trimmed.description,
    content,
    draft: post_data.draft,
    listed: post_data.listed,
    search_indexed: post_data.search_indexed,
    url_slug: trimmed.url_slug
  };
}

const normalizeLekhaPost = (post_data: z.infer<typeof lekha_post_input>) =>
  Effect.tryPromise({
    try: () => normalizeLekhaPostForStorage(post_data),
    catch: (cause) =>
      BadRequestError.make({
        message: cause instanceof Error ? cause.message : 'Invalid lekha post content'
      })
  });

const invalidate_lekha_caches = (url_slug: string) =>
  Effect.gen(function* () {
    yield* enqueueBackground(async () => {
      await Promise.all([
        runTrpcEffect(invalidate_and_refresh_cached(CACHE.site_lekha_data, { url_slug })),
        runTrpcEffect(invalidate_and_refresh_cached(CACHE.site_lekha_list, NO_CACHE_PARAMS))
      ]);
    });
  });

const add_lekha_route = protectedAdminProcedure
  .input(
    z.object({
      post_data: lekha_post_input.omit({ draft: true })
    })
  )
  .mutation(({ input: { post_data } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const normalized = yield* normalizeLekhaPost({ ...post_data, draft: true });
        const lekha = yield* dbRun('lekha.add', (db) =>
          db.insert(site_lekhas).values(normalized).returning()
        );
        const created = lekha[0];
        if (!created) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'lekha', message: 'Lekha not created' })
          );
        }
        yield* invalidate_lekha_caches(created.url_slug);
        return { id: created.id };
      })
    )
  );

const edit_lekha_route = protectedAdminProcedure
  .input(
    z.object({
      id: z.number(),
      post_data: lekha_post_input
    })
  )
  .mutation(({ input: { id, post_data } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(1000);
        });
        const existing = yield* dbRun('lekha.edit.lookup', (db) =>
          db.query.site_lekhas.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, id)
          })
        );
        if (!existing) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'lekha', message: 'Lekha not found' })
          );
        }
        const normalized = yield* normalizeLekhaPost(post_data);
        const setPublishedNow = existing.draft === true && post_data.draft === false;
        const lekha = yield* dbRun('lekha.edit.update', (db) =>
          db
            .update(site_lekhas)
            .set(setPublishedNow ? { ...normalized, published_at: new Date() } : normalized)
            .where(eq(site_lekhas.id, id))
            .returning()
        );
        const updated = lekha[0];
        if (!updated) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'lekha', message: 'Lekha not found' })
          );
        }
        yield* invalidate_lekha_caches(updated.url_slug);
        return {
          id: updated.id,
          published_at: updated.published_at,
          draft: updated.draft
        };
      })
    )
  );

const delete_lekha_route = protectedAdminProcedure
  .input(z.object({ id: z.number() }))
  .mutation(({ input: { id } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(1000);
        });
        const prev_data = yield* dbRun('lekha.delete.lookup', (db) =>
          db.query.site_lekhas.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, id),
            columns: { url_slug: true }
          })
        );
        if (!prev_data) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'lekha', message: 'Lekha not found' })
          );
        }
        yield* dbRun('lekha.delete', async (db) => {
          await db.delete(site_lekhas).where(eq(site_lekhas.id, id));
        });
        yield* invalidate_lekha_caches(prev_data.url_slug);
        return { id };
      })
    )
  );

const list_lekhas_input = z.object({
  search_text: z.string().max(500).optional(),
  draft: z.boolean().optional(),
  sort_by: z.enum(['published_at', 'updated_at']).default('published_at'),
  order_by: z.enum(['asc', 'desc']).default('desc'),
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(20)
});

const list_lekhas_route = protectedAdminProcedure.input(list_lekhas_input).query(({ input }) =>
  runTrpcEffect(
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await delay_dev(800);
      });
      const trimmedSearch = input.search_text?.trim();
      const searchCondition = trimmedSearch
        ? or(
            ilike(site_lekhas.title, `%${trimmedSearch}%`),
            ilike(site_lekhas.description, `%${trimmedSearch}%`),
            sql<boolean>`array_to_string(${site_lekhas.tags}, ' ') ILIKE ${`%${trimmedSearch}%`}`
          )
        : undefined;
      const draftCondition =
        input.draft === undefined ? undefined : eq(site_lekhas.draft, input.draft);
      const whereClause = and(searchCondition, draftCondition);
      const offset = (input.page - 1) * input.limit;
      const sortColumn =
        input.sort_by === 'updated_at' ? site_lekhas.updated_at : site_lekhas.published_at;
      const orderFn = input.order_by === 'asc' ? asc : desc;

      const [countResult, list] = yield* dbRun('lekha.list', async (db) =>
        Promise.all([
          db.select({ count: count() }).from(site_lekhas).where(whereClause),
          db
            .select({
              id: site_lekhas.id,
              title: site_lekhas.title,
              description: site_lekhas.description,
              tags: site_lekhas.tags,
              published_at: site_lekhas.published_at,
              updated_at: site_lekhas.updated_at,
              draft: site_lekhas.draft,
              listed: site_lekhas.listed,
              search_indexed: site_lekhas.search_indexed
            })
            .from(site_lekhas)
            .where(whereClause)
            .orderBy(orderFn(sortColumn), desc(site_lekhas.id))
            .limit(input.limit)
            .offset(offset)
        ])
      );

      const total = Number(countResult[0]?.count ?? 0);
      const pageCount = Math.max(1, Math.ceil(total / input.limit));

      return {
        list,
        total,
        page: input.page,
        pageCount,
        hasPrev: input.page > 1,
        hasNext: input.page < pageCount
      };
    })
  )
);

const check_url_slug_route = protectedAdminProcedure
  .input(
    z.object({
      url_slug: z.string().max(100),
      exclude_id: z.number().int().positive().optional()
    })
  )
  .query(({ input: { url_slug, exclude_id } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const normalized = lekhaUrlSlugify(url_slug);
        const lekha = yield* dbRun('lekha.check_slug', (db) =>
          db.query.site_lekhas.findFirst({
            where: (tbl, { eq, ne }) =>
              exclude_id != null
                ? and(eq(tbl.url_slug, normalized), ne(tbl.id, exclude_id))
                : eq(tbl.url_slug, normalized),
            columns: { id: true }
          })
        );
        return { exists: !!lekha };
      })
    )
  );

export const lekha_router = t.router({
  add_lekha: add_lekha_route,
  edit_lekha: edit_lekha_route,
  delete_lekha: delete_lekha_route,
  list_lekhas: list_lekhas_route,
  check_url_slug: check_url_slug_route
});
