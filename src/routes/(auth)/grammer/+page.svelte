<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { client } from '~/api/client';
  import Markdown from 'svelte-markdown';
  import { fade } from 'svelte/transition';
  import pretty_ms from 'pretty-ms';

  let langugae = $state('Hindi');
  let shloka = $state('');

  const shloka_analysis_q = createQuery({
    queryKey: ['grammer', 'shloka_analysis'],
    queryFn: async () => {
      const out = client.grammer.grammer_analysis.query({
        shloka,
        lang: langugae,
        model
      });
      return out;
    },
    enabled: false
  });

  const LANGUAGES = ['Hindi', 'English', 'Sanskrit'] as const;
  type models_list_type = Parameters<typeof client.grammer.grammer_analysis.query>[0]['model'];
  const MODEL_NAMES: Record<models_list_type, string> = {
    'gpt-4.1': 'GPT-4.1',
    'gpt-4.1-mini': 'GPT-4.1 Mini',
    'gpt-4.1-nano': 'GPT-4.1 Nano',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash'
  };
  let model: models_list_type = $state('gpt-4.1');
</script>

<svelte:head>
  <title>व्याकरणम्</title>
</svelte:head>

<div class="mt-6 space-y-4">
  <div class="space-y-3">
    <label class="flex items-center gap-2">
      <span class="label-text text-xs font-semibold">Model</span>
      <select bind:value={model} class="select w-36 px-1 pr-1.5 text-xs">
        {#each Object.keys(MODEL_NAMES) as model}
          <option value={model as models_list_type}>{MODEL_NAMES[model as models_list_type]}</option
          >
        {/each}
      </select>
    </label>
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
  <button
    class="btn preset-filled-primary-200-800 font-semibold"
    onclick={() => {
      if (shloka && shloka.length > 0) {
        $shloka_analysis_q.refetch();
      }
    }}
    disabled={$shloka_analysis_q.isFetching}
  >
    Analyze
  </button>
  {#if $shloka_analysis_q.isFetching}
    <div class="rounded=md h-72 placeholder animate-pulse"></div>
  {:else if $shloka_analysis_q.isSuccess}
    {@const { text, time_ms } = $shloka_analysis_q.data}
    <div class="prose text-sm prose-neutral dark:prose-invert" in:fade>
      <Markdown source={text} />
    </div>
    <p class="mt-4 text-xs text-gray-500">
      Time taken: {pretty_ms(time_ms)}
    </p>
  {/if}
</div>
