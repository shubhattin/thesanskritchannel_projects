// `number`
export const LANG_ID_COOKIE_NAME = 'site_lang_id';
// `number`
export const SCRIPT_ID_COOKIE_NAME = 'site_script_id';

export const DEFAULT_LANG_ID = -1;

export const parse_lang_id_cookie = (value: string | undefined | null) => {
  if (value === null || typeof value === 'undefined' || value.trim() === '') {
    return DEFAULT_LANG_ID;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : DEFAULT_LANG_ID;
};
