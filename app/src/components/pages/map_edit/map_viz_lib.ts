import {
  collapse_tree_expanded_paths,
  expand_tree_expanded_paths,
  format_path_short_label,
  type MapNodeWithClientId,
  type MapPath
} from './map_edit_lib';

export const MAP_VIZ_NODE_WIDTH = 220;
export const MAP_VIZ_NODE_HEIGHT_LIST = 92;
export const MAP_VIZ_NODE_HEIGHT_LEAF = 76;
export const MAP_VIZ_H_SPACING = 28;
export const MAP_VIZ_V_SPACING = 72;

export type MapVizNodeKind = 'leaf' | 'list' | 'empty-list';

export type MapVizThemeColors = {
  fill: string;
  border: string;
  text: string;
  subtitle: string;
};

/** Node card colors aligned with `map_edit_tree.css` green / amber / red semantics. */
export const MAP_VIZ_COLORS: Record<
  MapVizNodeKind,
  { light: MapVizThemeColors; dark: MapVizThemeColors }
> = {
  leaf: {
    light: { fill: '#e8f5ec', border: '#3d8f5a', text: '#1a4d2e', subtitle: '#2d6b45' },
    dark: { fill: '#1e3d2a', border: '#6bc78a', text: '#d4f0de', subtitle: '#a8ddb8' }
  },
  list: {
    light: { fill: '#fdf0e4', border: '#c46a1a', text: '#5c3208', subtitle: '#8a4f12' },
    dark: { fill: '#3d2a18', border: '#e8a04a', text: '#fce8cc', subtitle: '#e8c48a' }
  },
  'empty-list': {
    light: { fill: '#fdeeed', border: '#c43d3d', text: '#5c1414', subtitle: '#8a2828' },
    dark: { fill: '#3d1e1e', border: '#e86a6a', text: '#fce0e0', subtitle: '#e8a0a0' }
  }
};

export type MapVizNodeMeta = {
  pathKey: string;
  mapPath: MapPath;
  relPath: string;
  name_dev: string;
  kind: MapVizNodeKind;
  isRoot: boolean;
  hasChildren: boolean;
  isExpandable: boolean;
  isExpanded: boolean;
  lines: string[];
};

