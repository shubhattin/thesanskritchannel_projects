import { describe, expect, it } from 'vitest';
import type { recursive_list_type } from '~/state/data_types';
import { search_name_dev_in_maps } from './search_name_dev.server';

const sample_map: recursive_list_type = {
  name_dev: 'भगवद्गीता',
  info: { type: 'list', list_name: 'Chapter' },
  list: [
    {
      name_dev: 'अध्याय १',
      info: { type: 'list', list_name: 'Shloka' },
      list: [
        {
          name_dev: 'श्लोक १',
          info: { type: 'shloka', shloka_count: 1, total: 4 }
        }
      ]
    },
    {
      name_dev: 'अध्याय २',
      info: { type: 'list', list_name: 'Shloka' },
      list: []
    }
  ]
};

describe('search_name_dev_in_maps', () => {
  it('finds root and nested name_dev matches', () => {
    const result = search_name_dev_in_maps({
      projects: [{ id: 1, map: sample_map }],
      search_text: 'गीता',
      limit: 20,
      offset: 0
    });

    expect(result.page.totalCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      project_id: 1,
      path: '',
      text: 'भगवद्गीता'
    });
  });

  it('respects path prefixes', () => {
    const result = search_name_dev_in_maps({
      projects: [{ id: 1, map: sample_map }],
      search_text: 'अध्याय',
      path_prefixes: [[2]],
      limit: 20,
      offset: 0
    });

    expect(result.page.totalCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      path: '2',
      text: 'अध्याय २'
    });
  });

  it('paginates results', () => {
    const result = search_name_dev_in_maps({
      projects: [{ id: 1, map: sample_map }],
      search_text: 'अध्याय',
      limit: 1,
      offset: 1
    });

    expect(result.items).toHaveLength(1);
    expect(result.page.totalCount).toBe(2);
    expect(result.page.hasMore).toBe(false);
    expect(result.items[0]?.path).toBe('2');
  });
});
