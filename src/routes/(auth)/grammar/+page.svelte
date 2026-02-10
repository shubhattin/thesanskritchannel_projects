<script lang="ts">
  import Markdown from 'svelte-markdown';
  import { fade, fly, slide } from 'svelte/transition';
  import pretty_ms from 'pretty-ms';
  import { Switch } from '$lib/components/ui/switch';
  import { LANGUAGES, MODELS_LIST, MODEL_NAMES, type models_list_type } from './grammar_data';
  import {
    clamp_levels_for_route,
    get_level_names_from_map,
    get_levels_from_map,
    get_list_name_at_depth_from_selected,
    get_node_at_path,
    get_project_from_key,
    PROJECT_LIST,
    type project_keys_type
  } from '~/state/project_list';
  import { createQuery } from '@tanstack/svelte-query';
  import { project_map_q_options, text_data_q_options } from '~/state/main_app/data.svelte';
  import Icon from '~/tools/Icon.svelte';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import * as Select from '$lib/components/ui/select';
  import { Skeleton } from '$lib/components/ui/skeleton';

  let langugae = $state('Hindi');
  let shloka = $state('');

  let model: models_list_type = $state('gpt-4.1');

  let analysis_result = $state('');
  let is_fetching = $state(false);
  let time_taken = $state(0);

  async function analyzeShloka() {
    if (!shloka || shloka.length === 0) return;

    is_fetching = true;
    analysis_result = '';
    const start_time = Date.now();

    try {
      const response = await fetch('/api/stream_grammar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shloka,
          lang: langugae,
          model
        })
      });

      if (!response.body) {
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        analysis_result += chunk;
      }
    } catch (error) {
      console.error('Error fetching stream:', error);
    } finally {
      is_fetching = false;
      time_taken = Date.now() - start_time;
    }
  }

  let load_text_source = $state(true);
  let selected_project_key = $state<project_keys_type | null>(null);

  let project = $derived(selected_project_key ? get_project_from_key(selected_project_key!) : null);

  type option_type = { text?: string; value?: number };
  let project_map_q = $derived(
    createQuery({
      ...project_map_q_options(project?.id!, project?.key!),
      enabled: !!selected_project_key
    })
  );
  let selected_text_levels = $state<(number | null)[]>([]);

  const levels = $derived.by(() => {
    if (!selected_project_key || !$project_map_q.isSuccess) return 0;
    return clamp_levels_for_route(get_levels_from_map($project_map_q.data));
  });

  const level_names = $derived.by(() => {
    if (!selected_project_key || !$project_map_q.isSuccess) return [] as string[];
    const lvls = clamp_levels_for_route(get_levels_from_map($project_map_q.data));
    return get_level_names_from_map($project_map_q.data).slice(0, lvls);
  });

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

  const get_total_count_from_map = (
    levels: number,
    project_map: any,
    selected: (number | null)[]
  ) => {
    if (levels === 1)
      return project_map?.info?.type === 'shloka' ? (project_map.info.total ?? 0) : 0;
    for (let i = 0; i < levels - 1; i++) if (!selected[i]) return 0;
    const path_params = selected.slice(0, levels - 1).reverse() as number[];
    const node = get_node_at_path(project_map, path_params);
    if (!node || node.info.type !== 'shloka') return 0;
    return node.info.total ?? 0;
  };

  $effect(() => {
    // keep selected_text_levels sized to levels - 1
    if (!levels) {
      selected_text_levels = [];
      return;
    }
    const desired_len = levels - 1;
    if (selected_text_levels.length !== desired_len) {
      const next = Array.from({ length: desired_len }, (_, i) => selected_text_levels[i] ?? null);
      selected_text_levels = next;
    }
  });

  let text_data_present = $derived.by(() => {
    if (!levels) return false;
    for (let i = 0; i < levels - 1; i++) {
      if (!selected_text_levels[i]) {
        return false;
      }
    }
    return true;
  });

  let text_data_q = $derived(
    createQuery({
      ...text_data_q_options(selected_text_levels, project?.key!, levels),
      enabled: text_data_present && !!selected_project_key && !!levels
    })
  );

  let shloka_number = $state(0);
  let total_count = $derived.by(() => {
    if (!levels || !$project_map_q.isSuccess) return 0;
    const project_map = $project_map_q.data;
    return get_total_count_from_map(levels, project_map, selected_text_levels);
  });

  $effect(() => {
    if (selected_text_levels) {
      shloka_number = 0;
      analysis_result = '';
    }
  });

  $effect(() => {
    if (shloka_number) {
      analysis_result = '';
    }
  });

  $effect(() => {
    if (text_data_present && $text_data_q.isSuccess) {
      shloka = $text_data_q.data[shloka_number].text;
    }
  });
</script>

<svelte:head>
  <title>व्याकरणम्</title>
