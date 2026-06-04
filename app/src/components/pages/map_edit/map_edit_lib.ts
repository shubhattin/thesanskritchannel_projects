import type { recursive_list_type } from '~/state/data_types';
import { get_node_at_path } from '~/state/project_list';

export const MAP_EDIT_CLIENT_ID = '__mapEditClientId' as const;

export type MapNodeWithClientId = recursive_list_type & {
  [MAP_EDIT_CLIENT_ID]?: string;
};

export type MapPath = number[];

export type MapChangeKind =
  | 'rename'
  | 'list_name_change'
  | 'expected_count_change'
  | 'reorder'
  | 'add_child'
  | 'type_change';

export type MapChangeRow = {
  kind: MapChangeKind;
  clientId: string;
  path: MapPath;
  /** Short numeric path (`/1/2`); `/` at project root. */
  pathLabel: string;
  summary: string;
};

export type MapNodeDiffFlags = {
  edited: boolean;
  moved: boolean;
};

export type MapEditDiffState = {
  dirty: boolean;
  changedNodeCount: number;
  renameCount: number;
  reorderedParentCount: number;
  rows: MapChangeRow[];
  flagsByClientId: Map<string, MapNodeDiffFlags>;
};

export type BaselineNodeSnapshot = {
  name_dev: string;
  info: recursive_list_type['info'];
  indexInParent: number;
  parentClientId: string | null;
};

const new_client_id = () => crypto.randomUUID();

/** List-type label (`info.list_name`); always this for new or converted list nodes. */
export const MAP_EDIT_DEFAULT_LIST_LEVEL_NAME = 'Level Name';
export const MAP_EDIT_DEFAULT_SHLOKA_NAME_DEV = 'नवश्लोकानि';
export const MAP_EDIT_DEFAULT_LIST_NAME_DEV = 'नवसूची';

export const is_unsaved_added_map_node = (
  clientId: string | undefined,
  snapshots: Map<string, BaselineNodeSnapshot>
): boolean => Boolean(clientId && !snapshots.has(clientId));

export type MapEditTypeDefaultsOptions = {
  /** Keep `name_dev` (map root = project `name_dev` per `recursive_list_schema`). */
  preserve_name_dev?: boolean;
};

export const apply_map_edit_shloka_defaults = (
  node: MapNodeWithClientId,
  options?: MapEditTypeDefaultsOptions
): void => {
  if (!options?.preserve_name_dev) {
    node.name_dev = MAP_EDIT_DEFAULT_SHLOKA_NAME_DEV;
  }
  node.info = { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null };
  node.list = [];
};

export const is_childless_map_node = (node: recursive_list_type): boolean =>
  (node.list ?? []).length === 0;

/** Childless shloka nodes may convert to list at any depth, including the project root. */
export const can_convert_childless_to_list = (node: MapNodeWithClientId | null): boolean =>
  Boolean(node && node.info.type === 'shloka' && is_childless_map_node(node));

/** Childless list nodes may convert to shloka at any depth, including the project root. */
export const can_convert_childless_to_shloka = (node: MapNodeWithClientId | null): boolean =>
  Boolean(node && node.info.type === 'list' && is_childless_map_node(node));

export const apply_map_edit_list_defaults = (
  node: MapNodeWithClientId,
  options?: MapEditTypeDefaultsOptions
): void => {
  if (!options?.preserve_name_dev) {
    node.name_dev = MAP_EDIT_DEFAULT_LIST_NAME_DEV;
  }
  node.info = {
    type: 'list',
    list_name: MAP_EDIT_DEFAULT_LIST_LEVEL_NAME,
    list_count_expected: null
  };
  node.list = [];
};

export const create_map_edit_child = (kind: 'shloka' | 'list'): MapNodeWithClientId => {
  const clientId = new_client_id();
  const node: MapNodeWithClientId = {
    name_dev: '',
    info: { type: 'shloka', shloka_count: 0, total: 0, shloka_count_expected: null },
    list: [],
    [MAP_EDIT_CLIENT_ID]: clientId
  };
  if (kind === 'shloka') {
    apply_map_edit_shloka_defaults(node);
  } else {
    apply_map_edit_list_defaults(node);
  }
  return node;
};

export const parse_path_query = (raw: string | null): MapPath => {
  if (!raw?.trim()) return [];
  const parts = raw.split('/').filter(Boolean);
  const nums: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1) return [];
    nums.push(n);
  }
  return nums;
};

