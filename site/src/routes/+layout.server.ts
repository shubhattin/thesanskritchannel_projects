import type { LayoutServerLoad } from './$types';
import {
  LANG_ID_COOKIE_NAME,
  SCRIPT_ID_COOKIE_NAME,
  parse_lang_id_cookie,
  parse_script_id_cookie
} from '$lib/cookies';

export const load: LayoutServerLoad = async ({ cookies }) => {
  return {
    lang_id: parse_lang_id_cookie(cookies.get(LANG_ID_COOKIE_NAME)),
    script_id: parse_script_id_cookie(cookies.get(SCRIPT_ID_COOKIE_NAME))
  };
};