</svelte:head>
<div class="mt-6 space-y-4">
  <div class="flex items-center justify-center gap-2">
    <span>Custom Text</span>
    <Switch bind:checked={load_text_source} />
    <span class="font-semibold">Text Source</span>
  </div>
  <label class="flex items-center gap-2">
    <span class="label-text text-xs font-semibold">Model</span>
    <Select.Root type="single" bind:value={model as any}>
      <Select.Trigger class="w-36 px-1 pr-1.5 text-xs">
        {MODEL_NAMES[model]}
      </Select.Trigger>
      <Select.Content>
        {#each MODELS_LIST as model_key}
          <Select.Item value={model_key}>{MODEL_NAMES[model_key]}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </label>
  {#if !load_text_source}
    <div transition:slide class="space-y-3">
      <label class="flex items-center gap-2">
        <span class="label-text text-sm">Language</span>
        <Select.Root type="single" bind:value={langugae as any}>
          <Select.Trigger class="w-28 text-sm">
            {langugae}
          </Select.Trigger>
          <Select.Content>
            {#each LANGUAGES as lang}
              <Select.Item value={lang}>{lang}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </label>
      <textarea class="textarea h-52" bind:value={shloka}></textarea>
    </div>
  {:else}
    <div class="flex items-center justify-start space-x-6">
      <label class="flex items-center gap-2">
        <span class="text-base font-semibold">Project</span>
        <Select.Root type="single" bind:value={selected_project_key as any}>
          <Select.Trigger class="w-44 px-1.5 py-1 text-sm">
            {PROJECT_LIST.find((p) => p.key === selected_project_key)?.name ?? 'Select Project'}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={null!}>Select Project</Select.Item>
            {#each PROJECT_LIST as project}
              <Select.Item value={project.key}>{project.name}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </label>
    </div>
    {#if selected_project_key && project && $project_map_q.isSuccess && levels > 0}
      <div class="flex items-center justify-start space-x-4">
        {#each { length: levels - 1 } as _, i}
          {@const text_level_state_index = levels - i - 2}
          {@const map_root = $project_map_q.isSuccess && $project_map_q.data}
          {@const fallback_level_name = level_names[levels - i - 1]}
          {@const level_name =
            map_root && levels > 0
              ? get_list_name_at_depth_from_selected(
                  map_root,
                  levels,
                  selected_text_levels,
                  i,
                  fallback_level_name
                )
              : fallback_level_name}
          {@const list_at_depth =
            map_root && get_map_list_at_depth(map_root, levels, selected_text_levels, i)}
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
            value={selected_text_levels[text_level_state_index]?.toString() ?? ''}
            onValueChange={(v) => {
              const next_value = v ? parseInt(v) : null;
              selected_text_levels[text_level_state_index] = next_value;
              // If a higher level changes, clear all dependent lower levels.
              for (let i = 0; i < text_level_state_index; i++) {
                selected_text_levels[i] = null;
              }
            }}
          >
            <Select.Trigger class="flex h-10 w-40 p-1 text-sm">
              {selected_text_levels[text_level_state_index]
                ? `${selected_text_levels[text_level_state_index]}. ${
                    options
                      ? (options.find(
                          (o) => o.value === selected_text_levels[text_level_state_index]
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
                {#each options as option}
                  <Select.Item value={option.value!.toString()}
                    >{option.value}. {option.text}</Select.Item
                  >
                {/each}
              {/if}
            </Select.Content>
          </Select.Root>
        {/snippet}
      </div>
    {/if}
    {#if text_data_present && $text_data_q.isSuccess}
      <div class="block space-x-2" transition:slide>
        <button
          class="btn p-0"
          disabled={shloka_number === 0 || $text_data_q.isFetching}
          onclick={() => {
            shloka_number--;
          }}
        >
          <Icon src={TiArrowBackOutline} class="-mt-1 text-lg" />
        </button>
        <Select.Root
          type="single"
          value={shloka_number.toString()}
          onValueChange={(v) => {
            shloka_number = parseInt(v) || 0;
          }}
          disabled={$text_data_q.isFetching}
        >
          <Select.Trigger class="inline-flex h-9 w-20 p-1 text-sm">
            {shloka_number}{$text_data_q.isSuccess && $text_data_q.data?.[shloka_number]?.shloka_num
              ? ` - ${$text_data_q.data[shloka_number].shloka_num}`
              : ''}
          </Select.Trigger>
          <Select.Content>
            {#if $text_data_q.isSuccess && !$text_data_q.isFetching}
              {#each Array(total_count) as _, index}
                <Select.Item value={index.toString()}>
                  {index}{$text_data_q.data![index]?.shloka_num &&
                    ` - ${$text_data_q.data![index].shloka_num}`}
                </Select.Item>
              {/each}
            {/if}
          </Select.Content>
        </Select.Root>
        <button
          class="btn p-0"
          onclick={() => {
            shloka_number++;
          }}
          disabled={shloka_number === total_count - 1 || $text_data_q.isFetching}
        >
          <Icon src={TiArrowForwardOutline} class="-mt-1 text-lg" />
        </button>
      </div>
      <div transition:slide>
        {#each $text_data_q.data[shloka_number].text.split('\n') as line}
          <div>{line}</div>
        {/each}
      </div>
    {/if}
  {/if}
  {#if !load_text_source || (load_text_source && text_data_present && $text_data_q.isSuccess)}
    <button
      transition:fly
      class="btn preset-filled-primary-200-800 font-semibold"
      onclick={analyzeShloka}
      disabled={is_fetching}
    >
      Analyze
    </button>
  {/if}
  {#if is_fetching && !analysis_result}
    <Skeleton class="h-96" />
  {:else if analysis_result}
    <div class="prose prose-neutral dark:prose-invert text-sm" in:fade>
      <Markdown source={analysis_result} />
    </div>
    {#if !is_fetching}
      <p class="mt-4 text-xs text-gray-500">
        Time taken: {pretty_ms(time_taken)}
      </p>
    {/if}
  {/if}
</div>