export const format_path_query = (path: MapPath): string => path.join('/');

export const path_label = (path: MapPath): string =>
  path.length === 0 ? '/' : `/${path.join('/')}`;

/** Compact numeric path (`/1/2/3`); `/` at project root. */
export const format_path_short_label = path_label;

/** `name_dev` from root through each path segment (length = path.length + 1). */
export const resolve_path_name_segments = (map: MapNodeWithClientId, path: MapPath): string[] => {
  const names: string[] = [map.name_dev];
  let acc: MapPath = [];
  for (const sel of path) {
    acc = [...acc, sel];
    const node = get_node_at_map_path(map, acc);
    names.push(node?.name_dev ?? String(sel));
  }
  return names;
};

/** Human-readable path using Devanagari names (breadcrumb style). */
export const format_path_resolved_label = (map: MapNodeWithClientId, path: MapPath): string =>
  resolve_path_name_segments(map, path).join(' / ');

/** DB path key (`texts.path`, etc.): colon-separated 1-based segments. */
export const map_path_to_db_path = (path: MapPath): string => path.join(':');

export const clone_recursive_list = (node: recursive_list_type): recursive_list_type =>
  JSON.parse(JSON.stringify(node)) as recursive_list_type;

export const clone_baseline_snapshots = (snapshots: Map<string, BaselineNodeSnapshot>) =>
  new Map(
    [...snapshots.entries()].map(([id, snap]) => [
      id,
      {
        ...snap,
        info: JSON.parse(JSON.stringify(snap.info)) as BaselineNodeSnapshot['info']
      }
    ])
  );

export const is_path_valid = (map: recursive_list_type, path: MapPath): boolean =>
  path.length === 0 || get_node_at_path(map, path) !== null;

export const clone_map_with_client_ids = (
  node: recursive_list_type,
  parentClientId: string | null,
  indexInParent: number,
  snapshots: Map<string, BaselineNodeSnapshot>
): MapNodeWithClientId => {
  const clientId = new_client_id();
  snapshots.set(clientId, {
    name_dev: node.name_dev,
    info: JSON.parse(JSON.stringify(node.info)) as recursive_list_type['info'],
    indexInParent,
    parentClientId
  });
  const list = node.list ?? [];
  return {
    name_dev: node.name_dev,
    info: JSON.parse(JSON.stringify(node.info)) as recursive_list_type['info'],
    [MAP_EDIT_CLIENT_ID]: clientId,
    list: list.map((child, i) => clone_map_with_client_ids(child, clientId, i, snapshots))
  };
};

export const strip_client_ids = (node: MapNodeWithClientId): recursive_list_type => {
  const { [MAP_EDIT_CLIENT_ID]: _id, list, ...rest } = node;
  return {
    ...rest,
    list: (list ?? []).map((child) => strip_client_ids(child as MapNodeWithClientId))
  };
};

/** Deep-clone while preserving client ids; safe for Svelte $state proxies (structuredClone cannot). */
export const clone_working_map = (node: MapNodeWithClientId): MapNodeWithClientId => {
  const clientId = node[MAP_EDIT_CLIENT_ID];
  const children = node.list ?? [];
  const cloned: MapNodeWithClientId = {
    name_dev: node.name_dev,
    info: JSON.parse(JSON.stringify(node.info)) as recursive_list_type['info'],
    list:
      node.info.type === 'list'
        ? children.map((child) => clone_working_map(child as MapNodeWithClientId))
        : []
  };
  if (clientId) cloned[MAP_EDIT_CLIENT_ID] = clientId;
  return cloned;
};

export const get_node_at_map_path = (
  root: MapNodeWithClientId,
  path: MapPath
): MapNodeWithClientId | null => {
  if (path.length === 0) return root;
  let node: MapNodeWithClientId = root;
  for (const sel of path) {
    if (node.info.type !== 'list') return null;
    const list = node.list ?? [];
    if (!(sel >= 1 && sel <= list.length)) return null;
    node = list[sel - 1]! as MapNodeWithClientId;
  }
  return node;
};