export type MapVizPlacedNode = MapVizNodeMeta & {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export type MapVizEdge = {
  from: string;
  to: string;
  points: number[];
};

export type MapVizLayoutResult = {
  nodes: MapVizPlacedNode[];
  edges: MapVizEdge[];
  width: number;
  height: number;
};

export const map_viz_node_kind = (node: MapNodeWithClientId): MapVizNodeKind => {
  if (node.info.type === 'shloka') return 'leaf';
  return (node.list ?? []).length === 0 ? 'empty-list' : 'list';
};

export const map_viz_subtitle_lines = (
  node: MapNodeWithClientId,
  kind: MapVizNodeKind
): string[] => {
  if (kind === 'leaf' && node.info.type === 'shloka') {
    const lines = [`Shlokas: ${node.info.shloka_count}`, `Total: ${node.info.total}`];
    if (node.info.shloka_count_expected != null) {
      lines.push(`Expected shlokas: ${node.info.shloka_count_expected}`);
    }
    return lines;
  }
  if (node.info.type === 'list') {
    const count = node.list?.length ?? 0;
    const lines = [`Level: ${node.info.list_name}`, `Children: ${count}`];
    if (node.info.list_count_expected != null) {
      lines.push(`Expected children: ${node.info.list_count_expected}`);
    }
    return lines;
  }
  return [];
};

/** Every subtree-relative path in the map (includes root `''`). */
export const all_map_viz_rel_paths = (root: MapNodeWithClientId): string[] => {
  const paths: string[] = [''];
  const walk = (node: MapNodeWithClientId, relPath: string) => {
    if (node.info.type !== 'list') return;
    (node.list ?? []).forEach((child, i) => {
      const childRel = relPath === '' ? String(i + 1) : `${relPath}.${i + 1}`;
      paths.push(childRel);
      walk(child as MapNodeWithClientId, childRel);
    });
  };
  walk(root, '');
  return paths;
};

/** Expand every list branch that has children. */
export const expand_all_map_viz_paths = (root: MapNodeWithClientId): Set<string> => {
  const paths = new Set<string>(['']);
  const walk = (node: MapNodeWithClientId, relPath: string) => {
    if (node.info.type !== 'list') return;
    const list = node.list ?? [];
    if (list.length === 0) return;
    list.forEach((child, i) => {
      const childRel = relPath === '' ? String(i + 1) : `${relPath}.${i + 1}`;
      paths.add(childRel);
      walk(child as MapNodeWithClientId, childRel);
    });
  };
  walk(root, '');
  return paths;
};

export const toggle_map_viz_expanded_path = (
  expanded: ReadonlySet<string>,
  relPath: string,
  shouldExpand: boolean
): Set<string> =>
  shouldExpand
    ? expand_tree_expanded_paths(expanded, relPath)
    : collapse_tree_expanded_paths(expanded, relPath);

const map_viz_node_height = (kind: MapVizNodeKind) =>
  kind === 'leaf' ? MAP_VIZ_NODE_HEIGHT_LEAF : MAP_VIZ_NODE_HEIGHT_LIST;

export const build_map_viz_layout = (
  root: MapNodeWithClientId,
  expandedRelPaths: ReadonlySet<string>
): MapVizLayoutResult => {
  type LayoutTree = {
    meta: MapVizNodeMeta;
    children: LayoutTree[];
    subtreeWidth: number;
    x: number;
    y: number;
  };

  const build_tree = (
    node: MapNodeWithClientId,
    mapPath: MapPath,
    relPath: string,
    isRoot: boolean
  ): LayoutTree => {
    const kind = map_viz_node_kind(node);
    const list = node.list ?? [];
    const hasChildren = node.info.type === 'list' && list.length > 0;
    const isExpanded = hasChildren && expandedRelPaths.has(relPath);
    const meta: MapVizNodeMeta = {
      pathKey: format_path_short_label(mapPath),
      mapPath: [...mapPath],
      relPath,
      name_dev: node.name_dev,
      kind,
      isRoot,
      hasChildren,
      isExpandable: hasChildren,
      isExpanded,
      lines: map_viz_subtitle_lines(node, kind)
    };
    const children: LayoutTree[] = [];
    if (isExpanded) {
      list.forEach((child, i) => {
        const childMapPath = [...mapPath, i + 1];
        const childRel = relPath === '' ? String(i + 1) : `${relPath}.${i + 1}`;
        children.push(build_tree(child as MapNodeWithClientId, childMapPath, childRel, false));
      });
    }
    return { meta, children, subtreeWidth: 0, x: 0, y: 0 };
  };

  const assign_widths = (tree: LayoutTree): number => {
    if (tree.children.length === 0) {
      tree.subtreeWidth = MAP_VIZ_NODE_WIDTH;
      return tree.subtreeWidth;
    }
    let total = 0;
    for (const child of tree.children) {
      total += assign_widths(child);
    }
    total += MAP_VIZ_H_SPACING * (tree.children.length - 1);
    tree.subtreeWidth = Math.max(MAP_VIZ_NODE_WIDTH, total);
    return tree.subtreeWidth;
  };

  const assign_positions = (tree: LayoutTree, left: number, depth: number) => {
    tree.x = left + tree.subtreeWidth / 2 - MAP_VIZ_NODE_WIDTH / 2;
    tree.y = depth * (MAP_VIZ_NODE_HEIGHT_LIST + MAP_VIZ_V_SPACING);
    if (tree.children.length === 0) return;
    let childLeft = left;
    for (const child of tree.children) {
      assign_positions(child, childLeft, depth + 1);
      childLeft += child.subtreeWidth + MAP_VIZ_H_SPACING;
    }
  };

  const tree = build_tree(root, [], '', true);
  assign_widths(tree);
  assign_positions(tree, 0, 0);

  const nodes: MapVizPlacedNode[] = [];
  const edges: MapVizEdge[] = [];

  const flatten = (t: LayoutTree, parent?: LayoutTree) => {
    const height = map_viz_node_height(t.meta.kind);
    const placed: MapVizPlacedNode = {
      ...t.meta,
      x: t.x,
      y: t.y,
      width: MAP_VIZ_NODE_WIDTH,
      height,
      centerX: t.x + MAP_VIZ_NODE_WIDTH / 2,
      centerY: t.y + height / 2
    };
    nodes.push(placed);
    if (parent) {
      const parentHeight = map_viz_node_height(parent.meta.kind);
      const px = parent.x + MAP_VIZ_NODE_WIDTH / 2;
      const py = parent.y + parentHeight;
      const cx = placed.centerX;
      const cy = placed.y;
      const midY = (py + cy) / 2;
      edges.push({
        from: parent.meta.pathKey,
        to: placed.pathKey,
        points: [px, py, px, midY, cx, midY, cx, cy]
      });
    }
    for (const child of t.children) {
      flatten(child, t);
    }
  };
  flatten(tree);

  const maxX = Math.max(...nodes.map((n) => n.x + n.width), MAP_VIZ_NODE_WIDTH);
  const maxY = Math.max(...nodes.map((n) => n.y + n.height), MAP_VIZ_NODE_HEIGHT_LIST);

  return {
    nodes,
    edges,
    width: maxX + MAP_VIZ_H_SPACING,
    height: maxY + MAP_VIZ_V_SPACING
  };
};
