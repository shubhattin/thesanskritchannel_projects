<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Stage, Layer, Line, Text, Image as KonvaImage, Transformer } from 'svelte-konva';
  import type Konva from 'konva';
  import type { KonvaEventObject } from 'konva/lib/Node';
  import {
    BACKGROUND_IMAGE_URLS,
    scaling_factor,
    shaded_background_image_status,
    IMAGE_DIMENSIONS,
    image_selected_levels,
    image_script,
    image_lang,
    image_shloka,
    image_text_data_q,
    image_trans_data_q,
    trans_text_font_configs,
    main_text_font_configs,
    normal_text_font_config,
    image_rendering_state,
    image_shloka_data,
    image_render_colors,
    image_trans_text,
    stage_node,
    fonts_loaded,
    show_image_on_top_right
  } from './image_state';
  import {
    selected_text_levels,
    viewing_script,
    trans_lang,
    editing_status_on,
    project_state,
    BASE_SCRIPT
  } from '~/state/main_app/state.svelte';
  import { get_script_for_lang, get_text_font_class } from '~/tools/font_tools';
  import { SCRIPT_LIST, type script_list_type } from '~/state/lang_list';
  import { current_shloka_type, shloka_configs, SPACE_ABOVE_REFERENCE_LINE } from './settings';
  import { compute_all_layouts, type CanvasLayoutResult } from './render_text';
  import ImageOptions from './ImageOptions.svelte';
  import { get_starting_index, project_map_q } from '~/state/main_app/data.svelte';
  import { transliterate_custom } from '~/tools/converter';
  import { deepCopy } from '~/tools/kry';
  import * as Select from '$lib/components/ui/select';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';
  import { Button } from '$lib/components/ui/button';
  import {
    get_list_name_at_depth_from_selected,
    get_map_list_at_depth
  } from '~/state/project_list';

  type Props = {
    onClose?: () => void;
  };

  let { onClose }: Props = $props();

  let mounted = $state(false);
  let layout_el = $state<HTMLDivElement>(null!);
  let layout_width = $state<number | null>(null);

  // Canvas layout data (computed reactively)
  let layout_result = $state<CanvasLayoutResult | null>(null);

  // Background image element
  let bg_image_element = $state<HTMLImageElement | null>(null);

  // Stage component ref — bind:this then propagate into store
  let stage_component = $state<{ node: Konva.Stage } | null>(null);

  // --- Drag & Selection state ---

  /** Per-element position overrides from user drags. Keyed by element id. */
  let drag_offsets = $state<Record<string, { x: number; y: number }>>({});

  /** Currently selected Konva node (for Transformer handles). */
  let selected_node = $state<Konva.Node | null>(null);

  /** Ref to the svelte-konva Transformer component. */
  let transformer_ref = $state<{ node: Konva.Transformer } | null>(null);

  /** Attach/detach the Transformer to the selected node. */
  function update_transformer() {
    if (!transformer_ref) return;
    const tr = transformer_ref.node;
    tr.nodes(selected_node ? [selected_node] : []);
    tr.getLayer()?.batchDraw();
  }

  // When selected_node changes, update the transformer
  $effect(() => {
    void selected_node;
    update_transformer();
  });

  function handle_text_click(e: KonvaEventObject<MouseEvent>) {
    // Select the clicked text node
    const node = e.target;
    selected_node = node;
  }

  function handle_dragend(
    e: KonvaEventObject<Event>,
    el_id: string,
    original_x: number,
    original_y: number
  ) {
    const node = e.target;
    drag_offsets[el_id] = {
      x: node.x() - original_x,
      y: node.y() - original_y
    };
    drag_offsets = { ...drag_offsets }; // trigger reactivity
  }

  function handle_stage_click(e: KonvaEventObject<MouseEvent>) {
    // Deselect when clicking on empty stage area
    if (e.target === stage_component?.node) {
      selected_node = null;
    }
  }

  // in our case we dont need to initialize inside of onMount
  $image_selected_levels = $selected_text_levels;
  $image_script = $viewing_script;
  if ($trans_lang !== 0) $image_lang = $trans_lang;

  const levels = $derived($project_state.levels);
  const level_names = $derived($project_state.level_names);
  type option_type = { text?: string; value?: number };

  const transliterate_options = async (options: option_type[], script: script_list_type) => {
    const transliterate_texts = await transliterate_custom(
      options.map((v) => v.text!),
      BASE_SCRIPT,
      script
    );
    return options.map((v, i) => ({ ...v, text: transliterate_texts[i] }));
  };

  // Load background image
  function load_bg_image(use_template: boolean) {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = use_template ? BACKGROUND_IMAGE_URLS.template : BACKGROUND_IMAGE_URLS.normal;
    img.onload = () => {
      bg_image_element = img;
    };
  }

  onMount(() => {
    const update_layout = () => {
      layout_width = layout_el?.clientWidth ?? null;
      update_scaling_factor();
    };

    update_layout();
    window.addEventListener('resize', update_layout);

    const ro = new ResizeObserver(update_layout);
    if (layout_el) ro.observe(layout_el);

    // Load initial background image
    load_bg_image($shaded_background_image_status);

    // fonts are loaded on-demand in compute_all_layouts() for whichever
    // script/lang is actually used — no upfront preload needed.
    $fonts_loaded = true;
    mounted = true;

    return () => {
      window.removeEventListener('resize', update_layout);
      ro.disconnect();
    };
  });

  $effect(() => {
    $image_script = get_script_for_lang($image_lang);
  });

  $effect(() => {
    if ($image_selected_levels) {
      $image_shloka = get_starting_index($project_state.project_key!, $image_selected_levels);
      // reset after change
    }
  });

  function update_scaling_factor() {
    // size the canvas relative to the dialog width (not the full window)
    const width_basis = layout_width ?? window.innerWidth;
    const availableWidth = width_basis * 0.95;
    const availableHeight = window.innerHeight * 0.74;
    const scale = [availableWidth / IMAGE_DIMENSIONS[0], availableHeight / IMAGE_DIMENSIONS[1]];
    let min_value = Math.min(...scale);
    $scaling_factor = min_value;
  }

  // Update background image when toggle changes
  $effect(() => {
    if (mounted) load_bg_image($shaded_background_image_status);
  });

  $effect(() => {
    if (stage_component) $stage_node = stage_component.node;
  });

  $effect(() => {
    if (mounted && !$image_text_data_q.isFetching && $image_text_data_q.isSuccess) {
      $image_shloka_data = deepCopy($image_text_data_q.data![$image_shloka]);
    }
  });

  // Reactive layout computation — replaces the old render_all_texts $effect
  $effect(() => {
    if (
      !mounted ||
      !$fonts_loaded ||
      $image_text_data_q.isFetching ||
      !$image_text_data_q.isSuccess ||
      $image_trans_data_q.isFetching ||
      !$image_trans_data_q.isSuccess ||
      !$image_selected_levels ||
      !$shloka_configs ||
      !$normal_text_font_config ||
      !$trans_text_font_configs ||
      !$main_text_font_configs
    )
      return;

    // Explicit deps so text color edits always trigger a re-layout.
    const color_deps = [
      $image_render_colors.main,
      $image_render_colors.normal,
      $image_render_colors.number,
      $image_render_colors.translation,
      $image_shloka,
      $image_script,
      $image_lang,
      $SPACE_ABOVE_REFERENCE_LINE,
      $image_shloka_data?.text,
      $image_trans_text,
      $show_image_on_top_right
    ].join('\x1e');
    void color_deps;

    // Clear drag offsets and selection when layout recomputes
    drag_offsets = {};
    selected_node = null;

    let cancelled = false;
    (async () => {
      $image_rendering_state = true;
      const result = await compute_all_layouts(null, $image_script, $image_lang);
      if (!cancelled) {
        layout_result = result;
        if (result) current_shloka_type.set(result.shloka_type);
        $image_rendering_state = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

<div class="flex flex-col space-y-4">
  <!-- Controls Section -->
  <div class="flex items-start justify-between gap-4">
    <div bind:this={layout_el} class="flex-1 space-y-3">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <Select.Root type="single" bind:value={$image_script as any}>
          <Select.Trigger class="inline-flex h-10 w-36 p-1 text-sm">
            {$image_script}
          </Select.Trigger>
          <Select.Content>
            {#each SCRIPT_LIST as lang (lang)}
              {#if !['Normal'].includes(lang)}
                <Select.Item value={lang}>{lang}</Select.Item>
              {/if}
            {/each}
          </Select.Content>
        </Select.Root>
        <div class="inline-block space-x-1">
          {#each { length: levels - 1 } as _, i}
            {@const text_level_state_index = levels - i - 2}
            {@const map_root = $project_map_q.isSuccess && $project_map_q.data}
            {@const fallback_level_name = level_names[levels - i - 1]}
            {@const level_name =
              map_root && levels > 0
                ? get_list_name_at_depth_from_selected(
                    map_root,
                    levels,
                    $image_selected_levels,
                    i,
                    fallback_level_name
                  )
                : fallback_level_name}
            {@const list_at_depth =
              map_root && get_map_list_at_depth(map_root, levels, $image_selected_levels, i)}
            {#if i === 0 || list_at_depth}
              {@render selecter({
                name: level_name,
                text_level_state_index,
                options: list_at_depth
                  ? list_at_depth.map((text_level: any) => ({
                      text: text_level.name_dev,
                      value: text_level.pos
                    }))
                  : false
              })}
            {/if}
          {/each}

          {#snippet selecter({
            name,
            options,
            initial_option,
            text_level_state_index
          }: {
            name: string;
            initial_option?: option_type;
            options: false | option_type[];
            text_level_state_index: number;
          })}
            <Select.Root
              type="single"
              value={$image_selected_levels[text_level_state_index]?.toString() ?? ''}
              onValueChange={(v) => {
                const next_value = v ? parseInt(v) : null;
                $image_selected_levels[text_level_state_index] = next_value;
                // If a higher level changes, clear all dependent lower levels.
                for (let i = 0; i < text_level_state_index; i++) {
                  $image_selected_levels[i] = null;
                }
              }}
              disabled={$editing_status_on}
            >
              <Select.Trigger
                class={`${get_text_font_class($image_script)} inline-flex h-10 w-40 p-1 text-sm`}
              >
                {$image_selected_levels[text_level_state_index]
                  ? `${$image_selected_levels[text_level_state_index]}. ${
                      options
                        ? (options.find(
                            (o) => o.value === $image_selected_levels[text_level_state_index]
                          )?.text ?? '')
                        : (initial_option?.text ?? '')
                    }`
                  : 'Select'}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="">Select</Select.Item>
                {#if !options}
                  {#if initial_option && initial_option.value}
                    <Select.Item value={initial_option.value.toString()}>
                      {initial_option.value}. {initial_option.text}
                    </Select.Item>
                  {/if}
                {:else}
                  {#await transliterate_options(options, $viewing_script)}
                    {#each options as option}
                      <Select.Item value={option.value!.toString()}
                        >{option.value}. {option.text}</Select.Item
                      >
                    {/each}
                  {:then options_tr}
                    {#each options_tr as option}
                      <Select.Item value={option.value!.toString()}
                        >{option.value}. {option.text}</Select.Item
                      >
                    {/each}
                  {/await}
                {/if}
              </Select.Content>
            </Select.Root>
          {/snippet}
        </div>
      </div>
      <div class="max-w-4xl">
        <ImageOptions />
      </div>
    </div>
    <!-- Close Button -->
    {#if onClose}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close"
        class="shrink-0 text-muted-foreground hover:text-foreground"
        onclick={onClose}
      >
        <Icon src={AiOutlineClose} />
      </Button>
    {/if}
  </div>

  <div class="mt-2 flex justify-center space-y-2">
    {#if browser && mounted && $scaling_factor > 0}
      <Stage
        bind:this={stage_component}
        width={IMAGE_DIMENSIONS[0] * $scaling_factor}
        height={IMAGE_DIMENSIONS[1] * $scaling_factor}
        scaleX={$scaling_factor}
        scaleY={$scaling_factor}
        onclick={handle_stage_click}
      >
        <!-- Background Layer -->
        <Layer listening={false}>
          {#if bg_image_element}
            <KonvaImage
              image={bg_image_element}
              x={0}
              y={0}
              width={IMAGE_DIMENSIONS[0]}
              height={IMAGE_DIMENSIONS[1]}
            />
          {/if}
        </Layer>

        <!-- Lines Layer -->
        {#if layout_result}
          <Layer listening={false}>
            {#each layout_result.bounding_lines as line (line.id)}
              <Line
                points={line.points}
                stroke={line.stroke}
                strokeWidth={line.strokeWidth}
                listening={false}
              />
            {/each}
            {#each layout_result.reference_lines as line (line.id)}
              <Line
                points={line.points}
                stroke={line.stroke}
                strokeWidth={line.strokeWidth}
                listening={false}
              />
            {/each}
          </Layer>
        {/if}

        <!-- Text Layer (draggable + selectable) -->
        {#if layout_result}
          <Layer>
            {#each layout_result.texts as el (el.id)}
              <Text
                text={el.text}
                x={el.x + (drag_offsets[el.id]?.x ?? 0)}
                y={el.y + (drag_offsets[el.id]?.y ?? 0)}
                fontSize={el.fontSize}
                fontFamily={el.fontFamily}
                fontStyle={el.fontStyle}
                fill={el.fill}
                align={el.align}
                width={el.width}
                wrap={el.wrap}
                lineHeight={el.lineHeight}
                draggable={true}
                onclick={handle_text_click}
                ondragend={(e) => handle_dragend(e, el.id, el.x, el.y)}
              />
            {/each}
            <Transformer
              bind:this={transformer_ref}
              rotateEnabled={false}
              keepRatio={false}
              boundBoxFunc={(_oldBox, newBox) => {
                // Prevent too small
                if (newBox.width < 10 || newBox.height < 10) return _oldBox;
                return newBox;
              }}
            />
          </Layer>
        {/if}
      </Stage>
    {/if}
  </div>
</div>