export const get_parent_context = (
  root: MapNodeWithClientId,
  path: MapPath
): {
  parent: MapNodeWithClientId;
  parentPath: MapPath;
  index: number;
} | null => {
  if (path.length === 0) return null;
  const parentPath = path.slice(0, -1);
  const parent = parentPath.length === 0 ? root : get_node_at_map_path(root, parentPath);
  if (!parent || parent.info.type !== 'list') return null;
  const index = path[path.length - 1]! - 1;
  const list = parent.list ?? [];
  if (index < 0 || index >= list.length) return null;
  return { parent, parentPath, index };
};

export const full_path_from_subtree_path = (basePath: MapPath, subtreePath: string): MapPath => {
  if (!subtreePath) return basePath;
  const rel = subtreePath.split('.').map((s) => Number(s));
  if (rel.some((n) => !Number.isInteger(n) || n < 1)) return basePath;
  return [...basePath, ...rel];
};

export const subtree_path_from_full = (basePath: MapPath, fullPath: MapPath): string => {
  if (fullPath.length <= basePath.length) return '';
  return fullPath.slice(basePath.length).join('.');
};

export type MapTreeRow = {
  path: string;
  id: string;
  name_dev: string;
  /** Shallowest row first in keenmate flat sort (library treats path '' as parentPath null otherwise). */
  level: number;
  parentPath: string;
  sortOrder: number;
  visibleIndex: number;
  isRoot: boolean;
  isLeaf: boolean;
  nodeType: 'list' | 'shloka';
  childCount: number;
  edited: boolean;
  moved: boolean;
  draggable: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  allowedDropPositions: ('above' | 'below')[];
};

/** Keenmate tree row shape (alias used by tree panel). */
export type MapTreeItem = MapTreeRow;

/** Subtree-relative paths that are expanded in the tree UI (always includes `''` when root is open). */
export const default_tree_expanded_paths = (): Set<string> => new Set(['']);

export const expand_tree_expanded_paths = (
  expanded: ReadonlySet<string>,
  relPath: string
): Set<string> => {
  const next = new Set(expanded);
  next.add(relPath);
  if (relPath === '') return next;
  next.add('');
  const parts = relPath.split('.');
  for (let i = 1; i < parts.length; i++) {
    next.add(parts.slice(0, i).join('.'));
  }
  return next;
};

/** Collapse `relPath` and its descendants only; other branches stay as they were. */
export const collapse_tree_expanded_paths = (
  expanded: ReadonlySet<string>,
  relPath: string
): Set<string> => {
  const next = new Set<string>();
  for (const p of expanded) {
    if (relPath === '') continue;
    if (p === relPath || p.startsWith(`${relPath}.`)) continue;
    next.add(p);
  }
  return next;
};

export const paths_equal = (a: MapPath, b: MapPath) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const full_path_for_subtree_rel = (basePath: MapPath, relPath: string): MapPath => {
  if (!relPath) return [...basePath];
  return [...basePath, ...relPath.split('.').map((s) => Number(s))];
};

/** Subtree-relative path for one level below the displayed root (`1`, not `1.2`). */
export const is_direct_child_rel_path = (relPath: string): boolean =>
  relPath !== '' && !relPath.includes('.');

export const build_tree_rows = (
  workingMap: MapNodeWithClientId,
  basePath: MapPath,
  flagsByClientId: Map<string, MapNodeDiffFlags>,
  selectedNodePath: MapPath = [],
  reorder_enabled = false,
  expandedPaths: ReadonlySet<string> = default_tree_expanded_paths(),
  reorder_direct_children_only = false
): MapTreeRow[] => {
  const rows: MapTreeRow[] = [];
  const subtreeRoot =
    basePath.length === 0 ? workingMap : get_node_at_map_path(workingMap, basePath);
  if (!subtreeRoot) return rows;

  const walk = (node: MapNodeWithClientId, relPath: string, isRoot: boolean) => {
    const clientId = node[MAP_EDIT_CLIENT_ID]!;
    const flags = flagsByClientId.get(clientId) ?? { edited: false, moved: false };
    const isLeaf = node.info.type === 'shloka';
    const list = node.list ?? [];
    const visibleIndex = relPath === '' ? 0 : Number(relPath.split('.').pop() ?? '0');
    const depth = relPath === '' ? 0 : relPath.split('.').length;
    const parentPath =
      relPath === '' ? '' : relPath.includes('.') ? relPath.slice(0, relPath.lastIndexOf('.')) : '';

    rows.push({
      path: relPath,
      id: clientId,
      name_dev: node.name_dev,
      level: depth,
      parentPath,
      sortOrder: isRoot ? -1 : visibleIndex * 10,
      visibleIndex,
      isRoot,
      isLeaf,
      nodeType: node.info.type,
      childCount: list.length,
      edited: flags.edited,
      moved: flags.moved,
      draggable:
        reorder_enabled &&
        !isRoot &&
        (!reorder_direct_children_only || is_direct_child_rel_path(relPath)),
      isSelected: paths_equal(full_path_for_subtree_rel(basePath, relPath), selectedNodePath),
      isExpanded: !isLeaf && list.length > 0 && expandedPaths.has(relPath),
      allowedDropPositions: ['above', 'below']
    });

    if (node.info.type === 'list') {
      list.forEach((child, i) => {
        const childRel = relPath === '' ? String(i + 1) : `${relPath}.${i + 1}`;
        walk(child as MapNodeWithClientId, childRel, false);
      });
    }
  };

  walk(subtreeRoot, '', true);
  return rows;
};

