export const LANGUAGES = [
  'Hindi',
  'English',
  'Sanskrit',
  'Telugu',
  'Kannada',
  'Marathi',
  'Tamil',
  'Malayalam',
  'Bengali',
  'Gujarati'
] as const;

export const MODELS_LIST = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gemini-2.0-flash',
  'gemini-2.5-flash'
] as const;
export type models_list_type = (typeof MODELS_LIST)[number];
export const MODEL_NAMES: Record<models_list_type, string> = {
  'gpt-5': 'GPT-5',
  'gpt-5-mini': 'GPT-5 Mini',
  'gpt-5-nano': 'GPT-5 Nano',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.5-flash': 'Gemini 2.5 Flash'
} as const;
