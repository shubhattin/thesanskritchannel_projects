<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { client } from '~/api/client';
  import Markdown from 'svelte-markdown';
  import { fade } from 'svelte/transition';

  let langugae = $state('Hindi');
  let shloka = $state('');

  const shloka_analysis_q = createQuery({
    queryKey: ['grammer', 'shloka_analysis'],
    queryFn: async () => {
      const out = client.grammer.grammer_analysis.query({
        shloka,
        lang: langugae
      });
      return out;
    },
    enabled: false
  });

  const LANGUAGES = ['Hindi', 'English', 'Sanskrit'] as const;
</script>

<svelte:head>
  <title>व्याकरणम्</title>
</svelte:head>

<div class="mt-6 space-y-4">
  <div class="text-center text-2xl font-semibold text-primary-200">
    <h1>Grammer Analysis</h1>
  </div>
  <div class="space-y-4">
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
    {@const data = $shloka_analysis_q.data}
    <div class="prose text-sm prose-neutral dark:prose-invert" in:fade>
      <Markdown source={data} />
    </div>
  {/if}
</div>