const count_label = (n: number | null | undefined) =>
  n === null || n === undefined ? 'empty' : String(n);

export const compute_map_edit_diff = (
  workingMap: MapNodeWithClientId,
  snapshots: Map<string, BaselineNodeSnapshot>,
  options?: { kinds?: MapChangeKind[] }
): MapEditDiffState => {
  const rows: MapChangeRow[] = [];
  const flagsByClientId = new Map<string, MapNodeDiffFlags>();
  const childrenByParent = new Map<string | null, { clientId: string; index: number }[]>();

  const walk = (node: MapNodeWithClientId, path: MapPath) => {
    const clientId = node[MAP_EDIT_CLIENT_ID]!;
    const snap = snapshots.get(clientId);
    if (!snap) {
      const label = format_path_short_label(path);
      const position = path[path.length - 1] ?? 0;
      const childKind = node.info.type === 'shloka' ? 'shloka' : 'list';
      flagsByClientId.set(clientId, { edited: true, moved: false });
      rows.push({
        kind: 'add_child',
        clientId,
        path,
        pathLabel: label,
        summary: `Added ${childKind} child at position ${position}`
      });
      if (node.info.type === 'list') {
        (node.list ?? []).forEach((child, i) => {
          walk(child as MapNodeWithClientId, [...path, i + 1]);
        });
      }
      return;
    }

    if (path.length > 0) {
      const parentKey = snap.parentClientId;
      if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
      childrenByParent.get(parentKey)!.push({
        clientId,
        index: path[path.length - 1]! - 1
      });
    }

    const label = format_path_short_label(path);
    let edited = false;

    const wInfo = node.info;
    const bInfo = snap.info;
    if (wInfo.type !== bInfo.type) {
      edited = true;
      const from = bInfo.type === 'shloka' ? 'Shloka' : 'List';
      const to = wInfo.type === 'shloka' ? 'Shloka' : 'List';
      rows.push({
        kind: 'type_change',
        clientId,
        path,
        pathLabel: label,
        summary: `Converted ${from} → ${to}`
      });
    }

    if (node.name_dev !== snap.name_dev) {
      edited = true;
      rows.push({
        kind: 'rename',
        clientId,
        path,
        pathLabel: label,
        summary: `${snap.name_dev} → ${node.name_dev}`
      });
    }

    if (wInfo.type === 'list' && bInfo.type === 'list' && path.length > 0) {
      if (wInfo.list_name !== bInfo.list_name) {
        edited = true;
        rows.push({
          kind: 'list_name_change',
          clientId,
          path,
          pathLabel: label,
          summary: `${bInfo.list_name} → ${wInfo.list_name}`
        });
      }
      if (wInfo.list_count_expected !== bInfo.list_count_expected) {
        edited = true;
        rows.push({
          kind: 'expected_count_change',
          clientId,
          path,
          pathLabel: label,
          summary: `${count_label(bInfo.list_count_expected)} → ${count_label(wInfo.list_count_expected)}`
        });
      }
    } else if (wInfo.type === 'list' && bInfo.type === 'list' && path.length === 0) {
      if (wInfo.list_name !== bInfo.list_name) {
        edited = true;
        rows.push({
          kind: 'list_name_change',
          clientId,
          path,
          pathLabel: label,
          summary: `${bInfo.list_name} → ${wInfo.list_name}`
        });
      }
      if (wInfo.list_count_expected !== bInfo.list_count_expected) {
        edited = true;
        rows.push({
          kind: 'expected_count_change',
          clientId,
          path,
          pathLabel: label,
          summary: `${count_label(bInfo.list_count_expected)} → ${count_label(wInfo.list_count_expected)}`
        });
      }
    }

    flagsByClientId.set(clientId, { edited, moved: false });

    if (node.info.type === 'list') {
      (node.list ?? []).forEach((child, i) => {
        walk(child as MapNodeWithClientId, [...path, i + 1]);
      });
    }
  };

  walk(workingMap, []);

  let reorderedParentCount = 0;
  for (const [parentKey, currentChildren] of childrenByParent) {
    const baselineOrder = [...currentChildren].sort(
      (a, b) =>
        (snapshots.get(a.clientId)?.indexInParent ?? 0) -
        (snapshots.get(b.clientId)?.indexInParent ?? 0)
    );
    const currentOrder = currentChildren.map((c) => c.clientId);
    const baselineIds = baselineOrder.map((c) => c.clientId);
    if (baselineIds.join() === currentOrder.join()) continue;

    reorderedParentCount += 1;
    const parentPath =
      parentKey === null ? [] : (find_path_by_client_id(workingMap, parentKey) ?? []);
    const parentNode =
      parentKey === null ? workingMap : get_node_at_map_path(workingMap, parentPath);
    const parentName = parentNode?.name_dev ?? 'root';

    for (const clientId of currentOrder) {
      const oldPos = baselineIds.indexOf(clientId) + 1;
      const newPos = currentOrder.indexOf(clientId) + 1;
      if (oldPos === newPos) continue;
      const node = find_node_by_client_id(workingMap, clientId);
      if (!node) continue;
      flagsByClientId.set(clientId, {
        edited: flagsByClientId.get(clientId)?.edited ?? false,
        moved: true
      });
      const nodePath = find_path_by_client_id(workingMap, clientId) ?? [];
      rows.push({
        kind: 'reorder',
        clientId,
        path: nodePath,
        pathLabel: format_path_short_label(nodePath),
        summary: `Moved ${oldPos}. ${node.name_dev} to position ${newPos} under ${parentName}`
      });
    }
  }

  const filtered_rows = options?.kinds ? rows.filter((r) => options.kinds!.includes(r.kind)) : rows;
  const filtered_flags = new Map<string, MapNodeDiffFlags>();
  for (const row of filtered_rows) {
    const prev = flagsByClientId.get(row.clientId) ?? { edited: false, moved: false };
    filtered_flags.set(row.clientId, {
      edited: row.kind !== 'reorder' || prev.edited,
      moved: row.kind === 'reorder' || prev.moved
    });
  }
  if (!options?.kinds) {
    for (const [id, flags] of flagsByClientId) {
      if (!filtered_flags.has(id)) filtered_flags.set(id, flags);
    }
  }

  const changedClientIds = new Set(filtered_rows.map((r) => r.clientId));
  return {
    dirty: filtered_rows.length > 0,
    changedNodeCount: changedClientIds.size,
    renameCount: filtered_rows.filter((r) => r.kind === 'rename').length,
    reorderedParentCount: options?.kinds
      ? filtered_rows.some((r) => r.kind === 'reorder')
        ? 1
        : 0
      : reorderedParentCount,
    rows: filtered_rows,
    flagsByClientId: options?.kinds ? filtered_flags : flagsByClientId
  };
};

