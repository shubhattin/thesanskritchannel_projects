<script lang="ts">
  import {
    get_starting_index,
    get_total_count,
    project_map_q,
    text_data_q,
    trans_en_data_q
  } from '~/state/main_app/data.svelte';
  import {
    ai_tool_opened,
    project_state,
    selected_text_levels,
    TEXT_MODEL_LIST
  } from '~/state/main_app/state.svelte';
  import Icon from '~/tools/Icon.svelte';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import { writable } from 'svelte/store';
  import image_tool_prompts from './image_tool_prompts.yaml';
  import { Switch, ProgressRing } from '@skeletonlabs/skeleton-svelte';
  import { client } from '~/api/client';
  import { copy_text_to_clipboard, format_string_text, get_permutations } from '~/tools/kry';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { loadLocalConfig } from '../load_local_config';
  import { BsDownload, BsCopy, BsChevronDown, BsChevronUp } from 'svelte-icons-pack/bs';
  import {
    download_external_file_in_browser,
    download_file_in_browser
  } from '~/tools/download_file_browser';
  import { cl_join } from '~/tools/cl_join';
  import { OiStopwatch16 } from 'svelte-icons-pack/oi';
  import { BsClipboard2Check } from 'svelte-icons-pack/bs';
  import { createQuery } from '@tanstack/svelte-query';
  import { delay } from '~/tools/delay';
  import pretty_ms from 'pretty-ms';
  import ms from 'ms';
  import { get_project_from_id, get_project_info_from_key } from '~/state/project_list';
  import { CgClose } from 'svelte-icons-pack/cg';
  import { slide } from 'svelte/transition';
  import { get_result_from_trigger_run_id } from '~/tools/trigger';

  let base_prompts = image_tool_prompts as {
    main_prompt: {
      role: 'user' | 'assistant';
      content: string;
    }[];
    additional_prompt_info: string;
  };

  let base_prompt_text = $state('');

  $effect(() => {
    base_prompt_text = format_string_text(base_prompts.main_prompt[0].content, {
      text_name: get_project_from_id($project_state.project_id!).name
    });
  });

  let total_count = $derived($project_map_q.isSuccess ? get_total_count($selected_text_levels) : 0);

  let selected_text_model: keyof typeof TEXT_MODEL_LIST = $state('gpt-4.1');

  onMount(async () => {
    if (import.meta.env.DEV) {
      const conf = await loadLocalConfig();
      if (conf.use_ai_sample_data) load_ai_sample_data = true;
    }
  });

  $effect(() => {
    if ($selected_text_levels) {
      $index = get_starting_index($project_state.project_key!, $selected_text_levels);
    }
  });
  let index = writable(1);
  let auto_gen_image = writable(false);
  let shloka_text_prompt = writable('');
  let image_prompt = writable('');
  let load_ai_sample_data = $state(false);
  let image_prompt_request_error = $state(false);

  let show_prompt_time_status = $state(false);
  let show_image_time_status = $state(false);

  onDestroy(() => {
    show_prompt_time_status = false;
    show_image_time_status = false;
    // ^ may be not needed
  });

  $effect(() => {
    if (show_prompt_time_status) {
      const t_id = setTimeout(() => (show_prompt_time_status = false), 10 * 1000);
      return () => clearTimeout(t_id);
    }
  });
  $effect(() => {
    if (show_image_time_status) {
      const t_id = setTimeout(() => (show_image_time_status = false), 10 * 1000);
      return () => clearTimeout(t_id);
    }
  });

  const ADDITIONAL_IMAGE_GEN_DELAY_S = 4;

  type image_models_type = Parameters<
    typeof client.ai.trigger_funcs.generate_image_trigger.query
  >[0]['image_model'];
  let image_model: image_models_type = $state('gpt-image-1');
  const IMAGE_MODELS: Record<image_models_type, [string, string, number]> = {
    'gpt-image-1': ['GPT', '$0.042 (₹3.5) / image', 23 + ADDITIONAL_IMAGE_GEN_DELAY_S],
    'dall-e-3': ['DALL-E 3', '$0.04 (₹3.4) / image', 15 + ADDITIONAL_IMAGE_GEN_DELAY_S],
    'sd3-core': ['SD3 Core', '$0.03 (₹2.5) / image', 16 + ADDITIONAL_IMAGE_GEN_DELAY_S]
    // sdxl: ['SDXL', '$0.002 (₹0.17) / image'],
    // 'dall-e-2': ['DALL-E 2', '$0.02 (₹1.68) / image']
  };

  let additional_prompt_info = $derived(
    format_string_text(base_prompts.additional_prompt_info, {
      text_info: (() => {
        const project_info = get_project_info_from_key($project_state.project_key!);
        const { levels } = project_info;
        const path_params = $selected_text_levels.slice(0, levels - 1);
        const level_names = project_info.level_names.slice(1);
        return path_params
          .map((param, index) => {
            const level_name = level_names[index];
            return `${level_name} ${param}`;
          })
          .join(', ');
      })(),
      text_name: get_project_from_id($project_state.project_id!).name
    })
  );

  $effect(() => {
    !$trans_en_data_q.isFetching &&
      $trans_en_data_q.isSuccess &&
      !$text_data_q.isFetching &&
      $text_data_q.isSuccess &&
      (async () => {
        const shloka_text = $text_data_q.data![$index].text;
        let prompt = shloka_text;
        const trans_en_all = $trans_en_data_q.data!;
        if (trans_en_all.has($index)) prompt += '\n\n' + trans_en_all.get($index);
        $shloka_text_prompt = prompt;
      })();
  });

  $effect(() => {
    // reset image prompt text on change of chapter or shloka
    $selected_text_levels;
    $index;
    $image_prompt = '';
  });

  const NUMBER_OF_IMAGES = 1;
  let image_gen_time_taken = $state(0);

  let image_gen_interval_obj: ReturnType<typeof setInterval> = null!;
  // ^ Also update grid-cols-<num> in image rendering
  const generate_image = async () => {
    image_gen_time_taken = 0;
    image_gen_interval_obj = setInterval(() => {
      image_gen_time_taken++;
      if (image_gen_time_taken >= Math.trunc(IMAGE_MODELS[image_model][2])) {
        clearInterval(image_gen_interval_obj);
        return;
      }
    }, 1000);
    await $image_q.refetch();
  };

  const image_prompt_q = $derived(
    createQuery({
      queryKey: [
        'shloka_text_prompt',
        ...$selected_text_levels.slice(0, $project_state.levels - 1).reverse(),
        $index
      ],
      queryFn: async () => {
        show_prompt_time_status = false;
        auto_image_generated = false;
        if (import.meta.env.DEV && load_ai_sample_data) {
          await delay(1000);
          const { ai_sample_data } = await import('./ai_sample_data');
          return { image_prompt: ai_sample_data.sample_text_prompt, time_taken: 0 };
        }
        return await client.ai.get_image_prompt.query({
          messages: [
            {
              role: 'user',
              content: base_prompt_text + additional_prompt_info + '\n\n' + $shloka_text_prompt
            }
          ],
          model: selected_text_model
        });
      },
      enabled: false,
      placeholderData: undefined,
      staleTime: ms('30mins')
    })
  );
  let auto_image_generated = false;
  $effect(() => {
    if (
      !$image_prompt_q.isFetching &&
      $image_prompt_q.isSuccess &&
      $image_prompt_q.data.image_prompt
    )
      untrack(() => {
        $image_prompt = $image_prompt_q.data.image_prompt!;
        if (!auto_image_generated && $auto_gen_image) {
          generate_image();
          auto_image_generated = true;
        }
        image_prompt_request_error = false;
        show_prompt_time_status = true;
      });
    else image_prompt_request_error = true;
  });

  const image_q = $derived(
    createQuery({
      queryKey: [
        'shloka_image',
        ...$selected_text_levels.slice(0, $project_state.levels - 1).reverse(),
        $index
      ],
      queryFn: async () => {
        show_image_time_status = false;
        if (import.meta.env.DEV && load_ai_sample_data) {
          await delay(2000);
          const list: {
            url: string;
            created: number;
            prompt: string;
            file_format: 'png';
            model: 'dall-e-3';
            out_format: 'url';
          }[] = [];
          const permutation = get_permutations([1, 4], 1)[0];
          const { ai_sample_data } = await import('./ai_sample_data');
          for (let i = 0; i < NUMBER_OF_IMAGES; i++) {
            const image_index = permutation[i] - 1;
            list.push({
              url: ai_sample_data.sample_images[image_index],
              created: new Date().getTime(),
              prompt: `Sample Image ${image_index + 1}`,
              file_format: 'png', // although its webp
              model: 'dall-e-3',
              out_format: 'url'
            });
          }
          return { images: list, time_taken: 0 };
        }
        // const { run_id, output_type } = await client.ai.trigger_funcs.generate_image_trigger.query({
        //   image_prompt: $image_prompt,
        //   number_of_images: NUMBER_OF_IMAGES,
        //   image_model
        // });

        // return await get_result_from_trigger_run_id<typeof output_type>(run_id!, 2);
        const out = await client.ai.gen_image.query({
          image_prompt: $image_prompt,
          number_of_images: NUMBER_OF_IMAGES,
          image_model
        });
        if (!out.success) throw new Error('Image generation failed');
        return out;
      },
      enabled: false,
      placeholderData: undefined,
      staleTime: ms('30mins')
    })
  );
  $effect(() => {
    if (!$image_q.isFetching && $image_q.isSuccess) {
      show_image_time_status = true;
      if (image_gen_interval_obj)
        untrack(() => {
          // clear interval
          clearInterval(image_gen_interval_obj);
          image_gen_interval_obj = null!;
          image_gen_time_taken = 0;
        });
    }
  });
  type image_data_type = Awaited<
    ReturnType<typeof client.ai.trigger_funcs.generate_image_trigger.query>
  >['output_type']['images'][number];

  const download_image = (image: image_data_type) => {
    if (!image) return;
    const file_name = `Image No. ${$index}`;
    if (load_ai_sample_data) download_file_in_browser(image.url, `${file_name}.webp`);
    else if (image.out_format == 'url')
      download_external_file_in_browser(image.url, `${file_name}.png`);
    else if (image.out_format == 'b64_json')
      download_file_in_browser(image.url, `${file_name}.png`);
  };

  let copied_text_status = $state(false);
  $effect(() => {
    copied_text_status && setTimeout(() => (copied_text_status = false), 1400);
  });
  const copy_text_with_indicator = (text: string) => {
    copy_text_to_clipboard(text);
    copied_text_status = true;
  };

  let base_prompt_display = $state(false);
