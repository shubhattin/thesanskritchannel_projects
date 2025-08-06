<script lang="ts">
  import Markdown from 'svelte-markdown';
  import { fade, fly, slide } from 'svelte/transition';
  import pretty_ms from 'pretty-ms';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { LANGUAGES, MODELS_LIST, MODEL_NAMES, type models_list_type } from './grammar_data';
  import {
    get_map_type,
    get_project_from_key,
    get_project_info_from_key,
    PROJECT_LIST,
    type project_keys_type
  } from '~/state/project_list';
  import { createQuery } from '@tanstack/svelte-query';
  import {
    get_total_count,
    project_map_q_options,
    text_data_q_options
  } from '~/state/main_app/data.svelte';
  import Icon from '~/tools/Icon.svelte';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';

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
  let project_info = $derived(
    selected_project_key ? get_project_info_from_key(selected_project_key!) : null
  );

  type option_type = { text?: string; value?: number };
  let project_map_q = $derived(
    createQuery({
      ...project_map_q_options(project?.id!, project?.key!),
      enabled: !!selected_project_key
    })
  );
  let selected_text_levels = $state<(number | null)[]>([]);

  let text_data_present = $derived.by(() => {
    if (!project_info) return false;
    for (let i = 0; i < project_info!.levels! - 1; i++) {
      if (!selected_text_levels[i]) {
        return false;
      }
    }
    return true;
  });

  let text_data_q = $derived(
    createQuery({
      ...text_data_q_options(selected_text_levels, project?.key!, project_info?.levels!),
      enabled: text_data_present && !!selected_project_key
    })
  );

  let shloka_number = $state(0);
  let total_count = $derived.by(() => {
    if (!project_info || !$project_map_q.isSuccess) return 0;
    const levels = project_info?.levels!;
    const project_map = $project_map_q.data;

    let total_count = 0;
    if (levels === 2) {
      total_count = get_map_type(project_map, 2)[selected_text_levels[0]! - 1].total;
    } else if (levels === 3) {
      total_count = get_map_type(project_map, 3)[selected_text_levels[1]! - 1].list[
        selected_text_levels[0]! - 1
      ].total;
    } else if (levels === 1) {
      total_count = get_map_type(project_map, 1).total;
    }
    return total_count;
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
    <Switch checked={load_text_source} onCheckedChange={(e) => (load_text_source = e.checked)} />
    <span class="font-semibold">Text Source</span>
  </div>
  <label class="flex items-center gap-2">
    <span class="label-text text-xs font-semibold">Model</span>
    <select bind:value={model} class="select w-36 px-1 pr-1.5 text-xs">
      {#each MODELS_LIST as model_key}
        <option value={model_key}>{MODEL_NAMES[model_key]}</option>
      {/each}
    </select>
  </label>
  {#if !load_text_source}
    <div transition:slide class="space-y-3">
      <label class="flex items-center gap-2">
        <span class="label-text text-sm">Language</span>
        <select bind:value={langugae} class="select w-28 text-sm">
          {#each LANGUAGES as lang}
            <option value={lang}>{lang}</option>
          {/each}
        </select>
      </label>
      <textarea class="textarea h-52" bind:value={shloka}></textarea>
    </div>
  {:else}
    <div class="flex items-center justify-start space-x-6">
      <label class="flex items-center gap-2">
        <span class="text-base font-semibold">Project</span>
        <select bind:value={selected_project_key} class="select w-44 px-1.5 py-1 text-sm">
          <option value={null}>Select Project</option>
          {#each PROJECT_LIST as project}
            <option value={project.key}>{project.name}</option>
          {/each}
        </select>
      </label>
    </div>
    {#if selected_project_key && project_info && project && $project_map_q.isSuccess}
      <div class="flex items-center justify-start space-x-4">
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
            {:else if i === 1 && !!selected_text_levels[1]}
              {@render selecter({
                name: level_name,
                text_level_state_index: 0,
                options:
                  map_info &&
                  map_info[selected_text_levels[1] - 1].list.map((text_level) => ({
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
            transition:fade
            class={`select inline-block w-40 p-1 text-sm ring-2`}
            bind:value={selected_text_levels[text_level_state_index]}
          >
            <option value={null}>Select</option>
            {#if !options}
              {#if initial_option && initial_option.value}
                <option value={initial_option.value} selected
                  >{initial_option.value}. {initial_option.text}</option
                >
              {/if}
            {:else}
              {#each options as option}
                <option value={option.value}>{option.value}. {option.text}</option>
              {/each}
            {/if}
          </select>
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
        <select
          class="select inline-block w-20 p-1 text-sm ring-2"
          bind:value={shloka_number}
          disabled={$text_data_q.isFetching}
        >
          {#if $text_data_q.isSuccess && !$text_data_q.isFetching}
            {#each Array(total_count) as _, index}
              <option value={index}
                >{index}{$text_data_q.data![index]?.shloka_num &&
                  ` - ${$text_data_q.data![index].shloka_num}`}</option
              >
            {/each}
          {/if}
        </select>
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
    <div class="rounded=md h-96 placeholder animate-pulse"></div>
  {:else if analysis_result}
    <div class="prose text-sm prose-neutral dark:prose-invert" in:fade>
      <Markdown source={analysis_result} />
    </div>
    {#if !is_fetching}
      <p class="mt-4 text-xs text-gray-500">
        Time taken: {pretty_ms(time_taken)}
      </p>
    {/if}
  {/if}
</div>
