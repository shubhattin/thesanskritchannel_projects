import { type ScriptLangType, type ScriptListType, getNormalizedScriptName } from 'lipilekhika';

export const SCRIPT_AVATAR_MAP = {
  Devanagari: 'अ',
  Telugu: 'అ',
  Tamil: 'அ',
  'Tamil-Extended': 'அ',
  Bengali: 'অ',
  Kannada: 'ಅ',
  Gujarati: 'અ',
  Malayalam: 'അ',
  Odia: 'ଅ',
  Sinhala: 'අ',
  Normal: 'a',
  Romanized: 'ā',
  Gurumukhi: 'ਅ',
  Assamese: 'অ',
  Siddham: '𑖀',
  'Purna-Devanagari': 'अ',
  Brahmi: '𑀅',
  Granth: '𑌅',
  Modi: '𑘀',
  Sharada: '𑆃'
} satisfies Record<ScriptListType, string>;

export const getScriptAvatar = (script: ScriptLangType) => {
  const normalizedScript = getNormalizedScriptName(script);
  if (!normalizedScript) return 'अ';
  return SCRIPT_AVATAR_MAP[normalizedScript];
};
