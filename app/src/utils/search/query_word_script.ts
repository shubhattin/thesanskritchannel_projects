import type { script_list_type } from '../../state/lang_list';

/** Unicode block → lipilekhika script. Shared blocks are resolved later. */
const SCRIPT_RANGES: readonly (readonly [
  start: number,
  end: number,
  script: script_list_type | 'latin'
])[] = [
  [0x41, 0x5a, 'latin'],
  [0x61, 0x7a, 'latin'],
  [0xc0, 0x24f, 'latin'],
  [0x1e00, 0x1eff, 'latin'],
  [0x0900, 0x097f, 'Devanagari'],
  [0xa8e0, 0xa8ff, 'Devanagari'],
  [0x0980, 0x09ff, 'Bengali'],
  [0x0a00, 0x0a7f, 'Gurumukhi'],
  [0x0a80, 0x0aff, 'Gujarati'],
  [0x0b00, 0x0b7f, 'Odia'],
  [0x0b80, 0x0bff, 'Tamil'],
  [0x0c00, 0x0c7f, 'Telugu'],
  [0x0c80, 0x0cff, 'Kannada'],
  [0x0d00, 0x0d7f, 'Malayalam'],
  [0x0d80, 0x0dff, 'Sinhala'],
  [0x11000, 0x1107f, 'Brahmi'],
  [0x11180, 0x111df, 'Sharada'],
  [0x11300, 0x1137f, 'Granth'],
  [0x11580, 0x115ff, 'Siddham'],
  [0x11600, 0x1165f, 'Modi']
];

const script_at = (cp: number): script_list_type | 'latin' | null => {
  for (const [start, end, script] of SCRIPT_RANGES) {
    if (cp >= start && cp <= end) return script;
  }
  return null;
};

/** Bengali/Assamese and Tamil/Tamil-Extended share a block; the selected script breaks the tie. */
const ALIASES = {
  Bengali: ['Bengali', 'Assamese'],
  Tamil: ['Tamil', 'Tamil-Extended']
} satisfies Partial<Record<script_list_type, readonly script_list_type[]>>;

const LATIN_OUTPUT: ReadonlySet<script_list_type> = new Set(['Normal', 'Romanized']);

const alias_group = (script: script_list_type): readonly script_list_type[] | undefined => {
  if (script === 'Bengali' || script === 'Tamil') return ALIASES[script];
  return undefined;
};

const prefer_selected = (
  detected: script_list_type,
  selected: script_list_type
): script_list_type => {
  const group = alias_group(detected);
  if (group?.includes(selected)) return selected;
  return detected;
};

/**
 * Script to transliterate this already-folded query word into Normal.
 * Latin (including IAST after folding) returns null — it is matched as roman text.
 * Devanagari is recognized from the characters themselves, so it still matches when
 * another script is selected. Other Brahmic words use their own block, with the
 * selected script only as a tie-break (Assamese/Bengali, Tamil/Tamil-Extended)
 * or as a fallback for an unrecognized letter.
 */
export const normal_source_for_query_word = (
  word: string,
  selected: script_list_type
): script_list_type | null => {
  let detected: script_list_type | null = null;
  let latin = false;
  let unknown = false;

  for (const ch of word) {
    const cp = ch.codePointAt(0);
    if (cp === undefined || cp <= 0x40) continue;
    const script = script_at(cp);
    if (script === 'latin' || script === null) {
      if (script === 'latin') latin = true;
      else if (cp > 0x24f) unknown = true;
      continue;
    }
    if (detected && detected !== script) {
      if (selected === script || alias_group(script)?.includes(selected)) detected = script;
      continue;
    }
    detected = script;
  }

  if (detected) return prefer_selected(detected, selected);
  if (unknown && !latin && !LATIN_OUTPUT.has(selected)) return selected;
  return null;
};
