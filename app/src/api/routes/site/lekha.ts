import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { site_lekhas } from '~/db/schema';
import { SiteLekhaSchemaZod } from '~/db/schema_zod';

const add_lekha_route = protectedAdminProcedure
  .input(
    z.object({
      post_data: SiteLekhaSchemaZod.pick({
        title: true,
        content: true,
        description: true,
        draft: true,
        tags: true,
        listed: true,
        search_indexed: true
      })
    })
  )
  .mutation(async ({ input: { post_data } }) => {
    const lekha = await db.insert(site_lekhas).values(post_data).returning();
    return {
      id: lekha[0].id
    };
  });

const edit_lekha_route = protectedAdminProcedure
  .input(
    z.object({
      id: z.number(),
      post_data: SiteLekhaSchemaZod.pick({
        content: true,
        description: true,
        draft: true,
        listed: true,
        search_indexed: true,
        title: true,
        tags: true
      })
    })
  )
  .mutation(async ({ input: { id, post_data } }) => {
    const lekha = await db
      .update(site_lekhas)
      .set(post_data)
      .where(eq(site_lekhas.id, id))
      .returning();
    return {
      id: lekha[0].id
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

export const lekha_router = t.router({
  add_lekha: add_lekha_route,
  edit_lekha: edit_lekha_route,
  delete_lekha: delete_lekha_route,
  list_lekhas: list_lekhas_route
});
