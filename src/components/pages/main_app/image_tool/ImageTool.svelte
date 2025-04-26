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
  import { get_map_type, get_project_info_from_key } from '~/state/project_list';
  import { get_starting_index, project_map_q } from '~/state/main_app/data.svelte';
  import { lipi_parivartak } from '~/tools/converter';
  import { deepCopy } from '~/tools/kry';

  let mounted = $state(false);

  // in our case we dont need to initialize inside of onMount
  $image_selected_levels = $selected_text_levels;
  $image_script = $viewing_script;
  if ($trans_lang !== 0) $image_lang = $trans_lang;

  const project_info = $derived(get_project_info_from_key($project_state.project_key!));
  type option_type = { text?: string; value?: number };

  const transliterate_options = async (options: option_type[], script: script_list_type) => {
    const transliterate_texts = await lipi_parivartak(
      options.map((v) => v.text!),
      BASE_SCRIPT,
      script
    );
    return options.map((v, i) => ({ ...v, text: transliterate_texts[i] }));
  };

  onMount(() => {
    update_scaling_factor();
    window.addEventListener('resize', update_scaling_factor);
    const unsub_func = () => {
      window.removeEventListener('resize', update_scaling_factor);
    };
    paint_init_convas().then(() => {
      mounted = true;
    });
    return unsub_func;
  });

  $effect(() => {
    $image_script = get_script_for_lang($image_lang);
  });

  $effect(() => {
    if ($image_selected_levels[0]) {
      $image_shloka = get_starting_index(project_info.key!, $image_selected_levels);
      // reset after change
    }
  });

  let canvas_element = $state<HTMLCanvasElement>(null!);

  function update_scaling_factor() {
    // we can improve the method of calculating the scaling factor later on
    const availableWidth = window.innerWidth * 0.8;
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

  // $effect(() => {
  // mounted &&
  //   $image_tool_opened &&
  //   setTimeout(async () => {
  //     await render_all_texts(
  //       untrack(() => $image_shloka),
  //       untrack(() => $image_script),
  //       untrack(() => $image_lang)
  //     );
  //   }, 600);
  // });
  // ^ This is to try to fix the issue of text not rendering after opening the image tool second time

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
        await render_all_texts($image_shloka, $image_script, $image_lang);
        $image_rendering_state = false;
      })();
  });
</script>

<div class="space-y-2">
  <div class="space-x-2 text-sm">
    <select class="select inline-block w-36 p-1 text-sm ring-2" bind:value={$image_script}>
      {#each SCRIPT_LIST as lang (lang)}
        {#if !['Normal'].includes(lang)}
          <option value={lang}>{lang}</option>
        {/if}
      {/each}
    </select>
    <div class="inline-block space-x-1">
      {#each { length: project_info.levels - 1 } as _, i}
        {@const level_name = project_info.level_names[project_info.levels - i - 1]}
        {#if project_info.levels === 3}
          {@const map_info = $project_map_q.isSuccess && get_map_type($project_map_q.data, 3)}
          {#if i === 0}
            {@render selecter({
              name: level_name,
              text_level_state_index: 1,
              options:
                map_info &&
                map_info.map((text_level) => ({
                  text: text_level.name_dev,
                  value: text_level.pos
                }))
            })}
          {:else if i === 1 && !!$image_selected_levels[1]}
            {@render selecter({
              name: level_name,
              text_level_state_index: 0,
              options:
                map_info &&
                map_info[$image_selected_levels[1] - 1].list.map((text_level) => ({
                  text: text_level.name_dev,
                  value: text_level.pos
                }))
            })}
          {/if}
        {:else if project_info.levels === 2}
          {@const map_info = $project_map_q.isSuccess && get_map_type($project_map_q.data, 2)}
          {#if i == 0}
            {@render selecter({
              name: level_name,
              text_level_state_index: 0,
              options:
                map_info &&
                map_info.map((text_level) => ({
                  text: text_level.name_dev,
                  value: text_level.pos
                }))
            })}
          {/if}
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
        <select
          class={`${get_text_font_class($image_script)} select inline-block w-40 p-1 text-sm ring-2`}
          disabled={$editing_status_on}
          bind:value={$image_selected_levels[text_level_state_index]}
        >
          <option value={null}>Select</option>
          {#if !options}
            {#if initial_option && initial_option.value}
              <option value={initial_option.value} selected
                >{initial_option.value}. {initial_option.text}</option
              >
            {/if}
          {:else}
            {#await transliterate_options(options, $viewing_script)}
              {#each options as option}
                <option value={option.value}>{option.value}. {option.text}</option>
              {/each}
            {:then options_tr}
              {#each options_tr as option}
                <option value={option.value}>{option.value}. {option.text}</option>
              {/each}
            {/await}
          {/if}
        </select>
      {/snippet}
    </div>
  </div>
  <ImageOptions />
</div>
<div class="mt-2 space-y-2">
  <canvas bind:this={canvas_element}></canvas>
</div>