export const collect_unsaved_added_db_paths = (
  root: MapNodeWithClientId,
  snapshots: Map<string, BaselineNodeSnapshot>
): string[] => {
  const paths = new Set<string>();
  const walk = (node: MapNodeWithClientId, path: MapPath) => {
    const clientId = node[MAP_EDIT_CLIENT_ID];
    if (path.length > 0 && is_unsaved_added_map_node(clientId, snapshots)) {
      paths.add(map_path_to_db_path(path));
    }
    if (node.info.type === 'list') {
      (node.list ?? []).forEach((child, index) => {
        walk(child as MapNodeWithClientId, [...path, index + 1]);
      });
    }
  };
  walk(root, []);
  return [...paths].sort((a, b) => a.split(':').length - b.split(':').length || a.localeCompare(b));
};

export const find_node_by_client_id = (
  root: MapNodeWithClientId,
  clientId: string
): MapNodeWithClientId | null => {
  if (root[MAP_EDIT_CLIENT_ID] === clientId) return root;
  if (root.info.type !== 'list') return null;
  for (const child of root.list ?? []) {
    const found = find_node_by_client_id(child as MapNodeWithClientId, clientId);
    if (found) return found;
  }
  return null;
};

export const find_path_by_client_id = (
  root: MapNodeWithClientId,
  clientId: string,
  path: MapPath = []
): MapPath | null => {
  if (root[MAP_EDIT_CLIENT_ID] === clientId) return path;
  if (root.info.type !== 'list') return null;
  const list = root.list ?? [];
  for (let i = 0; i < list.length; i++) {
    const found = find_path_by_client_id(list[i]! as MapNodeWithClientId, clientId, [
      ...path,
      i + 1
    ]);
    if (found) return found;
  }
  return null;
};

