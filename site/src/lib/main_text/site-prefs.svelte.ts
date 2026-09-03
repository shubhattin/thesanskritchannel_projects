import { get_script_from_id, get_script_id, type script_list_type } from '@app/state/lang_list';
import { DEFAULT_LANG_ID, DEFAULT_SCRIPT_ID } from '$lib/cookies';

/** Client + SSR shared prefs for script/lang (cookies written on change; no reload). */
class SitePrefs {
  script_id = $state(DEFAULT_SCRIPT_ID);
  lang_id = $state(DEFAULT_LANG_ID);

  init(script_id: number, lang_id: number) {
    this.script_id = script_id;
    this.lang_id = lang_id;
  }

  set_script_id(id: number) {
    this.script_id = id;
  }

  set_lang_id(id: number) {
    this.lang_id = id;
  }

  get script(): script_list_type {
    return get_script_from_id(this.script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID);
  }

  set_script(script: script_list_type) {
    this.script_id = get_script_id(script);
  }
}

export const site_prefs = new SitePrefs();
