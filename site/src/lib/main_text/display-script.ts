import { get_script_from_id } from '@app/state/lang_list';
import { DEFAULT_SCRIPT_ID } from '../cookies';

export const get_display_script_from_id = (script_id: number) => {
  return get_script_from_id(script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID);
};
