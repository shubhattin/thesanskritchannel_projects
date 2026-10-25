import { recursive_list_schema } from '~/state/data_types';
import { batch_metadata_schema } from '~/utils/types/ai_batch_metadata';
import { zodTypeText } from './zod_type_text';

/**
 * Meaning the DDL cannot carry. `describe_schema.test.ts` fails when a table in
 * `src/db/schema.ts` has neither a note here nor an entry in `HIDDEN_TABLES` — add one with
 * every new table.
 */
export const TABLE_NOTES = new Map<string, string>([
  [
    'projects',
    'One text (e.g. Rāmāyaṇa, a Veda). key = URL slug; name = English/roman name, name_dev = Devanagari name. listed=false means hidden from the public site. map = the whole level tree (see JSONB note).'
  ],
  ['project_redirects', 'Old keys of renamed projects, kept so old URLs redirect'],
  [
    'project_paths',
    'One leaf level of a project (e.g. a sarga). path = 1-based positions down the map, colon separated, highest level first ("2:5" = 2nd kāṇḍa → 5th sarga; "" = project root for single-level texts). The level names live in projects.map, not here.'
  ],
  [
    'texts',
    'Lines of the source text, ordered by index (0-based) within a project_path. shloka_num is set on the line that ends a shloka/mantra (null otherwise). text_search = text with Vedic svara marks removed (trigram-indexed; use it with LIKE/ILIKE).'
  ],
  [
    'translations',
    'Translation of texts line-by-line: same (project_path_id, index) as texts, per lang_id (see language ids).'
  ],
  ['other', 'Misc key/value settings (e.g. image tool presets)'],
  [
    'media_attachment',
    'Links (pdf/text/video/audio) shown with a project path; lang_id null = any language'
  ],
  [
    'site_lekhas',
    'Articles (lekhas) on the public site. content = Markdown. draft=false and published_at set = published; listed controls the site index/search.'
  ],
  ['site_lekha_redirects', 'Old url_slugs of renamed lekhas'],
  ['image_system_prompt_templates', 'Editable system prompts for image-prompt generation'],
  ['image_assets', 'Generated/uploaded images; s3_key in the CDN bucket'],
  ['ai_batches', 'OpenAI Batch API jobs (image/text generation)'],
  ['ai_batch_responses', 'One request inside an OpenAI batch; metadata says what it is for'],
  [
    'text_image_assets_join',
    'Images grouped under a project path (+ line index; null once the line is deleted)'
  ],
  [
    'user_project_join',
    'Which non-admin users may edit which project. user_id = Better Auth user id'
  ],
  ['user_project_language_join', 'Which translation languages a user may edit in a project']
]);

/** Tables the agent does not need to know about. */
export const HIDDEN_TABLES = new Set(['agent_chats', 'agent_messages']);

/** `table.column` → type of the JSON stored in it. */
export const JSONB_COLUMN_TYPES = new Map<string, string>([
  [
    'projects.map',
    `recursive tree: ${zodTypeText(recursive_list_schema.omit({ list: true }))} plus list: <same tree>[]. The root node is the project itself; info.list_name names the level its children form (e.g. "Kanda"); leaves have info.type "shloka"`
  ],
  ['other.value', 'object; shape depends on key'],
  ['ai_batch_responses.metadata', zodTypeText(batch_metadata_schema)]
]);