export const reorder_siblings = (
  root: MapNodeWithClientId,
  parentPath: MapPath,
  fromIndex: number,
  toIndex: number
): boolean => {
  const parent = parentPath.length === 0 ? root : get_node_at_map_path(root, parentPath);
  if (!parent || parent.info.type !== 'list') return false;
  const list = [...(parent.list ?? [])];
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
    return false;
  }
  if (fromIndex === toIndex) return false;
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item!);
  parent.list = list;
  return true;
};

export const get_breadcrumb_segments = (
  map: MapNodeWithClientId,
  basePath: MapPath
): { path: MapPath; label: string }[] => {
  const segments: { path: MapPath; label: string }[] = [
    { path: [], label: resolve_path_name_segments(map, [])[0] ?? map.name_dev }
  ];
  let acc: MapPath = [];
  for (const sel of basePath) {
    acc = [...acc, sel];
    const names = resolve_path_name_segments(map, acc);
    segments.push({ path: [...acc], label: names[names.length - 1] ?? `/${sel}` });
  }
  return segments;
};

export const parse_optional_count = (raw: string): number | null | 'invalid' => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return 'invalid';
  return n;
};

export const is_ancestor_path = (ancestor: MapPath, descendant: MapPath): boolean => {
  if (descendant.length <= ancestor.length) return false;
  return ancestor.every((v, i) => v === descendant[i]);
};

/** Removes a node at `path`; returns false for project root or invalid paths. */
export const remove_node_at_path = (root: MapNodeWithClientId, path: MapPath): boolean => {
  if (path.length === 0) return false;
  const ctx = get_parent_context(root, path);
  if (!ctx) return false;
  const list = [...(ctx.parent.list ?? [])];
  list.splice(ctx.index, 1);
  ctx.parent.list = list;
  return true;
};

/** Paths in `entryMap` whose client ids no longer exist in `workingMap`. */
const collect_client_ids = (root: MapNodeWithClientId): Set<string> => {
  const ids = new Set<string>();
  const walk = (node: MapNodeWithClientId) => {
    const clientId = node[MAP_EDIT_CLIENT_ID];
    if (clientId) ids.add(clientId);
    if (node.info.type === 'list') {
      (node.list ?? []).forEach((child) => walk(child as MapNodeWithClientId));
    }
  };
  walk(root);
  return ids;
};

export const collect_deleted_paths_from_entry = (
  entryMap: MapNodeWithClientId,
  workingMap: MapNodeWithClientId,
  path: MapPath = []
): MapPath[] => {
  const workingClientIds = collect_client_ids(workingMap);
  const deleted: MapPath[] = [];
  const walk = (entryNode: MapNodeWithClientId, p: MapPath) => {
    const clientId = entryNode[MAP_EDIT_CLIENT_ID];
    if (!clientId) return;
    if (!workingClientIds.has(clientId)) {
      deleted.push(p);
      return;
    }
    if (entryNode.info.type === 'list') {
      (entryNode.list ?? []).forEach((child, i) => {
        walk(child as MapNodeWithClientId, [...p, i + 1]);
      });
    }
  };
  walk(entryMap, path);
  return deleted;
};

export const minimize_deleted_paths = (paths: MapPath[]): MapPath[] => {
  const sorted = [...paths].sort((a, b) => a.length - b.length);
  const result: MapPath[] = [];
  for (const path of sorted) {
    if (result.some((prefix) => is_ancestor_path(prefix, path))) continue;
    result.push(path);
  }
  return result;
};