</script>

{#if copied_text_status}
  <div
    class="fixed right-2 bottom-2 z-50 cursor-default font-bold text-green-700 select-none dark:text-green-300"
  >
    <Icon src={BsClipboard2Check} />
    Copied to Clipboard
  </div>
{/if}
<div class="mb-2 space-x-3">
  <span class="space-x-1">
    <span class="font-semibold">Index No.</span>
    <button
      class="btn-hover"
      disabled={$index === 0}
      onclick={() => {
        $index--;
      }}
    >
      <Icon src={TiArrowBackOutline} class="-mt-1 text-lg" />
    </button>
    <select
      disabled={$text_data_q.isFetching}
      class="select inline-block w-20 px-1 text-sm ring-2"
      bind:value={$index}
    >
      {#each Array(total_count) as _, index}
        {#if !$text_data_q.isFetching && $text_data_q.isSuccess}
          <option value={index}
            >{index}{$text_data_q.data[index]?.shloka_num &&
              ` - ${$text_data_q.data[index].shloka_num}`}</option
          >
        {/if}
      {/each}
    </select>
    <button
      class="btn-hover"
      onclick={() => {
        $index += 1;
      }}
      disabled={$index === total_count - 1}
    >
      <Icon src={TiArrowForwardOutline} class="-mt-1 text-lg" />
    </button>
  </span>
  <button
    onclick={async () => {
      await $image_prompt_q.refetch();
      // ^ this regetch is not a reliable alternative to onSuccess
    }}
    disabled={$image_prompt_q.isFetching}
    class="btn rounded-md bg-surface-600 px-2 py-1 font-bold text-white dark:bg-surface-600"
  >
    Generate Image Prompt
  </button>
  <select
    class="select ml-2.5 inline-block w-20 px-1.5 py-1 text-xs ring-2 outline-hidden"
    bind:value={selected_text_model}
    title={TEXT_MODEL_LIST[selected_text_model][1]}
  >
    {#each Object.entries(TEXT_MODEL_LIST) as [key, value]}
      <option value={key} title={value[1]}>{value[0]}</option>
    {/each}
  </select>
  <button class="btn p-0 text-white hover:text-red-500" onclick={() => ($ai_tool_opened = false)}>
    <Icon src={CgClose} class="text-xl" />
  </button>
  {#if show_prompt_time_status && $image_prompt_q.isSuccess && $image_prompt_q.data.image_prompt}
    <span class="ml-4 text-xs text-stone-500 select-none dark:text-stone-300">
      <Icon src={OiStopwatch16} class="text-base" />
      {pretty_ms($image_prompt_q.data.time_taken)}
    </span>
  {/if}
</div>
<div class="mb-3">
  <button
    class="btn space-x-2 px-1 py-0.5 text-sm opacity-80 outline-hidden"
    onclick={() => (base_prompt_display = !base_prompt_display)}
  >
    {#if !base_prompt_display}
      <Icon src={BsChevronDown} class="mb-1 text-lg" />
    {:else}
      <Icon src={BsChevronUp} class="mb-1 text-lg" />
    {/if}
    Edit Base Prompt
  </button>
  {#if base_prompt_display}
    <div in:slide out:slide class="mt-1.5">
      <textarea
        class="textarea h-36 border-2 px-1 py-0 text-sm"
        bind:value={base_prompt_text}
        spellcheck="false"
      ></textarea>
    </div>
  {/if}
</div>

<div class="space-y-1">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="text-xs text-slate-600 dark:text-slate-400"
    ondblclick={() => copy_text_with_indicator($shloka_text_prompt)}
  >
    {#each $shloka_text_prompt.split('\n') as line}
      <div>
        {line.length !== 0 ? line : '\u200c'}
      </div>
    {/each}
  </div>
</div>
<div class="flex space-x-3">
  <select
    class="select w-24 px-1.5 py-1 text-sm ring-2"
    bind:value={image_model}
    title={IMAGE_MODELS[image_model][1]}
  >
    {#each Object.entries(IMAGE_MODELS) as option}
      <option class="text-sm" value={option[0]} title={option[1][1]}>{option[1][0]}</option>
    {/each}
  </select>
  <Switch
    name="auto_image"
    stateFocused="outline-hidden select-none"
    checked={$auto_gen_image}
    onCheckedChange={(e) => ($auto_gen_image = e.checked)}>Auto Generate Image</Switch
  >
</div>
{#if $image_prompt_q.data !== undefined || $image_prompt_q.isFetching}
  {#if $image_prompt_q.isFetching || !$image_prompt_q.isSuccess}
    <div class="h-80 placeholder animate-pulse rounded-md"></div>
  {:else}
    <div class="space-x-3">
      <span class="font-bold">Image Prompt</span>
      <button
        disabled={$image_q.isFetching}
        onclick={generate_image}
        class="btn-hover rounded-md bg-tertiary-800 px-1.5 py-0 font-bold text-white dark:bg-tertiary-800"
        >Generate Image</button
      >
      <button
        class="btn-hover p-0 outline-hidden"
        title="Copy Image Prompt"
        onclick={() => copy_text_to_clipboard($image_prompt)}
      >
        <Icon src={BsCopy} class="text-lg" />
      </button>
      {#if $image_q.isFetching}
        <ProgressRing
          value={(image_gen_time_taken / IMAGE_MODELS[image_model][2]) * 100}
          max={100}
          size="size-6"
          strokeLinecap="butt"
          classes="inline-block -mb-2"
          meterBase="stroke-primary-500"
          trackBase="stroke-primary-500/30"
          strokeWidth="15px"
        />
      {:else if show_image_time_status && $image_q.isSuccess}
        <span class="ml-4 text-xs text-stone-500 select-none dark:text-stone-300">
          <Icon src={OiStopwatch16} class="text-base" />
          {pretty_ms($image_q.data.time_taken)}
        </span>
      {/if}
    </div>
    <textarea
      class={cl_join(
        'textarea h-36 border-2 px-1 py-0 text-sm',
        image_prompt_request_error && 'input-error'
      )}
      spellcheck="false"
      bind:value={$image_prompt}
    ></textarea>
    {#if $image_q.data}
      {#if $image_q.isFetching || !$image_q.isSuccess}
        <div class="h-96 placeholder animate-pulse rounded-md"></div>
      {:else}
        <div>
          <section class="mb-10 grid grid-cols-2 gap-3">
            {#each $image_q.data.images as image}
              {#if image}
                <div class="space-y-1">
                  <img
                    src={image.url}
                    alt={image.prompt}
                    title={image.prompt}
                    class="block rounded-md border-2 border-blue-600 dark:border-blue-800"
                    height={1024}
                    width={1024}
                  />
                  <div class="flex items-center justify-center space-x-3">
                    <button
                      onclick={() => download_image(image)}
                      class="btn rounded-md bg-surface-600 px-1 py-1 outline-hidden dark:bg-surface-500"
                    >
                      <Icon src={BsDownload} class="text-xl text-white" />
                    </button>
                  </div>
                </div>
              {:else}
                error
              {/if}
            {/each}
          </section>
        </div>
      {/if}
    {/if}
  {/if}
{/if}
