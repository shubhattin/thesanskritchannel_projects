import { fold_search_text } from './fold_search_text';
import { fuzzy_includes, max_fuzzy_edits } from './fuzzy_includes';

export type ProjectSearchFields = {
  name: string;
  name_dev: string;
  description?: string | null;
};

/** Name-like fields longer than this stay substring-only. */
const FUZZY_FIELD_LIMIT = 240;

/** Split a query into folded words; every word must match somewhere. */
export const tokenize_search_query = (query: string): string[] =>
  fold_search_text(query).trim().split(/\s+/).filter(Boolean);

/** Case- and Latin-diacritic-insensitive substring match for a single search word. */
export const word_matches_text = (word: string, text: string): boolean => {
  if (!word) return true;
  return fold_search_text(text).includes(fold_search_text(word));
};

const folded_fields = (fields: readonly (string | null | undefined)[]): string[] => {
  const out: string[] = [];
  for (const field of fields) {
    if (!field) continue;
    out.push(fold_search_text(field));
  }
  return out;
};

const word_hits = (word: string, direct: readonly string[], fuzzy: readonly string[]): boolean => {
  const folded = fold_search_text(word);
  if (!folded) return true;
  for (const field of direct) {
    if (field.includes(folded)) return true;
  }
  // Fuzzy is a Latin typo pass only. One edit on Devanagari turns लिप् into लिपि.
  if (!is_latin_query_word(folded)) return false;
  const edits = max_fuzzy_edits(folded.length);
  if (edits === 0) return false;
  for (const field of fuzzy) {
    if (fuzzy_includes(field, folded, edits)) return true;
  }
  return false;
};

const is_latin_query_word = (word: string) => {
  for (const ch of word) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp > 0x24f) return false;
  }
  return true;
};

/** Vowels in lipilekhika Normal after case folding. A closed syllable does not end in one. */
const NORMAL_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Brahmic query → Normal, matched against a field.
 * `केव` (`kEva`) may continue as `kEvalam`, but it must not fuzzy-hit `dEva`.
 * `लिप्` (`lip`) must not hit `lipi` or `eclipse`: a virama syllable does not
 * continue into a vowel.
 */
export const normal_form_in_field = (normal: string, field: string): boolean => {
  const needle = fold_search_text(normal);
  if (needle.length < 2) return false;
  const closed = !NORMAL_VOWELS.has(needle.at(-1) ?? '');
  for (const token of fold_search_text(field).split(/[^\p{L}\p{N}]+/u)) {
    if (!token.startsWith(needle)) continue;
    if (token.length === needle.length) return true;
    const next = token[needle.length];
    if (closed && next !== undefined && NORMAL_VOWELS.has(next)) continue;
    return true;
  }
  return false;
};

export type ScriptSearchQuery = {
  /** Folded query words from {@link tokenize_search_query}. */
  words: readonly string[];
  /**
   * Parallel to `words`. Normal-script transliteration of a Brahmic word, when one
   * was produced. Latin words stay undefined and match the Normal field directly.
   */
  normals?: readonly (string | undefined)[];
};

export type ScriptSearchFields = {
  /** Substring targets: original text, English, Normal romanization, display script. */
  direct: readonly (string | null | undefined)[];
  /** Short name-like fields. Fuzzy runs here only after substring misses. */
  fuzzy?: readonly (string | null | undefined)[];
};

/**
 * Every query word must hit a direct field or a fuzzy name field.
 * A Brahmic word may also match through its Normal form, as a word-prefix
 * rather than a fuzzy or mid-word substring.
 */
export const matches_script_search = (
  query: ScriptSearchQuery,
  fields: ScriptSearchFields
): boolean => {
  const { words, normals } = query;
  if (words.length === 0) return true;
  const direct = folded_fields(fields.direct);
  const fuzzy = folded_fields(fields.fuzzy ?? []).filter(
    (field) => field.length <= FUZZY_FIELD_LIMIT
  );
  if (direct.length === 0 && fuzzy.length === 0) return false;

  return words.every((word, index) => {
    if (word_hits(word, direct, fuzzy)) return true;
    const normal = normals?.[index];
    if (!normal) return false;
    const folded_normal = fold_search_text(normal);
    if (!folded_normal || folded_normal === word) return false;
    return direct.some((field) => normal_form_in_field(folded_normal, field));
  });
};

export const all_words_match_in_fields = (
  words: string[],
  fields: readonly (string | undefined | null)[]
): boolean => matches_script_search({ words }, { direct: fields });

export type ProjectSearchOptions = {
  /** Parallel to the tokenized query. See {@link ScriptSearchQuery.normals}. */
  query_normals?: readonly (string | undefined)[];
  /** `name_dev` already transliterated into the selected script. */
  name_dev_display?: string | null;
};

export const project_matches_search = (
  project: ProjectSearchFields,
  words: string[],
  name_dev_normal?: string,
  options?: ProjectSearchOptions
): boolean =>
  matches_script_search(
    { words, normals: options?.query_normals },
    {
      direct: [
        project.name,
        project.name_dev,
        project.description,
        name_dev_normal,
        options?.name_dev_display
      ],
      fuzzy: [project.name, project.name_dev, name_dev_normal, options?.name_dev_display]
    }
  );

export const filter_projects_by_search = <T extends ProjectSearchFields>(
  projects: readonly T[],
  search_text: string,
  get_name_dev_normal: (name_dev: string) => string | undefined,
  options?: {
    query_normals?: readonly (string | undefined)[];
    get_name_dev_display?: (name_dev: string) => string | undefined;
  }
): T[] => {
  const words = tokenize_search_query(search_text);
  return projects.filter((project) =>
    project_matches_search(project, words, get_name_dev_normal(project.name_dev), {
      query_normals: options?.query_normals,
      name_dev_display: options?.get_name_dev_display?.(project.name_dev)
    })
  );
};
