import {
  all_words_match_in_fields,
  tokenize_search_query
} from '@app/utils/search/project_list_search';

export type LekhaListSearchFields = {
  title: string;
  description?: string | null;
  tags?: readonly string[] | null;
};

/**
 * Client-side lekha list filter: every query word must appear in title, description,
 * tags, or Devanagari→Normal romanizations of those fields (so Latin queries match
 * Sanskrit text and Devanagari queries match as typed).
 */
export function filter_lekhas_by_search<T extends LekhaListSearchFields>(
  posts: readonly T[],
  search_text: string,
  get_normal: (text: string) => string | undefined
): T[] {
  const words = tokenize_search_query(search_text);
  if (words.length === 0) return [...posts];

  return posts.filter((post) => {
    const description = post.description?.trim() ? post.description : null;
    const tags = (post.tags ?? []).filter((tag) => tag.trim().length > 0);
    return all_words_match_in_fields(words, [
      post.title,
      description,
      ...tags,
      get_normal(post.title),
      description ? get_normal(description) : undefined,
      ...tags.map((tag) => get_normal(tag))
    ]);
  });
}
