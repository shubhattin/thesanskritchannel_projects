import {
  matches_script_search,
  tokenize_search_query,
  type ScriptSearchQuery
} from '@app/utils/search/project_list_search';

export type LekhaListSearchFields = {
  title: string;
  description?: string | null;
  tags?: readonly string[] | null;
  /** Set when the viewing script is not Devanagari and the title was transliterated. */
  title_transliterated?: string | null;
  description_transliterated?: string | null;
};

/**
 * Client-side lekha list filter. The article body is not searched.
 * Each query word may match the title, description, or tags as:
 * - that same text (Devanagari stays Devanagari, even when another script is selected)
 * - Latin / IAST against the Normal romanization of those fields
 * - the selected-script transliteration
 * A Brahmic query's Normal form is a word-prefix only, so `केव` does not hit `देव`
 * and `लिप्` does not hit `लिपि` or an English word like "eclipse".
 * Fuzzy matching is Latin typos on titles only.
 */
export function filter_lekhas_by_search<T extends LekhaListSearchFields>(
  posts: readonly T[],
  search_text: string,
  get_normal: (text: string) => string | undefined,
  query?: Pick<ScriptSearchQuery, 'normals'>
): T[] {
  const words = tokenize_search_query(search_text);
  if (words.length === 0) return [...posts];

  return posts.filter((post) => {
    const description = post.description?.trim() ? post.description : null;
    const tags = (post.tags ?? []).filter((tag) => tag.trim().length > 0);
    const title_normal = get_normal(post.title);
    const description_normal = description ? get_normal(description) : undefined;
    return matches_script_search(
      { words, normals: query?.normals },
      {
        direct: [
          post.title,
          description,
          ...tags,
          title_normal,
          description_normal,
          ...tags.map((tag) => get_normal(tag)),
          post.title_transliterated,
          post.description_transliterated
        ],
        fuzzy: [post.title, title_normal, post.title_transliterated]
      }
    );
  });
}
