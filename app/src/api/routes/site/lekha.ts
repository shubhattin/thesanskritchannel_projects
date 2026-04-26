import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { site_lekhas } from '~/db/schema';
import { SiteLekhaSchemaZod } from '~/db/schema_zod';
import {
  lekhaUrlSlugify,
  normalizeLekhaTextFields,
  sanitizeAndFormatLekhaMarkdownForStorage
} from '~/utils/markdown';

const lekha_post_input = SiteLekhaSchemaZod.pick({
  title: true,
  content: true,
  description: true,
  draft: true,
  tags: true,
  listed: true,
  search_indexed: true,
  url_slug: true
});

async function normalizeLekhaPostForStorage(
  post_data: z.infer<typeof lekha_post_input>
): Promise<z.infer<typeof lekha_post_input>> {
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

const get_lekha_route = protectedAdminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ input }) => {
    const lekha = await db.query.site_lekhas.findFirst({
      where: (tbl, { eq }) => eq(tbl.id, input.id)
    });
    return lekha;
  });

const add_lekha_route = protectedAdminProcedure
  .input(
    z.object({
      post_data: lekha_post_input
    })
  )
  .mutation(async ({ input: { post_data } }) => {
    const normalized = await normalizeLekhaPostForStorage(post_data);
    const lekha = await db.insert(site_lekhas).values(normalized).returning();
    return {
      id: lekha[0].id
    };
  });

const edit_lekha_route = protectedAdminProcedure
  .input(
    z.object({
      id: z.number(),
      post_data: lekha_post_input
    })
  )
  .mutation(async ({ input: { id, post_data } }) => {
    const normalized = await normalizeLekhaPostForStorage(post_data);
    const lekha = await db
      .update(site_lekhas)
      .set(normalized)
      .where(eq(site_lekhas.id, id))
      .returning();
    return {
      id: lekha[0]?.id ?? id
    };
  });

const delete_lekha_route = protectedAdminProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input: { id } }) => {
    await db.delete(site_lekhas).where(eq(site_lekhas.id, id));
    return {
      id: id
    };
  });

const list_lekhas_input = z.object({
  search_text: z.string().max(500).optional(),
  draft: z.boolean().optional(),
  sort_by: z.enum(['published_at', 'updated_at']).default('published_at'),
  order_by: z.enum(['asc', 'desc']).default('desc'),
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(20)
});

const list_lekhas_route = protectedAdminProcedure
  .input(list_lekhas_input)
  .query(async ({ input }) => {
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

    const [countResult, list] = await Promise.all([
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
    ]);

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
  });

const check_url_slug_route = protectedAdminProcedure
  .input(
    z.object({
      url_slug: z.string().max(500),
      exclude_id: z.number().int().positive().optional()
    })
  )
  .query(async ({ input: { url_slug, exclude_id } }) => {
    const normalized = lekhaUrlSlugify(url_slug);
    const lekha = await db.query.site_lekhas.findFirst({
      where: (tbl, { eq, ne }) =>
        exclude_id != null
          ? and(eq(tbl.url_slug, normalized), ne(tbl.id, exclude_id))
          : eq(tbl.url_slug, normalized),
      columns: { id: true }
    });
    return { exists: !!lekha };
  });

export const lekha_router = t.router({
  get_lekha: get_lekha_route,
  add_lekha: add_lekha_route,
  edit_lekha: edit_lekha_route,
  delete_lekha: delete_lekha_route,
  list_lekhas: list_lekhas_route,
  check_url_slug: check_url_slug_route
});
