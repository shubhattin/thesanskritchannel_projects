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

export const should_show_normal_transliteration = (textScript: script_list_type) =>
  !NON_BRAHMIC_SCRIPTS.has(textScript);

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
