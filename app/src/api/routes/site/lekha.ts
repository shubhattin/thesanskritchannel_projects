import { Effect } from 'effect';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { site_lekha_redirects, site_lekhas } from '~/db/schema';
import { SiteLekhaSchemaZod } from '~/db/schema_zod';
import { delay_dev } from '~/tools/delay';
import {
  CACHE,
  invalidate_and_refresh_cached,
  NO_CACHE_PARAMS,
  refreshSiteLekhaSlugMap
} from '~/utils/cache.server/cached_loader.server';
import {
  lekhaUrlSlugify,
  normalizeLekhaTextFields,
  sanitizeAndFormatLekhaMarkdownForStorage
} from '~/lib/carta_markdown/markdown';
import { runServerEffect, runTrpcEffect } from '~/effect/app_runtime.server';
import { enqueueBackground } from '~/effect/background';
import { dbRunHttp, dbTransaction } from '~/effect/database';
import { BadRequestError, ConflictError, NotFoundError } from '~/effect/errors';
import { generateUniqueUid } from '~/db/uid';

const lekha_post_input = SiteLekhaSchemaZod.omit({
  id: true,
  created_at: true,
  published_at: true,
  updated_at: true,
  // Server-assigned universally unique nano-id (see `~/db/uid`); never client-provided.
  uid: true
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
    url_slug: trimmed.url_slug,
    auto_transliterate_title: post_data.auto_transliterate_title,
    auto_transliterate_description: post_data.auto_transliterate_description,
    auto_transliterate_content: post_data.auto_transliterate_content
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

const invalidate_lekha_caches = (url_slugs: string | readonly (string | null | undefined)[]) =>
  enqueueBackground(() =>
    runServerEffect(
      Effect.all(
        [
          ...Array.from(new Set(Array.isArray(url_slugs) ? url_slugs : [url_slugs])).flatMap(
            (url_slug) =>
              url_slug ? [invalidate_and_refresh_cached(CACHE.site_lekha_data, { url_slug })] : []
          ),
          invalidate_and_refresh_cached(CACHE.site_lekha_list, NO_CACHE_PARAMS)
        ],
        { concurrency: 'unbounded' }
      )
    )
  );

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
        const created = yield* dbTransaction('lekha.add.tx', async (tx) => {
          // A new lekha claiming a former redirect slug replaces that rule.
          await tx
            .delete(site_lekha_redirects)
            .where(eq(site_lekha_redirects.url_slug, normalized.url_slug));
          const uid = await generateUniqueUid(tx);
          const rows = await tx
            .insert(site_lekhas)
            .values({ ...normalized, uid })
            .returning();
          return rows[0];
        });
        if (!created) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'lekha', message: 'Lekha not created' })
          );
        }
        yield* invalidate_lekha_caches(created.url_slug);
        yield* refreshSiteLekhaSlugMap();
        return { id: created.id };
      })
    )
  );

