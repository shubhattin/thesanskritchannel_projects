import type { script_list_type } from '~/state/lang_list';
import { BASE_SCRIPT } from '~/state/main_app/state.svelte';
import { transliterate_custom } from '~/tools/converter';

export const MISSING_TRANSLATION = '----';
export const PREVIEW_SHLOKA_COUNT = 4;

const NON_BRAHMIC_SCRIPTS = new Set<script_list_type>(['Normal', 'Romanized']);

export type DownloadTextFormatOptions = {
  textScript: script_list_type;
  includeNormal: boolean;
  includeTranslation: boolean;
};

export type ParsedImportTextRow = {
  text: string;
  normal?: string;
  translation?: string;
};

export type ParseImportTextOptions = {
  includesNormal: boolean;
  includesTranslation: boolean;
};

export type ParseImportTextResult = {
  rows: ParsedImportTextRow[];
  ignoredBlockCount: number;
};

export const should_show_normal_transliteration = (textScript: script_list_type) =>
  !NON_BRAHMIC_SCRIPTS.has(textScript);

const clean_section = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

const split_import_sections = (input: string) =>
  input
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\s*\n+/)
    .map(clean_section)
    .filter(Boolean);

export const is_missing_translation_marker = (text: string) => /^---+$/.test(text.trim());

function parse_text_and_normal_section(
  section: string,
  includesNormal: boolean
): ParsedImportTextRow | null {
  const cleaned = clean_section(section);
  if (!cleaned) return null;
  if (!includesNormal) return { text: cleaned };

  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2 || lines.length % 2 !== 0) return null;

  const splitAt = lines.length / 2;
  const text = lines.slice(0, splitAt).join('\n').trim();
  const normal = lines.slice(splitAt).join('\n').trim();
  if (!text || !normal) return null;

  return { text, normal };
}

export function parse_import_text(
  input: string,
  options: ParseImportTextOptions
): ParseImportTextResult {
  const sections = split_import_sections(input);
  const rows: ParsedImportTextRow[] = [];
  let ignoredBlockCount = 0;

  if (!options.includesTranslation) {
    for (const section of sections) {
      const row = parse_text_and_normal_section(section, options.includesNormal);
      if (row) rows.push(row);
      else ignoredBlockCount++;
    }
    return { rows, ignoredBlockCount };
  }

  for (let i = 0; i < sections.length; i += 2) {
    const mainSection = sections[i];
    const translationSection = sections[i + 1];
    if (!mainSection || !translationSection) {
      ignoredBlockCount++;
      continue;
    }

    const row = parse_text_and_normal_section(mainSection, options.includesNormal);
    if (!row) {
      ignoredBlockCount++;
      continue;
    }

    const translation = clean_section(translationSection);
    if (!translation) {
      ignoredBlockCount++;
      continue;
    }
    if (!is_missing_translation_marker(translation)) row.translation = translation;
    rows.push(row);
  }

  return { rows, ignoredBlockCount };
}

export function format_shloka_block(
  scriptText: string,
  normalText: string | null,
  translationText: string | null | undefined,
  options: Pick<DownloadTextFormatOptions, 'includeNormal' | 'includeTranslation'>
): string {
  let result = scriptText;
  const has_normal = options.includeNormal && normalText !== null;

  if (has_normal) {
    result += `\n${normalText}`;
  }

  if (options.includeTranslation) {
    const translation = translationText?.trim() ? translationText : MISSING_TRANSLATION;
    result += `${has_normal ? '\n\n' : '\n'}${translation}`;
  }

  return result;
}

export function format_download_text(
  scriptTexts: string[],
  normalTexts: (string | null)[] | null,
  textIndices: number[],
  translationMap: Map<number, string> | null,
  options: DownloadTextFormatOptions
): string {
  return scriptTexts
    .map((scriptText, i) =>
      format_shloka_block(
        scriptText,
        normalTexts?.[i] ?? null,
        translationMap?.get(textIndices[i]),
        options
      )
    )
    .join('\n\n');
}

export async function transliterate_text_batch(
  texts: string[],
  textScript: script_list_type,
  includeNormal: boolean
) {
  const scriptTexts = await transliterate_custom(texts, BASE_SCRIPT, textScript);
  const normalTexts =
    includeNormal && should_show_normal_transliteration(textScript)
      ? await transliterate_custom(texts, BASE_SCRIPT, 'Normal')
      : null;

  return { scriptTexts, normalTexts };
}
