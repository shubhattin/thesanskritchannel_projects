import { describe, expect, it } from 'vitest';
import {
  build_trans_lang_data_query_key,
  get_dynamic_path_params,
  get_normalized_selected_text_levels
} from './query_key_helpers';
import { get_path_params } from '../project_list';

describe('query_key_helpers', () => {
  it('trims sparse trailing nulls on the lowest route levels', () => {
    const project_levels = 5;
    const sparse = [null, null, 12, 3, null];

    expect(get_dynamic_path_params(sparse, project_levels)).toEqual([3, 12]);
    expect(get_path_params(sparse, project_levels)).toEqual([3, 12]);
    expect(get_normalized_selected_text_levels(sparse, project_levels)).toEqual([
      12,
      3,
      null,
      null
    ]);
  });

  it('builds translation query keys from sparse selections', () => {
    const project_id = 7;
    const lang_id = 2;
    const project_levels = 5;
    const sparse = [null, null, 12, 3, null];

    expect(build_trans_lang_data_query_key(project_id, lang_id, sparse, project_levels)).toEqual([
      'trans',
      project_id,
      lang_id,
      3,
      12
    ]);
  });

  it('includes path segments when the normalized selection has no interior nulls', () => {
    expect(build_trans_lang_data_query_key(1, 9, [4, 2, null], 3)).toEqual(['trans', 1, 9, 2, 4]);
  });
});
