<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { mode } from 'mode-watcher';
  import { Stage, Layer, Group, Rect, Line, Text } from 'svelte-konva';
  import type Konva from 'konva';
  import type { KonvaEventObject } from 'konva/lib/Node';
  import {
    Network,
    ZoomIn,
    ZoomOut,
    Maximize2,
    ChevronsDownUp,
    ChevronsUpDown
  } from '@lucide/svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { default_tree_expanded_paths, type MapNodeWithClientId } from './map_edit_lib';
  import {
    MAP_VIZ_COLORS,
    MAP_VIZ_NODE_WIDTH,
    build_map_viz_layout,
    expand_all_map_viz_paths,
    toggle_map_viz_expanded_path,
    type MapVizPlacedNode,
    type MapVizThemeColors
  } from './map_viz_lib';

  let {
    open = $bindable(false),
    workingMap,
    project_name_dev
  }: {
    open?: boolean;
    workingMap: MapNodeWithClientId | null;
    project_name_dev: string;
  } = $props();

  let mounted = $state(false);
  let viewport_el = $state<HTMLDivElement | null>(null);
  let viewport_w = $state(720);
  let viewport_h = $state(480);
  let stage_component = $state<{ node: Konva.Stage } | null>(null);

  let expanded_paths = $state<Set<string>>(default_tree_expanded_paths());
  let scale = $state(1);
  let stage_pos = $state({ x: 0, y: 0 });
  let pan_start = $state<{ x: number; y: number; stageX: number; stageY: number } | null>(null);
  let pinch_start = $state<{
    distance: number;
    scale: number;
    pointer: { x: number; y: number };
  } | null>(null);

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2.5;
  const ZOOM_BUTTON_STEP = 1.06;
  const ZOOM_WHEEL_SENSITIVITY = 0.00065;
  const ZOOM_PINCH_SENSITIVITY = 0.0025;
  const ZOOM_MAX_STEP_MOUSE = 0.08;
  const ZOOM_MAX_STEP_PINCH = 0.03;

  const is_dark = $derived(mode.current === 'dark');

  const layout = $derived.by(() => {
    if (!workingMap) {
      return { nodes: [], edges: [], width: MAP_VIZ_NODE_WIDTH, height: 120 };
    }
    return build_map_viz_layout(workingMap, expanded_paths);
  });

  const content_bounds = $derived.by(() => {
    if (layout.nodes.length === 0) {
      return { x: 0, y: 0, width: layout.width, height: layout.height };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of layout.nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, MAP_VIZ_NODE_WIDTH),
      height: Math.max(maxY - minY, 120)
    };
  });

  const node_colors = (kind: MapVizPlacedNode['kind']): MapVizThemeColors => {
    const palette = MAP_VIZ_COLORS[kind];
    return is_dark ? palette.dark : palette.light;
  };

  const connector_stroke = $derived(is_dark ? '#6b7280' : '#a8a29e');

  function colors_for(node: MapVizPlacedNode) {
    return node_colors(node.kind);
  }

  function reset_view_state() {
    expanded_paths = default_tree_expanded_paths();
    scale = 1;
    stage_pos = { x: 0, y: 0 };
    pan_start = null;
    pinch_start = null;
  }

  function apply_zoom_at(pointer: { x: number; y: number }, nextScale: number) {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextScale));
    const point_to = {
      x: (pointer.x - stage_pos.x) / scale,
      y: (pointer.y - stage_pos.y) / scale
    };
    stage_pos = {
      x: pointer.x - point_to.x * next,
      y: pointer.y - point_to.y * next
    };
    scale = next;
  }

  function zoom_factor_from_delta(deltaY: number, is_pinch: boolean) {
    const sensitivity = is_pinch ? ZOOM_PINCH_SENSITIVITY : ZOOM_WHEEL_SENSITIVITY;
    const max_step = is_pinch ? ZOOM_MAX_STEP_PINCH : ZOOM_MAX_STEP_MOUSE;
    const factor = Math.exp(-deltaY * sensitivity);
    return Math.max(1 - max_step, Math.min(1 + max_step, factor));
  }

  function fit_view() {
    const bounds = content_bounds;
    if (!bounds.width || !bounds.height || !viewport_w || !viewport_h) return;
    const padding = 56;
    const sx = (viewport_w - padding * 2) / bounds.width;
    const sy = (viewport_h - padding * 2) / bounds.height;
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(sx, sy)));
    scale = next;
    stage_pos = {
      x: (viewport_w - bounds.width * next) / 2 - bounds.x * next,
      y: (viewport_h - bounds.height * next) / 2 - bounds.y * next
    };
  }

  function schedule_fit_view() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => fit_view());
    });
  }

  function zoom_by(factor: number) {
    apply_zoom_at({ x: viewport_w / 2, y: viewport_h / 2 }, scale * factor);
  }

  function handle_wheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stage_component?.node;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const is_pinch = e.evt.ctrlKey;
    const factor = zoom_factor_from_delta(e.evt.deltaY, is_pinch);
    apply_zoom_at(pointer, scale * factor);
  }

  function touch_distance(touches: TouchList) {
    const dx = touches[0]!.clientX - touches[1]!.clientX;
    const dy = touches[0]!.clientY - touches[1]!.clientY;
    return Math.hypot(dx, dy);
  }

  function touch_center_in_viewport(touches: TouchList) {
    const rect = viewport_el?.getBoundingClientRect();
    if (!rect) return { x: viewport_w / 2, y: viewport_h / 2 };
    return {
      x: (touches[0]!.clientX + touches[1]!.clientX) / 2 - rect.left,
      y: (touches[0]!.clientY + touches[1]!.clientY) / 2 - rect.top
    };
  }

  function handle_touch_start(e: TouchEvent) {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    pan_start = null;
    pinch_start = {
      distance: touch_distance(e.touches),
      scale,
      pointer: touch_center_in_viewport(e.touches)
    };
  }

  function handle_touch_move(e: TouchEvent) {
    if (!pinch_start || e.touches.length !== 2) return;
    e.preventDefault();
    const distance = touch_distance(e.touches);
    if (distance < 8) return;
    const ratio = distance / pinch_start.distance;
    const damped = 1 + (ratio - 1) * 0.55;
    const pointer = touch_center_in_viewport(e.touches);
    apply_zoom_at(pointer, pinch_start.scale * damped);
  }

  function handle_touch_end(e: TouchEvent) {
    if (e.touches.length < 2) pinch_start = null;
  }

  function handle_stage_pointerdown(e: KonvaEventObject<PointerEvent>) {
    if (e.target !== stage_component?.node) return;
    const stage = stage_component?.node;
    if (!stage) return;
    stage.setPointersPositions(e.evt);
    const pos = stage.getPointerPosition();
    if (!pos) return;
    pan_start = { x: pos.x, y: pos.y, stageX: stage_pos.x, stageY: stage_pos.y };
  }

  function handle_stage_pointermove(e: KonvaEventObject<PointerEvent>) {
    if (!pan_start) return;
    const stage = stage_component?.node;
    if (!stage) return;
    stage.setPointersPositions(e.evt);
    const pos = stage.getPointerPosition();
    if (!pos) return;
    stage_pos = {
      x: pan_start.stageX + (pos.x - pan_start.x),
      y: pan_start.stageY + (pos.y - pan_start.y)
    };
  }

  function handle_stage_pointerup() {
    pan_start = null;
  }

  function toggle_node(node: MapVizPlacedNode) {
    if (!node.isExpandable) return;
    expanded_paths = toggle_map_viz_expanded_path(expanded_paths, node.relPath, !node.isExpanded);
  }

  function expand_all() {
    if (!workingMap) return;
    expanded_paths = expand_all_map_viz_paths(workingMap);
  }

  function collapse_all() {
    expanded_paths = default_tree_expanded_paths();
  }

  $effect(() => {
    if (open) {
      reset_view_state();
      schedule_fit_view();
    }
  });

  $effect(() => {
    void layout.nodes.length;
    void content_bounds.width;
    void content_bounds.height;
    void viewport_w;
    void viewport_h;
    if (open && mounted) {
      schedule_fit_view();
    }
  });

  onMount(() => {
    mounted = true;
    return () => {
      mounted = false;
    };
  });

  $effect(() => {
    const el = viewport_el;
    if (!el) return;

    const measure = () => {
      viewport_w = Math.max(320, Math.floor(el.clientWidth));
      viewport_h = Math.max(320, Math.floor(el.clientHeight));
    };

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    measure();

    el.addEventListener('touchstart', handle_touch_start, { passive: false });
    el.addEventListener('touchmove', handle_touch_move, { passive: false });
    el.addEventListener('touchend', handle_touch_end);
    el.addEventListener('touchcancel', handle_touch_end);

    return () => {
      ro.disconnect();
      el.removeEventListener('touchstart', handle_touch_start);
      el.removeEventListener('touchmove', handle_touch_move);
      el.removeEventListener('touchend', handle_touch_end);
      el.removeEventListener('touchcancel', handle_touch_end);
    };
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="flex h-[min(94vh,58rem)] flex-col gap-0 overflow-hidden p-0"
    style="width: calc(100vw - 2rem); max-width: calc(100vw - 2rem);"
  >
    <Dialog.Header class="shrink-0 space-y-1 border-b border-border/60 px-4 pt-4 pb-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Network class="size-4" />
          </div>
          <div>
            <Dialog.Title class="text-base">Map visualization</Dialog.Title>
            <Dialog.Description class="text-sm">{project_name_dev}</Dialog.Description>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            class="border-emerald-500/35 text-[10px] text-emerald-700 dark:text-emerald-300"
          >
            Shloka
          </Badge>
          <Badge
            variant="outline"
            class="border-amber-600/35 text-[10px] text-amber-800 dark:text-amber-200"
          >
            List
          </Badge>
          <Badge variant="outline" class="border-destructive/35 text-[10px] text-destructive">
            Empty list
          </Badge>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        Read-only view of the current map. Click a list node to expand or collapse. Drag the canvas
        background to pan; scroll to zoom.
      </p>
    </Dialog.Header>

    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2">
      <Button type="button" variant="outline" size="sm" onclick={() => zoom_by(ZOOM_BUTTON_STEP)}>
        <ZoomIn class="mr-1 size-3.5" />
        Zoom in
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onclick={() => zoom_by(1 / ZOOM_BUTTON_STEP)}
      >
        <ZoomOut class="mr-1 size-3.5" />
        Zoom out
      </Button>
      <Button type="button" variant="outline" size="sm" onclick={fit_view}>
        <Maximize2 class="mr-1 size-3.5" />
        Fit view
      </Button>
      <Button type="button" variant="outline" size="sm" onclick={expand_all} disabled={!workingMap}>
        <ChevronsUpDown class="mr-1 size-3.5" />
        Expand all
      </Button>
      <Button type="button" variant="outline" size="sm" onclick={collapse_all}>
        <ChevronsDownUp class="mr-1 size-3.5" />
        Collapse all
      </Button>
      <span class="ms-auto text-xs text-muted-foreground tabular-nums">
        {layout.nodes.length} node{layout.nodes.length === 1 ? '' : 's'} visible
      </span>
    </div>

    <div
      bind:this={viewport_el}
      class="min-h-0 flex-1 touch-none bg-muted/20"
      style="min-height: min(70vh, 42rem);"
      role="presentation"
    >
      {#if browser && mounted && workingMap}
        <Stage
          bind:this={stage_component}
          width={viewport_w}
          height={viewport_h}
          onwheel={handle_wheel}
          onpointerdown={handle_stage_pointerdown}
          onpointermove={handle_stage_pointermove}
          onpointerup={handle_stage_pointerup}
          onpointerleave={handle_stage_pointerup}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={viewport_w}
              height={viewport_h}
              fill={is_dark ? '#18181b' : '#fafaf9'}
              listening={false}
            />
            <Group x={stage_pos.x} y={stage_pos.y} scaleX={scale} scaleY={scale}>
              {#each layout.edges as edge (edge.to)}
                <Line
                  points={edge.points}
                  stroke={connector_stroke}
                  strokeWidth={1.5}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              {/each}

              {#each layout.nodes as node (node.pathKey)}
                {@const colors = colors_for(node)}
                <Group
                  x={node.x}
                  y={node.y}
                  onpointerclick={(e) => {
                    e.cancelBubble = true;
                    toggle_node(node);
                  }}
                >
                  <Rect
                    width={node.width}
                    height={node.height}
                    fill={colors.fill}
                    stroke={colors.border}
                    strokeWidth={node.isRoot ? 2 : 1.5}
                    cornerRadius={10}
                    shadowColor="rgba(0,0,0,0.12)"
                    shadowBlur={6}
                    shadowOffsetY={2}
                    shadowOpacity={0.35}
                  />
                  {#if node.isExpandable}
                    <Rect
                      x={node.width - 22}
                      y={8}
                      width={14}
                      height={14}
                      fill={colors.border}
                      cornerRadius={3}
                      listening={false}
                    />
                    <Text
                      x={node.width - 19}
                      y={9}
                      text={node.isExpanded ? '−' : '+'}
                      fontSize={12}
                      fontStyle="bold"
                      fill="#ffffff"
                      listening={false}
                    />
                  {/if}
                  <Text
                    x={12}
                    y={10}
                    width={node.width - 24}
                    text={node.name_dev}
                    fontSize={14}
                    fontStyle="bold"
                    fill={colors.text}
                    wrap="none"
                    ellipsis={true}
                    listening={false}
                  />
                  {#each node.lines as line, i (line)}
                    <Text
                      x={12}
                      y={32 + i * 16}
                      width={node.width - 24}
                      text={line}
                      fontSize={11}
                      fill={colors.subtitle}
                      wrap="none"
                      ellipsis={true}
                      listening={false}
                    />
                  {/each}
                </Group>
              {/each}
            </Group>
          </Layer>
        </Stage>
      {:else if !workingMap}
        <p class="p-6 text-sm text-muted-foreground">Loading map…</p>
      {:else}
        <p class="p-6 text-sm text-muted-foreground">Preparing canvas…</p>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
