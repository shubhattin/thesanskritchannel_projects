import type { recursive_list_type } from '~/state/data_types';
import { get_node_at_path } from '~/state/project_list';

export const MAP_EDIT_CLIENT_ID = '__mapEditClientId' as const;

export type MapNodeWithClientId = recursive_list_type & {
  [MAP_EDIT_CLIENT_ID]?: string;
};

export type MapPath = number[];

export type MapChangeKind = 'rename' | 'list_name_change' | 'expected_count_change' | 'reorder';

export type MapChangeRow = {
  kind: MapChangeKind;
  clientId: string;
  path: MapPath;
  /** Short numeric path (`//1/2`); kept for backwards-compatible summaries. */
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

/** Compact numeric path for lists (`//1/2/3`); `/` at project root. */
export const format_path_short_label = (path: MapPath): string =>
  path.length === 0 ? '/' : `//${path.join('/')}`;

/** `name_dev` from root through each path segment (length = path.length + 1). */
export const resolve_path_name_segments = (
  map: MapNodeWithClientId,
  path: MapPath
): string[] => {
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
export const format_path_resolved_label = (
  map: MapNodeWithClientId,
  path: MapPath
): string => resolve_path_name_segments(map, path).join(' / ');

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

const paths_equal = (a: MapPath, b: MapPath) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const full_path_for_subtree_rel = (basePath: MapPath, relPath: string): MapPath => {
  if (!relPath) return [...basePath];
  return [...basePath, ...relPath.split('.').map((s) => Number(s))];
};

export const build_tree_rows = (
  workingMap: MapNodeWithClientId,
  basePath: MapPath,
  flagsByClientId: Map<string, MapNodeDiffFlags>,
  selectedNodePath: MapPath = [],
  reorder_enabled = false,
  expandedPaths: ReadonlySet<string> = default_tree_expanded_paths()
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
      draggable: reorder_enabled && !isRoot,
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
    if (!snap) return;

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

    if (node.name_dev !== snap.name_dev) {
      edited = true;
      rows.push({
        kind: 'rename',
        clientId,
        path,
        pathLabel: label,
        summary: `Renamed "${snap.name_dev}" to "${node.name_dev}"`
      });
    }

    const wInfo = node.info;
    const bInfo = snap.info;
    if (wInfo.type === 'list' && bInfo.type === 'list' && path.length > 0) {
      if (wInfo.list_name !== bInfo.list_name) {
        edited = true;
        rows.push({
          kind: 'list_name_change',
          clientId,
          path,
          pathLabel: label,
          summary: `Changed list label from "${bInfo.list_name}" to "${wInfo.list_name}"`
        });
      }
      if (wInfo.list_count_expected !== bInfo.list_count_expected) {
        edited = true;
        rows.push({
          kind: 'expected_count_change',
          clientId,
          path,
          pathLabel: label,
          summary: `Updated expected count from ${count_label(bInfo.list_count_expected)} to ${count_label(wInfo.list_count_expected)}`
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
          summary: `Changed list label from "${bInfo.list_name}" to "${wInfo.list_name}"`
        });
      }
      if (wInfo.list_count_expected !== bInfo.list_count_expected) {
        edited = true;
        rows.push({
          kind: 'expected_count_change',
          clientId,
          path,
          pathLabel: label,
          summary: `Updated expected count from ${count_label(bInfo.list_count_expected)} to ${count_label(wInfo.list_count_expected)}`
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
