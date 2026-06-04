import { client_q } from '~/api/client';
import { clone_recursive_list } from '~/components/pages/map_edit/map_edit_lib';
import type { recursive_list_type } from '~/state/data_types';
import { invalidate_project_registry_queries } from '~/state/main_app/data.svelte';
import { project_state } from '~/state/main_app/state.svelte';
import { get_level_names_from_map, get_node_at_path } from '~/state/project_list';
import { toast } from 'svelte-sonner';

export type MapMetadataPatch =
  | { kind: 'list_name'; path: number[]; value: string }
  | { kind: 'name_dev'; path: number[]; value: string };

export function validate_map_metadata_patch(
  map: recursive_list_type,
  patch: MapMetadataPatch
): string | null {
  const node = get_node_at_path(map, patch.path);
  if (!node) return 'Map node not found at the given path';
  if (patch.kind === 'list_name') {
    if (node.info.type !== 'list') return 'Level label can only be edited on list nodes';
    if (!patch.value.trim()) return 'Level label cannot be empty';
    return null;
  }
  if (patch.path.length === 0) return 'Root display name cannot be edited here';
  if (!patch.value.trim()) return 'Name (देवनागरी) cannot be empty';
  return null;
}

export function apply_map_metadata_patch(
  map: recursive_list_type,
  patch: MapMetadataPatch
): recursive_list_type {
  const err = validate_map_metadata_patch(map, patch);
  if (err) throw new Error(err);

  const next = clone_recursive_list(map);
  const node = get_node_at_path(next, patch.path)!;

  if (patch.kind === 'list_name') {
    if (node.info.type !== 'list') throw new Error('Level label can only be edited on list nodes');
    node.info.list_name = patch.value.trim();
  } else {
    node.name_dev = patch.value.trim();
  }

  return next;
}

export type MapMetadataSaveMutation = ReturnType<typeof create_map_metadata_save_mutation>;

export function create_map_metadata_save_mutation(
  getProjectId: () => number | undefined,
  options?: { onMapSaved?: (map: recursive_list_type) => void }
) {
  return client_q.project.map_edit.update.mutation({
    onSuccess: async ({ map }, variables) => {
      const mutation_project_id = variables.project_id;
      await invalidate_project_registry_queries(mutation_project_id);

      const current_project_id = getProjectId();
      if (current_project_id === mutation_project_id) {
        project_state.update((s) => ({
          ...s,
          level_names: get_level_names_from_map(map).slice(0, s.levels)
        }));
      }

      options?.onMapSaved?.(map);
      toast.success('Map updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update map');
    }
  });
}