const edit_lekha_route = protectedAdminProcedure
  .input(
    z.object({
      id: z.number(),
      post_data: lekha_post_input,
      /** When the url_slug changes, keep the previous slug as a redirect to this lekha. Default true. */
      redirect_old_url: z.boolean().default(true)
    })
  )
  .mutation(({ input: { id, post_data, redirect_old_url } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(1000);
        });
        const normalized = yield* normalizeLekhaPost(post_data);
        if (!normalized.url_slug) {
          return yield* Effect.fail(
            BadRequestError.make({
              message: 'URL slug must contain at least one alphanumeric character'
            })
          );
        }
        const outcome = yield* dbTransaction('lekha.edit.tx', async (tx) => {
          const existing = await tx.query.site_lekhas.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, id)
          });
          if (!existing) return { ok: false as const, reason: 'not_found' as const };

          const setPublishedNow = existing.draft === true && post_data.draft === false;
          const values = setPublishedNow ? { ...normalized, published_at: new Date() } : normalized;

          if (normalized.url_slug === existing.url_slug) {
            const rows = await tx
              .update(site_lekhas)
              .set(values)
              .where(eq(site_lekhas.id, id))
              .returning();
            const updated = rows[0];
            if (!updated) return { ok: false as const, reason: 'not_found' as const };
            return { ok: true as const, updated, previous_slug: null };
          }

          const conflict = await tx.query.site_lekhas.findFirst({
            where: (tbl, { eq: eqSlug }) => eqSlug(tbl.url_slug, normalized.url_slug),
            columns: { id: true }
          });
          if (conflict) {
            return { ok: false as const, reason: 'conflict' as const };
          }

          // Claiming a slug that currently redirects somewhere else replaces that rule.
          await tx
            .delete(site_lekha_redirects)
            .where(eq(site_lekha_redirects.url_slug, normalized.url_slug));

          const rows = await tx
            .update(site_lekhas)
            .set(values)
            .where(eq(site_lekhas.id, id))
            .returning();
          const updated = rows[0];
          if (!updated) return { ok: false as const, reason: 'not_found' as const };

          if (redirect_old_url) {
            await tx
              .insert(site_lekha_redirects)
              .values({ lekha_id: id, url_slug: existing.url_slug })
              .onConflictDoUpdate({
                target: site_lekha_redirects.url_slug,
                set: { lekha_id: id }
              });
          }

          return { ok: true as const, updated, previous_slug: existing.url_slug };
        });

        if (!outcome.ok) {
          if (outcome.reason === 'conflict') {
            return yield* Effect.fail(
              ConflictError.make({ message: 'This URL slug is already in use.' })
            );
          }
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'lekha', message: 'Lekha not found' })
          );
        }
        yield* invalidate_lekha_caches([outcome.updated.url_slug, outcome.previous_slug]);
        yield* refreshSiteLekhaSlugMap();
        return {
          id: outcome.updated.id,
          published_at: outcome.updated.published_at,
          draft: outcome.updated.draft
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
        const prev_data = yield* dbRunHttp('lekha.delete.lookup', (db) =>
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
        yield* dbRunHttp('lekha.delete', async (db) => {
          await db.delete(site_lekhas).where(eq(site_lekhas.id, id));
        });
        yield* invalidate_lekha_caches(prev_data.url_slug);
        yield* refreshSiteLekhaSlugMap();
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
  limit: z.int().min(1).max(100).default(15)
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

      const [countResult, list] = yield* dbRunHttp('lekha.list', async (db) =>
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
              url_slug: site_lekhas.url_slug
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
        const lekha = yield* dbRunHttp('lekha.check_slug', (db) =>
          db.query.site_lekhas.findFirst({
            where: (tbl, { eq, ne }) =>
              exclude_id != null
                ? and(eq(tbl.url_slug, normalized), ne(tbl.id, exclude_id))
                : eq(tbl.url_slug, normalized),
            columns: { id: true }
          })
        );
        const redirect = yield* dbRunHttp('lekha.check_slug.redirect', (db) =>
          db.query.site_lekha_redirects.findFirst({
            where: (tbl, { eq: eqSlug }) => eqSlug(tbl.url_slug, normalized),
            columns: { id: true }
          })
        );
        return { exists: !!lekha, replaces_redirect: !!redirect };
      })
    )
  );

const list_lekha_redirects_route = protectedAdminProcedure
  .input(z.object({ lekha_id: z.number().int().positive() }))
  .query(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(200);
        });
        const existing = yield* dbRunHttp('lekha.redirects.lookup', (db) =>
          db.query.site_lekhas.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, input.lekha_id),
            columns: { id: true }
          })
        );
        if (!existing) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'lekha', message: 'Lekha not found' })
          );
        }
        return yield* dbRunHttp('lekha.redirects.list', (db) =>
          db.query.site_lekha_redirects.findMany({
            where: (tbl, { eq: eqId }) => eqId(tbl.lekha_id, input.lekha_id),
            columns: { id: true, url_slug: true, created_at: true },
            orderBy: (tbl, { desc }) => [desc(tbl.created_at)]
          })
        );
      })
    )
  );

const delete_lekha_redirect_route = protectedAdminProcedure
  .input(
    z.object({
      lekha_id: z.number().int().positive(),
      redirect_id: z.number().int().positive()
    })
  )
  .mutation(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(300);
        });
        const outcome = yield* dbRunHttp('lekha.redirects.delete', async (db) => {
          const existing = await db.query.site_lekhas.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, input.lekha_id),
            columns: { id: true }
          });
          if (!existing) return { ok: false as const, reason: 'not_found' as const };
          const deleted = await db
            .delete(site_lekha_redirects)
            .where(
              and(
                eq(site_lekha_redirects.id, input.redirect_id),
                eq(site_lekha_redirects.lekha_id, input.lekha_id)
              )
            )
            .returning();
          if (deleted.length === 0) {
            return { ok: false as const, reason: 'redirect_not_found' as const };
          }
          return { ok: true as const };
        });
        if (!outcome.ok) {
          if (outcome.reason === 'redirect_not_found') {
            return yield* Effect.fail(
              NotFoundError.make({
                resource: 'lekha_redirect',
                message: 'Redirect rule not found'
              })
            );
          }
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'lekha', message: 'Lekha not found' })
          );
        }
        yield* refreshSiteLekhaSlugMap();
        return { success: true as const };
      })
    )
  );

export const lekha_router = t.router({
  add_lekha: add_lekha_route,
  edit_lekha: edit_lekha_route,
  delete_lekha: delete_lekha_route,
  list_lekhas: list_lekhas_route,
  check_url_slug: check_url_slug_route,
  list_lekha_redirects: list_lekha_redirects_route,
  delete_lekha_redirect: delete_lekha_redirect_route
});
