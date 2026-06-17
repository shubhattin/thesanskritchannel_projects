import {
  apply_map_edit_list_defaults,
  apply_map_edit_shloka_defaults,
  can_convert_childless_to_list,
  can_convert_childless_to_shloka,
  clone_recursive_list
} from '~/components/pages/map_edit/map_edit_lib';
import type { recursive_list_type } from '~/state/data_types';
import { get_node_at_path } from '~/state/project_list';

export type MapMetadataTypeConvertTarget = 'to_shloka' | 'to_list';

export type MapMetadataPatch =
  | { kind: 'list_name'; path: number[]; value: string }
  | { kind: 'name_dev'; path: number[]; value: string }
  | { kind: 'convert_to_shloka'; path: number[] }
  | { kind: 'convert_to_list'; path: number[] };

export function get_map_metadata_type_convert_target(
  node: recursive_list_type | null | undefined
): MapMetadataTypeConvertTarget | null {
  if (!node) return null;
  if (can_convert_childless_to_shloka(node)) return 'to_shloka';
  if (can_convert_childless_to_list(node)) return 'to_list';
  return null;
}

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
  if (patch.kind === 'name_dev') {
    if (patch.path.length === 0) return 'Root display name cannot be edited here';
    if (!patch.value.trim()) return 'Name (देवनागरी) cannot be empty';
    return null;
  }
  if (patch.kind === 'convert_to_shloka') {
    if (!can_convert_childless_to_shloka(node)) {
      return 'Only childless list nodes can be converted to shloka';
    }
    return null;
  }
  if (!can_convert_childless_to_list(node)) {
    return 'Only empty shloka nodes can be converted to list';
  }
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
  const preserve_name_dev = patch.path.length === 0;

  if (patch.kind === 'list_name') {
    if (node.info.type !== 'list') throw new Error('Level label can only be edited on list nodes');
    node.info.list_name = patch.value.trim();
  } else if (patch.kind === 'name_dev') {
    node.name_dev = patch.value.trim();
  } else if (patch.kind === 'convert_to_shloka') {
    apply_map_edit_shloka_defaults(node, { preserve_name_dev });
  } else {
    apply_map_edit_list_defaults(node, { preserve_name_dev });
  }

  return next;
}
