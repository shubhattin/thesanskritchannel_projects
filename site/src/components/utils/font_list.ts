import { type ScriptLangType, type ScriptListType, getNormalizedScriptName } from 'lipilekhika';

const FONT_LIST = {
  Devanagari: 'font-devanagari',
  'Purna-Devanagari': 'font-devanagari',
  Telugu: 'font-telugu',
  Tamil: 'font-tamil',
  'Tamil-Extended': 'font-tamil-extended',
  Bengali: 'font-bengali',
  Assamese: 'font-bengali',
  Kannada: 'font-kannada',
  Gujarati: 'font-gujarati',
  Malayalam: 'font-malayalam',
  Odia: 'font-odia',
  Sinhala: 'font-sinhala',
  Gurumukhi: 'font-gurmukhi',
  //
  Normal: 'font-normal',
  Romanized: 'font-romanized',
  //
  Brahmi: 'font-brahmi',
  Granth: 'font-grantha',
  Modi: 'font-modi',
  Sharada: 'font-sharada',
  Siddham: 'font-siddham'
} satisfies Record<ScriptListType, string>;

export const getFontClass = (script: ScriptLangType) => {
  // SAFETY: `getNormalizedScriptName` returns null only for names outside its
  // `script_input_name_type` domain; every member of that union resolves through
  // the script list, the language map, or the alternates map, so `script` (a
  // `ScriptLangType`) always yields a defined `ScriptListType`.
  return FONT_LIST[getNormalizedScriptName(script) as ScriptListType];
};
