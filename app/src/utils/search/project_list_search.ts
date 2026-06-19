export type ProjectSearchFields = {
  name: string;
  name_dev: string;
  description?: string | null;
};

/** Split a query into lowercase words; every word must match somewhere. */
export const tokenize_search_query = (query: string): string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/** Case-insensitive substring match for a single search word. */
export const word_matches_text = (word: string, text: string): boolean => {
  if (!word) return true;
  return text.toLowerCase().includes(word);
};

export const all_words_match_in_fields = (
  words: string[],
  fields: readonly (string | undefined | null)[]
): boolean => {
  if (words.length === 0) return true;
  const searchable = fields.filter((f): f is string => typeof f === 'string' && f.length > 0);
  if (searchable.length === 0) return false;
  return words.every((word) => searchable.some((field) => word_matches_text(word, field)));
};

export const project_matches_search = (
  project: ProjectSearchFields,
  words: string[],
  name_dev_normal?: string
): boolean =>
  all_words_match_in_fields(words, [
    project.name,
    project.name_dev,
    project.description,
    name_dev_normal
  ]);

export const filter_projects_by_search = <T extends ProjectSearchFields>(
  projects: readonly T[],
  search_text: string,
  get_name_dev_normal: (name_dev: string) => string | undefined
): T[] => {
  const words = tokenize_search_query(search_text);
  return projects.filter((project) =>
    project_matches_search(project, words, get_name_dev_normal(project.name_dev))
  );
};
