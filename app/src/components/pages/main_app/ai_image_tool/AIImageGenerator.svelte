<script lang="ts">
  import {
    active_text_data_q_options,
    active_trans_en_data_q_options,
    get_starting_index,
    get_total_count,
    project_map_q_options
  } from '~/state/main_app/data.svelte';
  import {
    ai_tool_opened,
    project_state,
    selected_text_levels,
    editing_mode,
    text_data_present
  } from '~/state/main_app/state.svelte';
  import { TEXT_MODEL_LIST_INFO } from '~/api/routes/ai/ai_types';
  import Icon from '~/tools/Icon.svelte';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import { writable } from 'svelte/store';
  import { Switch } from '$lib/components/ui/switch';
  import { ProgressRing } from '$lib/components/ui/progress-ring';
  import { client } from '~/api/client';
  import { copy_text_to_clipboard, get_permutations } from '~/tools/kry';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { loadLocalConfig } from '../load_local_config';
  import { BsCopy } from 'svelte-icons-pack/bs';
  import { BiImage } from 'svelte-icons-pack/bi';
  import { buildImageAssetDownloadBasename } from '~/tools/download_file_browser';
  import { cl_join } from '~/tools/cl_join';
  import { OiStopwatch16 } from 'svelte-icons-pack/oi';
  import { BsClipboard2Check } from 'svelte-icons-pack/bs';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { delay_dev } from '~/tools/delay';
  import pretty_ms from 'pretty-ms';
  import ms from 'ms';
  import { CgClose } from 'svelte-icons-pack/cg';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Select from '$lib/components/ui/select';
  import * as Carousel from '$lib/components/ui/carousel';
  import { toast } from 'svelte-sonner';
  import BatchImageControls from './BatchImageControls.svelte';
  import ViewImagesDialog from './ViewImagesDialog.svelte';
  import TextImageCard from './TextImageCard.svelte';
  import {
    invalidate_text_image_queries,
    text_images_query_key
  } from '~/state/main_app/batch_query_helpers';

  const project_map_q = createQuery(() => project_map_q_options($project_state));
  const text_data_q = createQuery(() =>
    active_text_data_q_options(
      $selected_text_levels,
      $project_state,
      $text_data_present,
      $editing_mode
    )
  );
  const trans_en_data_q = createQuery(() =>
    active_trans_en_data_q_options(
      $selected_text_levels,
      $project_state,
      $text_data_present,
      $editing_mode
    )
  );

  let total_count = $derived(
    project_map_q.isSuccess
      ? get_total_count($selected_text_levels, project_map_q.data, $project_state?.levels ?? 0)
      : 0
  );

  let selected_text_model: keyof typeof TEXT_MODEL_LIST_INFO = $state('gpt-5.2');
  let view_images_open = $state(false);

  onMount(async () => {
    if (import.meta.env.DEV) {
      const conf = await loadLocalConfig();
      if (conf.use_ai_sample_data) load_ai_sample_data = true;
    }
  });

  $effect(() => {
    if (!$selected_text_levels || !$project_state) return;
    $index = get_starting_index($project_state.project_key, $selected_text_levels);
  });
  let index = writable(1);
  let auto_gen_image = writable(true);
  let shloka_text_prompt = writable('');
  let image_prompt = writable('');
  let load_ai_sample_data = $state(false);
  let image_prompt_request_error = $state(false);

  let show_prompt_time_status = $state(false);
  let show_image_time_status = $state(false);

  onDestroy(() => {
    show_prompt_time_status = false;
    show_image_time_status = false;
  });

  $effect(() => {
    if (show_prompt_time_status) {
      const t_id = setTimeout(() => (show_prompt_time_status = false), 10 * 1000);
      return () => clearTimeout(t_id);
    }
  });
  $effect(() => {
    if (show_image_time_status) {
      const t_id = setTimeout(
        () => (show_image_time_status = false),
        IMAGE_MODEL_GEN_TIME_S[image_model] * 1000
      );
      return () => clearTimeout(t_id);
    }
  });

  type image_models_type = Parameters<typeof client.ai.gen_image.mutate>[0]['image_model'];
  let image_model: image_models_type = $state('gpt-image-2');

  const IMAGE_MODEL_GEN_TIME_S: Record<image_models_type, number> = {
    'gpt-image-1': 30,
    'gpt-image-2': 40
  };

  const IMAGE_MODELS: Record<image_models_type, [string, string]> = {
    'gpt-image-2': ['GPT 2', '$0.053 (₹4.5) / image (medium 1024²)'],
    'gpt-image-1': ['GPT 1', '$0.042 (₹3.5) / image (medium 1024²)']
  };

  $effect(() => {
    !trans_en_data_q.isFetching &&
      trans_en_data_q.isSuccess &&
      !text_data_q.isFetching &&
      text_data_q.isSuccess &&
      (async () => {
        const shloka_text = text_data_q.data![$index].text;
        let prompt = shloka_text;
        const trans_en_all = trans_en_data_q.data!;
        if (trans_en_all.has($index)) prompt += '\n\n' + trans_en_all.get($index);
        $shloka_text_prompt = prompt;
      })();
  });

  $effect(() => {
    $selected_text_levels;
    $index;
    $image_prompt = '';
    generated_images = [];
  });

  const NUMBER_OF_IMAGES = 1;
  let image_gen_time_taken = $state(0);
  let generated_images = $state<
    {
      id: number;
      url: string;
      s3_key: string;
      prompt: string;
      width: number;
      height: number;
      file_format: 'webp';
    }[]
  >([]);

  let image_gen_interval_obj: ReturnType<typeof setInterval> = null!;
  let gen_request_token = 0;

  const same_selection = (a: (number | null)[], b: (number | null)[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const gen_image_mut = createMutation(() => ({
    mutationFn: async () => {
      if (!$project_state) throw new Error('No project');
      const request_token = ++gen_request_token;
      const request_index = $index;
      const request_levels = [...$selected_text_levels];
      const request_prompt = $image_prompt;

      if (import.meta.env.DEV && load_ai_sample_data) {
        await delay_dev(2000);
        const permutation = get_permutations([1, 4], 1)[0];
        const { ai_sample_data } = await import('./ai_sample_data');
        return {
          request_token,
          request_index,
          request_levels,
          request_prompt,
          result: {
            success: true as const,
            time_taken: 0,
            images: Array.from({ length: NUMBER_OF_IMAGES }, (_, i) => {
              const image_index = permutation[i]! - 1;
              return {
                id: -1 - i,
                s3_key: '',
                url: ai_sample_data.sample_images[image_index]!,
                width: 1024,
                height: 1024,
                description: null,
                prompt: `Sample Image ${image_index + 1}`,
                created: Date.now(),
                model: image_model,
                file_format: 'webp' as const
              };
            })
          }
        };
      }
      const result = await client.ai.gen_image.mutate({
        image_prompt: request_prompt,
        number_of_images: NUMBER_OF_IMAGES,
        image_model,
        project_id: $project_state.project_id,
        selected_text_levels: request_levels,
        index: request_index
      });
      return { request_token, request_index, request_levels, request_prompt, result };
    },
    onSuccess: async (payload) => {
      const { request_token, request_index, request_levels, request_prompt, result: out } = payload;
      const is_stale =
        request_token !== gen_request_token ||
        request_index !== $index ||
        !same_selection(request_levels, $selected_text_levels) ||
        request_prompt !== $image_prompt;
      if (is_stale) return;

      if (!out.success) {
        if (out.images && out.images.length > 0) {
          generated_images = out.images.map((img) => ({
            id: img.id,
            url: img.url,
            s3_key: img.s3_key,
            prompt: img.prompt,
            width: img.width,
            height: img.height,
            file_format: img.file_format
          }));
          await invalidate_text_image_queries($project_state?.project_id);
        }
        toast.error('Image generation failed');
        return;
      }
      generated_images = out.images.map((img) => ({
        id: img.id,
        url: img.url,
        s3_key: img.s3_key,
        prompt: img.prompt,
        width: img.width,
        height: img.height,
        file_format: img.file_format
      }));
      show_image_time_status = true;
      image_gen_time_taken = 0;
      await invalidate_text_image_queries($project_state?.project_id);
    },
    onError: (err) => toast.error(err.message || 'Image generation failed'),
    onSettled: () => {
      if (image_gen_interval_obj) {
        clearInterval(image_gen_interval_obj);
        image_gen_interval_obj = null!;
      }
    }
  }));

  const generate_image = async () => {
    image_gen_time_taken = 0;
    image_gen_interval_obj = setInterval(() => {
      image_gen_time_taken++;
      if (image_gen_time_taken >= IMAGE_MODEL_GEN_TIME_S[image_model]) {
        clearInterval(image_gen_interval_obj);
        return;
      }
    }, 1000);
    await gen_image_mut.mutateAsync();
  };

  const image_prompt_q = createQuery(() => ({
    queryKey: [
      'shloka_text_prompt',
      ...$selected_text_levels.slice(0, ($project_state?.levels ?? 1) - 1).reverse(),
      $index
    ],
    queryFn: async () => {
      show_prompt_time_status = false;
      auto_image_generated = false;
      if (import.meta.env.DEV && load_ai_sample_data) {
        await delay_dev(1000);
        const { ai_sample_data } = await import('./ai_sample_data');
        return { image_prompt: ai_sample_data.sample_text_prompt, time_taken: 0 };
      }
      return await client.ai.get_image_prompt.query({
        project_key: $project_state!.project_key,
        selected_text_levels: $selected_text_levels,
        index: $index,
        model: selected_text_model
      });
    },
    enabled: false,
    placeholderData: undefined,
    staleTime: ms('30mins')
  }));
  let auto_image_generated = false;
  $effect(() => {
    if (!image_prompt_q.isFetching && image_prompt_q.isSuccess && image_prompt_q.data.image_prompt)
      untrack(() => {
        $image_prompt = image_prompt_q.data.image_prompt!;
        if (!auto_image_generated && $auto_gen_image) {
          generate_image();
          auto_image_generated = true;
        }
        image_prompt_request_error = false;
        show_prompt_time_status = true;
      });
    else if (image_prompt_q.isError) image_prompt_request_error = true;
  });

  const download_basename = $derived(
    buildImageAssetDownloadBasename($index, text_data_q.data?.[$index]?.shloka_num)
  );

  const shloka_images_q = createQuery(() => ({
    queryKey: text_images_query_key($project_state, $selected_text_levels, $index),
    queryFn: async () => {
      if (!$project_state) return [];
      return client.ai.image_assets.list.query({
        project_id: $project_state.project_id,
        selected_text_levels: $selected_text_levels,
        index: $index
      });
    },
    enabled: !!$project_state
  }));

  const shloka_images = $derived(shloka_images_q.data ?? []);
  const shloka_image_label = $derived(
    text_data_q.data?.[$index]?.shloka_num != null
      ? `${$index}:${text_data_q.data[$index].shloka_num}`
      : `${$index}`
  );

  let copied_text_status = $state(false);
  $effect(() => {
    copied_text_status && setTimeout(() => (copied_text_status = false), 1400);
  });
  const copy_text_with_indicator = (text: string) => {
    copy_text_to_clipboard(text);
    copied_text_status = true;
  };
</script>

{#if copied_text_status}
  <div
    class="fixed right-2 bottom-2 z-50 cursor-default font-bold text-green-700 select-none dark:text-green-300"
  >
    <Icon src={BsClipboard2Check} />
    Copied to Clipboard
  </div>
{/if}
<div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
  <span class="inline-flex items-center gap-1">
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
    <Select.Root
      type="single"
      value={$index.toString()}
      onValueChange={(v) => {
        $index = parseInt(v) || 0;
      }}
      disabled={text_data_q.isFetching}
    >
      <Select.Trigger class="inline-flex w-20 px-1 text-sm">
        {$index}{text_data_q.data?.[$index]?.shloka_num &&
          ` - ${text_data_q.data[$index].shloka_num}`}
      </Select.Trigger>
      <Select.Content>
        {#each Array(total_count) as _, index}
          {#if !text_data_q.isFetching && text_data_q.isSuccess}
            <Select.Item value={index.toString()}>
              {index}{text_data_q.data[index]?.shloka_num &&
                ` - ${text_data_q.data[index].shloka_num}`}
            </Select.Item>
          {/if}
        {/each}
      </Select.Content>
    </Select.Root>
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
  <Button
    variant="outline"
    size="default"
    class="gap-1.5 border-sky-500/40 bg-sky-500/10 px-3 text-base font-bold text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
    onclick={() => (view_images_open = true)}
  >
    <Icon src={BiImage} class="size-7 text-sky-500 dark:text-sky-400" />
    View Images
  </Button>
  <Button
    variant="outline"
    size="sm"
    class="ms-auto gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
    onclick={() => ($ai_tool_opened = false)}
  >
    <Icon src={CgClose} class="text-base" />
    Close AI Image Generator
  </Button>
</div>

<BatchImageControls current_index={$index} current_image_prompt={$image_prompt} {image_model} />

<div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
  <Button
    onclick={async () => {
      await image_prompt_q.refetch();
    }}
    disabled={image_prompt_q.isFetching}
    size="sm"
  >
    Generate Image Prompt
  </Button>
  <Select.Root type="single" bind:value={selected_text_model as any}>
    <Select.Trigger
      class="inline-flex w-20 px-1.5 py-1 text-xs"
      title={TEXT_MODEL_LIST_INFO[selected_text_model][1]}
    >
      {TEXT_MODEL_LIST_INFO[selected_text_model][0]}
    </Select.Trigger>
    <Select.Content>
      {#each Object.entries(TEXT_MODEL_LIST_INFO) as [key, value]}
        <Select.Item value={key} label={value[0]} title={value[1]} />
      {/each}
    </Select.Content>
  </Select.Root>
  {#if show_prompt_time_status && image_prompt_q.isSuccess && image_prompt_q.data.image_prompt}
    <span class="text-xs text-stone-500 select-none dark:text-stone-300">
      <Icon src={OiStopwatch16} class="text-base" />
      {pretty_ms(image_prompt_q.data.time_taken)}
    </span>
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
<div class="flex items-center gap-3">
  <Select.Root type="single" bind:value={image_model as any}>
    <Select.Trigger class="w-24 px-1.5 py-1 text-sm" title={IMAGE_MODELS[image_model][1]}>
      {IMAGE_MODELS[image_model][0]}
    </Select.Trigger>
    <Select.Content>
      {#each Object.entries(IMAGE_MODELS) as option}
        <Select.Item value={option[0]} label={option[1][0]} title={option[1][1]} />
      {/each}
    </Select.Content>
  </Select.Root>
  <Switch id="auto_image" bind:checked={$auto_gen_image} />
  <label for="auto_image" class="text-sm">Auto Generate Image</label>
</div>
{#if image_prompt_q.data !== undefined || image_prompt_q.isFetching}
  {#if image_prompt_q.isFetching || !image_prompt_q.isSuccess}
    <Skeleton class="h-80" />
  {:else}
    <div class="flex flex-wrap items-center gap-3">
      <span class="font-bold">Image Prompt</span>
      <Button
        disabled={gen_image_mut.isPending}
        onclick={generate_image}
        size="sm"
        variant="secondary">Generate Image</Button
      >
      <Button
        variant="ghost"
        size="icon"
        title="Copy Image Prompt"
        onclick={() => copy_text_to_clipboard($image_prompt)}
      >
        <Icon src={BsCopy} class="text-lg" />
      </Button>
      {#if gen_image_mut.isPending}
        <ProgressRing
          value={(image_gen_time_taken / IMAGE_MODEL_GEN_TIME_S[image_model]) * 100}
          max={100}
          size="size-6"
          strokeWidth="15px"
          class="-mb-2"
          meterClass="stroke-primary"
          trackClass="stroke-primary/30"
        />
      {:else if show_image_time_status && gen_image_mut.isSuccess && gen_image_mut.data?.result.success}
        <span class="text-xs text-stone-500 select-none dark:text-stone-300">
          <Icon src={OiStopwatch16} class="text-base" />
          {pretty_ms(gen_image_mut.data.result.time_taken)}
        </span>
      {/if}
    </div>
    <Textarea
      class={cl_join('h-36 px-1 py-0 text-sm', image_prompt_request_error && 'border-destructive')}
      spellcheck="false"
      bind:value={$image_prompt}
    />
    {#if generated_images.length > 0 || gen_image_mut.isPending}
      {#if gen_image_mut.isPending}
        <Skeleton class="h-96" />
      {:else}
        <section class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {#each generated_images as image (image.id)}
            <div class="rounded-md border-2 border-blue-600 dark:border-blue-800">
              <TextImageCard
                url={image.url}
                s3_key={image.s3_key}
                alt={image.prompt}
                width={image.width}
                height={image.height}
                label="Just generated"
                {download_basename}
              />
            </div>
          {/each}
        </section>
      {/if}
    {/if}
  {/if}
{/if}

<section class="mt-6 flex flex-col gap-3 border-t border-border pt-4">
  <div class="flex items-center justify-between gap-2">
    <h3 class="text-sm font-semibold">Images for this shloka</h3>
    {#if shloka_images_q.isSuccess}
      <span class="text-xs text-muted-foreground">{shloka_images.length} image(s)</span>
    {/if}
  </div>

  {#if shloka_images_q.isLoading}
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {#each Array(3) as _, i (i)}
        <Skeleton class="aspect-square w-full rounded-md" />
      {/each}
    </div>
  {:else if shloka_images_q.isError}
    <p class="py-6 text-center text-sm text-destructive">
      Failed to load images. {shloka_images_q.error.message}
    </p>
  {:else if shloka_images.length === 0}
    <p class="py-6 text-center text-sm text-muted-foreground">No images for this shloka yet.</p>
  {:else}
    <Carousel.Root opts={{ align: 'start', loop: false }} class="w-full">
      <Carousel.Content class="-ms-3">
        {#each shloka_images as item (item.image.id)}
          <Carousel.Item class="basis-4/5 ps-3 sm:basis-1/2 md:basis-1/3">
            <TextImageCard
              url={item.image.url}
              s3_key={item.image.s3_key}
              alt={item.image.description ?? shloka_image_label}
              width={item.image.width}
              height={item.image.height}
              label={shloka_image_label}
              {download_basename}
            />
          </Carousel.Item>
        {/each}
      </Carousel.Content>
      <Carousel.Previous class="-left-3" />
      <Carousel.Next class="-right-3" />
    </Carousel.Root>
  {/if}
</section>

<ViewImagesDialog bind:open={view_images_open} focus_index={$index} />
