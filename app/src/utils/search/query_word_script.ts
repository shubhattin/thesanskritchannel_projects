import type { script_list_type } from '../../state/lang_list';

/**
 * Unicode block → lipilekhika script. Bengali/Assamese and Tamil/Tamil-Extended
 * share a block; the selected script breaks that tie.
 */
const script_at = (cp: number): script_list_type | 'latin' | null => {
  if (
    (cp >= 0x41 && cp <= 0x5a) ||
    (cp >= 0x61 && cp <= 0x7a) ||
    (cp >= 0xc0 && cp <= 0x24f) ||
    (cp >= 0x1e00 && cp <= 0x1eff)
  ) {
    return 'latin';
  }
  if ((cp >= 0x0900 && cp <= 0x097f) || (cp >= 0xa8e0 && cp <= 0xa8ff)) return 'Devanagari';
  if (cp >= 0x0980 && cp <= 0x09ff) return 'Bengali';
  if (cp >= 0x0a00 && cp <= 0x0a7f) return 'Gurumukhi';
  if (cp >= 0x0a80 && cp <= 0x0aff) return 'Gujarati';
  if (cp >= 0x0b00 && cp <= 0x0b7f) return 'Odia';
  if (cp >= 0x0b80 && cp <= 0x0bff) return 'Tamil';
  if (cp >= 0x0c00 && cp <= 0x0c7f) return 'Telugu';
  if (cp >= 0x0c80 && cp <= 0x0cff) return 'Kannada';
  if (cp >= 0x0d00 && cp <= 0x0d7f) return 'Malayalam';
  if (cp >= 0x0d80 && cp <= 0x0dff) return 'Sinhala';
  if (cp >= 0x11000 && cp <= 0x1107f) return 'Brahmi';
  if (cp >= 0x11180 && cp <= 0x111df) return 'Sharada';
  if (cp >= 0x11300 && cp <= 0x1137f) return 'Granth';
  if (cp >= 0x11580 && cp <= 0x115ff) return 'Siddham';
  if (cp >= 0x11600 && cp <= 0x1165f) return 'Modi';
  return null;
};

const ALIASES: Partial<Record<script_list_type, readonly script_list_type[]>> = {
  Bengali: ['Bengali', 'Assamese'],
  Tamil: ['Tamil', 'Tamil-Extended']
};

const LATIN_OUTPUT: ReadonlySet<script_list_type> = new Set(['Normal', 'Romanized']);

const prefer_selected = (
  detected: script_list_type,
  selected: script_list_type
): script_list_type => {
  const group = ALIASES[detected];
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
      if (selected === script || ALIASES[script]?.includes(selected)) detected = script;
      continue;
    }
    detected = script;
  }

  if (detected) return prefer_selected(detected, selected);
  if (unknown && !latin && !LATIN_OUTPUT.has(selected)) return selected;
  return null;
};
