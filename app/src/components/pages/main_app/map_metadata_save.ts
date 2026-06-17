import { createMutation } from '@tanstack/svelte-query';
import { client } from '~/api/client';
import type { recursive_list_type } from '~/state/data_types';
import {
  invalidate_project_map_queries,
  invalidate_project_registry_queries
} from '~/state/main_app/data.svelte';
import { project_state } from '~/state/main_app/state.svelte';
import { get_level_names_from_map } from '~/state/project_list';
import { toast } from 'svelte-sonner';

export type { MapMetadataPatch, MapMetadataTypeConvertTarget } from './map_metadata_patch';
export {
  apply_map_metadata_patch,
  get_map_metadata_type_convert_target,
  validate_map_metadata_patch
} from './map_metadata_patch';

export type MapMetadataSaveMutation = ReturnType<typeof create_map_metadata_save_mutation>;

export function create_map_metadata_save_mutation(
  getProjectId: () => number | undefined,
  options?: { onMapSaved?: (map: recursive_list_type) => void }
) {
  return createMutation(() => ({
    mutationFn: (input: Parameters<typeof client.project.map_edit.update.mutate>[0]) =>
      client.project.map_edit.update.mutate(input),
    onSuccess: async ({ map }, variables) => {
      const mutation_project_id = variables.project_id;
      await Promise.all([
        invalidate_project_registry_queries(mutation_project_id),
        invalidate_project_map_queries(mutation_project_id)
      ]);

      const current_project_id = getProjectId();
      if (current_project_id === mutation_project_id) {
        project_state.update((s) =>
          s
            ? {
                ...s,
                level_names: get_level_names_from_map(map).slice(0, s.levels)
              }
            : s
        );
      }

      options?.onMapSaved?.(map);
      toast.success('Map updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update map');
    }
  }));
}
