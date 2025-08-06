<script lang="ts">
  import Markdown from 'svelte-markdown';
  import { fade } from 'svelte/transition';
  import pretty_ms from 'pretty-ms';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { LANGUAGES, MODELS_LIST, MODEL_NAMES, type models_list_type } from './grammer_data';

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
</script>

<svelte:head>
  <title>व्याकरणम्</title>
</svelte:head>
<div class="mt-6 space-y-4">
  <div class="flex items-center justify-center gap-2">
    <span>Custom Text</span>
    <Switch checked={load_text_source} onCheckedChange={(e) => (load_text_source = e.checked)} />
    <span>Text Source</span>
  </div>
  {#if !load_text_source}
    <div class="space-y-3">
      <label class="flex items-center gap-2">
        <span class="label-text text-xs font-semibold">Model</span>
        <select bind:value={model} class="select w-36 px-1 pr-1.5 text-xs">
          {#each MODELS_LIST as model_key}
            <option value={model_key}>{MODEL_NAMES[model_key]}</option>
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
  {/if}
  {#if !load_text_source}
    <button
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
