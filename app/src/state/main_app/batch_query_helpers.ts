import { queryClient } from '~/state/queryClient';
import { trpc } from '~/api/client';
import { get_dynamic_path_params } from './query_key_helpers';
import type { ProjectState } from './state.svelte';

export const invalidate_text_image_queries = async (project_id?: number) => {
  await Promise.all([
    queryClient.invalidateQueries(trpc.ai.image_assets.list.queryFilter()),
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'text_images' &&
        (project_id === undefined || query.queryKey[1] === project_id)
    })
  ]);
};

export const invalidate_batch_ai_queries = async (opts?: {
  project_id?: number;
  index?: number;
}) => {
  await Promise.all([
    queryClient.invalidateQueries(trpc.batch_ai.get_batch_manager_groups.queryFilter()),
    queryClient.invalidateQueries(trpc.batch_ai.get_shloka_image_batch_status.queryFilter()),
    queryClient.invalidateQueries({
      predicate: (query) => {
        if (query.queryKey[0] !== 'shloka_batch_status') return false;
        if (opts?.project_id !== undefined && query.queryKey[1] !== opts.project_id) return false;
        if (opts?.index !== undefined && query.queryKey[3] !== opts.index) return false;
        return true;
      }
    })
  ]);
};

export const text_images_query_key = (
  project: ProjectState | null,
  selected_text_levels: (number | null)[],
  index?: number | null
) =>
  [
    'text_images',
    project?.project_id ?? null,
    ...get_dynamic_path_params(selected_text_levels, project?.levels ?? 0),
    index === undefined ? 'all' : index
  ] as const;
