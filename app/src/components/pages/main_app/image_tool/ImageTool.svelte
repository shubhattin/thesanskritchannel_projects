<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Stage, Layer, Line, Text, Image as KonvaImage } from 'svelte-konva';
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
    image_text_data_q_options,
    image_trans_data_q_options,
    trans_text_font_configs,
    main_text_font_configs,
    normal_text_font_config,
    image_rendering_state,
    image_shloka_data,
    image_render_colors,
    image_trans_text,
    stage_node,
    fonts_loaded,
    show_image_on_top_right,
    translation_bounding_coords,
    image_drag_reset_nonce,
    system_font_overrides
  } from './image_state';
  import {
    selected_text_levels,
    viewing_script,
    trans_lang,
    editing_mode,
    project_state,
    BASE_SCRIPT,
    text_data_present
  } from '~/state/main_app/state.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { get_script_for_lang, get_text_font_class } from '~/tools/font_tools';
  import { SCRIPT_LIST, type script_list_type } from '~/state/lang_list';
  import {
    current_shloka_type,
    shloka_configs,
    SPACE_ABOVE_REFERENCE_LINE,
    MAX_SUPPORTED_SHLOKA_LINES,
    is_supported_shloka_line_count
  } from './settings';
  import { compute_all_layouts, split_shloka_lines, type CanvasLayoutResult } from './render_text';
  import ImageOptions from './ImageOptions.svelte';
  import { get_starting_index, project_map_q_options } from '~/state/main_app/data.svelte';
  import { transliterate_custom } from '~/tools/converter';
  import { deepCopy } from '~/tools/kry';
  import * as Select from '$lib/components/ui/select';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';
  import { Button } from '$lib/components/ui/button';
  import {
    get_list_name_at_depth_from_selected,
    get_map_list_at_depth,
    map_list_nodes_to_selector_options
  } from '~/state/project_list';

  type Props = {
    onClose?: () => void;
  };

  let { onClose }: Props = $props();

  const project_map_q = createQuery(() => project_map_q_options($project_state));

  const image_text_data_q = createQuery(() =>
    image_text_data_q_options($image_selected_levels, $project_state, $text_data_present)
  );

  const image_trans_data_q = createQuery(() =>
    image_trans_data_q_options(
      $image_selected_levels,
      $image_lang,
      $project_state,
      $text_data_present
    )
  );

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

  $effect(() => {
    void $image_drag_reset_nonce;
    drag_offsets = {};
  });

  // in our case we dont need to initialize inside of onMount
  $image_selected_levels = $selected_text_levels;
  $image_script = $viewing_script;
  if ($trans_lang != null && $trans_lang !== 0) $image_lang = $trans_lang;

  const levels = $derived($project_state?.levels ?? 0);
  const level_names = $derived($project_state?.level_names ?? []);

  const shloka_line_count = $derived.by(() => {
    const text = $image_shloka_data?.text;
    if (!text || !image_text_data_q.isSuccess) return null;
    return split_shloka_lines(
      text,
      $image_shloka,
      $project_state?.project_key ?? '',
      image_text_data_q.data?.length ?? 0
    ).length;
  });

  const unsupported_shloka_line_count = $derived(
    shloka_line_count != null && !is_supported_shloka_line_count(shloka_line_count)
  );
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
    if (!$image_selected_levels || !$project_state) return;
    $image_shloka = get_starting_index($project_state.project_key, $image_selected_levels);
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
    if (mounted && !image_text_data_q.isFetching && image_text_data_q.isSuccess) {
      $image_shloka_data = deepCopy(image_text_data_q.data![$image_shloka]);
    }
  });

  // Reactive layout computation — replaces the old render_all_texts $effect
  $effect(() => {
    if (
      !mounted ||
      !$fonts_loaded ||
      image_text_data_q.isFetching ||
      !image_text_data_q.isSuccess ||
      image_trans_data_q.isFetching ||
      !image_trans_data_q.isSuccess ||
      !$image_selected_levels ||
      !$shloka_configs ||
      !$normal_text_font_config ||
      !$trans_text_font_configs ||
      !$main_text_font_configs ||
      !$translation_bounding_coords
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
      $show_image_on_top_right,
      $shloka_configs,
      $translation_bounding_coords,
      JSON.stringify($main_text_font_configs),
      JSON.stringify($normal_text_font_config),
      JSON.stringify($trans_text_font_configs),
      $system_font_overrides.main,
      $system_font_overrides.normal,
      $system_font_overrides.trans
    ].join('\x1e');
    void color_deps;

    // Clear drag offsets when layout recomputes
    drag_offsets = {};

    let cancelled = false;
    (async () => {
      $image_rendering_state = true;
      const result = await compute_all_layouts(null, $image_script, $image_lang);
      if (!cancelled) {
        layout_result = result;
        if (result) {
          current_shloka_type.set(result.shloka_type);
        } else if (unsupported_shloka_line_count) {
          current_shloka_type.set(undefined);
        }
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
            {@const map_root = project_map_q.isSuccess && project_map_q.data}
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
                options: list_at_depth ? map_list_nodes_to_selector_options(list_at_depth) : false
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
              disabled={$editing_mode !== 'none'}
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

  <div class="mt-2 flex flex-col items-center space-y-2">
    {#if unsupported_shloka_line_count && shloka_line_count != null}
      <p
        class="max-w-3xl rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-200"
        role="status"
      >
        This shloka has <strong>{shloka_line_count} lines</strong>. The image tool only supports up
        to
        <strong>{MAX_SUPPORTED_SHLOKA_LINES} lines</strong>. Open
        <strong>Image options → Edit text</strong> and combine or remove line breaks so the shloka fits.
      </p>
    {/if}
    {#if browser && mounted && $scaling_factor > 0}
      <Stage
        bind:this={stage_component}
        width={IMAGE_DIMENSIONS[0] * $scaling_factor}
        height={IMAGE_DIMENSIONS[1] * $scaling_factor}
        scaleX={$scaling_factor}
        scaleY={$scaling_factor}
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
                ondragend={(e) => handle_dragend(e, el.id, el.x, el.y)}
              />
            {/each}
          </Layer>
        {/if}
      </Stage>
    {/if}
  </div>
</div>
