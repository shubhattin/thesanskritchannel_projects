import { LANG_LIST, LANG_LIST_IDS, LANG_SCRIPT_MAP } from '~/state/lang_list';

const scriptOfLang = new Map<string, string>(Object.entries(LANG_SCRIPT_MAP));

/**
 * The language ids stored in the database (from state/lang_list/langs.json), so the agent can map
 * "the Hindi translation" or "in Telugu" to the right lang_id before querying.
 */
export function buildLanguagesContext(): string {
  const rows = LANG_LIST.map((name, index) => {
    const script = scriptOfLang.get(name) ?? 'Normal';
    const written = script === 'Normal' ? 'Latin' : script;
    return `| ${LANG_LIST_IDS[index]} | ${name} | ${written} |`;
  });
  return `Language ids stored in the database. Map the language the admin names to its lang_id before querying; never guess an id.
Columns holding a language id: translations.lang_id, media_attachment.lang_id (null = any language), user_project_language_join.language_id.

| lang_id | language | written in |
| --- | --- | --- |
${rows.join('\n')}

- The source text (texts.text, Devanagari) has no lang_id: "the original/Sanskrit text" means the texts table, not a translations row.
- Script ids are not stored in this database; the script column is only the script each language is written in.`;
}