/** Leaf shloka nodes and childless list nodes under each deleted root. */
export const expand_terminal_deleted_paths = (
  entryMap: MapNodeWithClientId,
  deletedRoots: MapPath[]
): MapPath[] => {
  const roots = minimize_deleted_paths(deletedRoots);
  const seen = new Set<string>();
  const terminals: MapPath[] = [];

  const walk = (node: MapNodeWithClientId, path: MapPath) => {
    if (node.info.type === 'shloka') {
      const key = path.join(':');
      if (!seen.has(key)) {
        seen.add(key);
        terminals.push(path);
      }
      return;
    }
    const children = node.list ?? [];
    if (children.length === 0) {
      const key = path.join(':');
      if (!seen.has(key)) {
        seen.add(key);
        terminals.push(path);
      }
      return;
    }
    children.forEach((child, i) => {
      walk(child as MapNodeWithClientId, [...path, i + 1]);
    });
  };

  for (const root of roots) {
    const node = get_node_at_map_path(entryMap, root);
    if (node) walk(node, root);
  }
  return terminals;
};

export type DeleteReviewRow = {
  path: MapPath;
  pathLabel: string;
  resolvedLabel: string;
  nodeType: 'list' | 'shloka';
};

export type DeleteReviewState = {
  deletedRoots: MapPath[];
  terminalPaths: MapPath[];
  rows: DeleteReviewRow[];
};

export const build_delete_review_state = (
  entryMap: MapNodeWithClientId,
  workingMap: MapNodeWithClientId
): DeleteReviewState => {
  const deletedRoots = collect_deleted_paths_from_entry(entryMap, workingMap);
  const terminalPaths = expand_terminal_deleted_paths(entryMap, deletedRoots);
  const rows = terminalPaths.map((path) => {
    const node = get_node_at_map_path(entryMap, path)!;
    return {
      path,
      pathLabel: format_path_short_label(path),
      resolvedLabel: format_path_resolved_label(entryMap, path),
      nodeType: node.info.type
    };
  });
  return { deletedRoots, terminalPaths, rows };
};

// ---------------------------------------------------------------------------
// Undo stack — immer patch-based (stores inversePatches, not full clones)
// ---------------------------------------------------------------------------

import { enablePatches, produceWithPatches, applyPatches, setAutoFreeze, type Patch } from 'immer';

// Must be called once to activate patch tracking in immer.
enablePatches();
setAutoFreeze(false);

export { produceWithPatches, applyPatches, type Patch };

export const UNDO_MAX_DEPTH = 50;

/** Inverse patches that reverse one metadata edit, plus the selection to restore. */
export type MetadataUndoEntry = {
  inversePatches: Patch[];
  selectedNodePath: MapPath;
};

/** Inverse patches that reverse one order edit, plus swaps and selection to restore. */
export type OrderUndoEntry = {
  inversePatches: Patch[];
  pendingSwaps: import('~/server/map_path_swap').PathSwapEdit[];
  selectedNodePath: MapPath;
};

/** Inverse patches that reverse one delete operation, plus selection to restore. */
export type DeleteUndoEntry = {
  inversePatches: Patch[];
  selectedNodePath: MapPath;
};

/**
 * Generic undo stack with a configurable max depth.
 * Framework-agnostic — the Svelte component wraps this in reactive state.
 */
export class UndoStack<T> {
  private _stack: T[] = [];
  private _maxDepth: number;

  constructor(maxDepth: number = UNDO_MAX_DEPTH) {
    this._maxDepth = maxDepth;
  }

  /** Push an entry onto the stack. */
  push(entry: T): void {
    this._stack.push(entry);
    if (this._stack.length > this._maxDepth) {
      this._stack.splice(0, this._stack.length - this._maxDepth);
    }
  }

  /** Pop and return the most recent entry, or `null` if empty. */
  undo(): T | null {
    return this._stack.pop() ?? null;
  }

  /** Peek at the most recent entry without removing it. */
  peek(): T | null {
    return this._stack[this._stack.length - 1] ?? null;
  }

  clear(): void {
    this._stack = [];
  }

  get canUndo(): boolean {
    return this._stack.length > 0;
  }

  get size(): number {
    return this._stack.length;
  }
}
