<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import * as fabric from 'fabric';
  import {
    canvas as canvas_obj,
    background_image,
    scaling_factor,
    get_units,
    shaded_background_image_status,
    set_background_image_type,
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
    image_shloka_data
  } from './state';
  import {
    selected_text_levels,
    viewing_script,
    trans_lang,
    image_tool_opened,
    editing_status_on,
    project_state,
    BASE_SCRIPT
  } from '~/state/main_app/state.svelte';
  import { get_script_for_lang, get_text_font_class } from '~/tools/font_tools';
  import { SCRIPT_LIST, type script_list_type } from '~/state/lang_list';
  import { shloka_configs, SPACE_ABOVE_REFERENCE_LINE } from './settings';
  import { render_all_texts } from './render_text';
  import ImageOptions from './ImageOptions.svelte';
  import { get_starting_index, project_map_q } from '~/state/main_app/data.svelte';
  import { transliterate_custom } from '~/tools/converter';
  import { deepCopy } from '~/tools/kry';
  import * as Select from '$lib/components/ui/select';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';
  import { Button } from '$lib/components/ui/button';

  type Props = {
    onClose?: () => void;
  };

  let { onClose }: Props = $props();

  let mounted = $state(false);
  let layout_el = $state<HTMLDivElement>(null!);
  let layout_width = $state<number | null>(null);

  // in our case we dont need to initialize inside of onMount
  $image_selected_levels = $selected_text_levels;
  $image_script = $viewing_script;
  if ($trans_lang !== 0) $image_lang = $trans_lang;

  const levels = $derived($project_state.levels);
  const level_names = $derived($project_state.level_names);
  type option_type = { text?: string; value?: number };

  const get_map_list_at_depth = (
    project_map: any,
    levels: number,
    selected: (number | null)[],
    depth: number
  ): any[] | null => {
    // depth: 0 -> root list (highest selector), 1 -> list under highest selection, etc.
    let node: any = project_map;
    for (let d = 0; d < depth; d++) {
      const sel = selected[levels - 2 - d];
      if (!sel) return null;
      if (node?.info?.type !== 'list') return null;
      const list: any[] = node.list ?? [];
      if (!(sel >= 1 && sel <= list.length)) return null;
      node = list[sel - 1];
      if (!node) return null;
    }
    if (node?.info?.type !== 'list') return null;
    return Array.isArray(node.list) ? node.list : null;
  };

  const transliterate_options = async (options: option_type[], script: script_list_type) => {
    const transliterate_texts = await transliterate_custom(
      options.map((v) => v.text!),
      BASE_SCRIPT,
      script
    );
    return options.map((v, i) => ({ ...v, text: transliterate_texts[i] }));
  };

  onMount(() => {
    const update_layout = () => {
      layout_width = layout_el?.clientWidth ?? null;
      update_scaling_factor();
    };

    update_layout();
    window.addEventListener('resize', update_layout);

    const ro = new ResizeObserver(update_layout);
    if (layout_el) ro.observe(layout_el);

    paint_init_convas().then(() => {
      mounted = true;
    });

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

  let canvas_element = $state<HTMLCanvasElement>(null!);

  function update_scaling_factor() {
    // size the canvas relative to the dialog width (not the full window)
    const width_basis = layout_width ?? window.innerWidth;
    const availableWidth = width_basis * 0.95;
    const availableHeight = window.innerHeight * 0.74;
    const scale = [availableWidth / IMAGE_DIMENSIONS[0], availableHeight / IMAGE_DIMENSIONS[1]];
    let min_value = Math.min(...scale);
    $scaling_factor = min_value;
  }

  const paint_init_convas = async () => {
    $canvas_obj = new fabric.Canvas(canvas_element, {
      width: get_units(IMAGE_DIMENSIONS[0]),
      height: get_units(IMAGE_DIMENSIONS[1]),
      backgroundColor: 'transparent'
    });
    const img = await fabric.util.loadImage('');
    $background_image = new fabric.Image(img, {
      originX: 'left',
      originY: 'top',
      scaleX: $scaling_factor,
      scaleY: $scaling_factor,
      selectable: false,
      evented: false,
      selection: false
    });
    // Add the image to the canvas
    $canvas_obj.add($background_image);

    $canvas_obj.requestRenderAll();
  };

  const update_canvas_dimensions = () => {
    if (!$canvas_obj || !mounted) return;
    // Update canvas dimensions
    $canvas_obj.setWidth(get_units(IMAGE_DIMENSIONS[0]));
    $canvas_obj.setHeight(get_units(IMAGE_DIMENSIONS[1]));
    const prev_scaling_factor = $background_image.scaleX;
    // Scale background image
    $background_image.scaleX = $scaling_factor;
    $background_image.scaleY = $scaling_factor;

    const scale_object = (obj: fabric.FabricObject) => {
      const type = obj.type;
      if (!obj || type === 'image') return;
      let options: Record<string, any> = {};
      if (['text', 'textbox'].includes(obj.type)) {
        const base_top = obj.get('top') / prev_scaling_factor;
        const base_left = obj.get('left') / prev_scaling_factor;
        const base_font_size = obj.get('fontSize') / prev_scaling_factor;
        options = {
          left: get_units(base_left),
          top: get_units(base_top),
          fontSize: get_units(base_font_size)
        };
        if (type === 'textbox') {
          const base_width = obj.get('width') / prev_scaling_factor;
          options['width'] = get_units(base_width);
        }
      } else if (type === 'line') {
        const base_x1 = obj.get('x1') / prev_scaling_factor;
        const base_y1 = obj.get('y1') / prev_scaling_factor;
        const base_x2 = obj.get('x2') / prev_scaling_factor;
        const base_y2 = obj.get('y2') / prev_scaling_factor;
        const stroke_width = obj.get('strokeWidth') / prev_scaling_factor;
        options = {
          x1: get_units(base_x1),
          y1: get_units(base_y1),
          x2: get_units(base_x2),
          y2: get_units(base_y2),
          strokeWidth: get_units(stroke_width)
        };
      } else if (['path', 'group'].includes(type)) {
        const resize_path = (path_obj: fabric.Path) => {
          const base_left = path_obj.get('left') / prev_scaling_factor;
          const base_top = path_obj.get('top') / prev_scaling_factor;
          const base_scaleX = path_obj.get('scaleX') / prev_scaling_factor;
          const base_scaleY = path_obj.get('scaleY') / prev_scaling_factor;
          options = {
            left: get_units(base_left),
            top: get_units(base_top),
            scaleX: get_units(base_scaleX),
            scaleY: get_units(base_scaleY)
          };
        };
        if (type === 'group' && obj instanceof fabric.Group) {
          obj.forEachObject((e) => {
            obj.remove(e);
            scale_object(e);
            obj.add(e);
          });
        } else {
          resize_path(obj as fabric.Path);
        }
      } // Update object's corner positions
      obj.set(options);
      obj.setCoords();
    };
    // Update positions and scales of text objects
    $canvas_obj.getObjects().forEach(scale_object);
    $canvas_obj.requestRenderAll();
  };
  $effect(() => {
    if (mounted && $scaling_factor) untrack(() => update_canvas_dimensions());
  });
  $effect(() => {
    if (mounted) set_background_image_type($shaded_background_image_status);
  });

  $effect(() => {
    if (mounted && !$image_text_data_q.isFetching && $image_text_data_q.isSuccess) {
      $image_shloka_data = deepCopy($image_text_data_q.data![$image_shloka]);
    }
  });

  $effect(() => {
    if (
      mounted &&
      !$image_text_data_q.isFetching &&
      $image_text_data_q.isSuccess &&
      !$image_trans_data_q.isFetching &&
      $image_trans_data_q.isSuccess &&
      $SPACE_ABOVE_REFERENCE_LINE &&
      $image_selected_levels &&
      $shloka_configs &&
      $normal_text_font_config &&
      $trans_text_font_configs &&
      $main_text_font_configs
    )
      (async () => {
        $image_rendering_state = true;
        $image_shloka;
        await render_all_texts(null, $image_script, $image_lang);
        $image_rendering_state = false;
      })();
  });
</script>

<div class="flex h-full flex-col space-y-4 overflow-hidden">
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
            {@const level_name = level_names[levels - i - 1]}
            {@const text_level_state_index = levels - i - 2}
            {@const map_root = $project_map_q.isSuccess && $project_map_q.data}
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

  <div class="mt-2 flex flex-1 justify-center space-y-2 overflow-auto">
    <canvas bind:this={canvas_element}></canvas>
  </div>
</div>
