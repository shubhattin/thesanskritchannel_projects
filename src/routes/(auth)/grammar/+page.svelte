<script lang="ts">
  import Markdown from 'svelte-markdown';
  import { fade } from 'svelte/transition';
  import pretty_ms from 'pretty-ms';

  let langugae = $state('Hindi');
  let shloka = $state('');

  const LANGUAGES = [
    'Hindi',
    'English',
    'Sanskrit',
    'Telugu',
    'Kannada',
    'Marathi',
    'Tamil',
    'Malayalam',
    'Bengali',
    'Gujarati'
  ] as const;

  type models_list_type = (typeof MODELS_LIST)[number];
  const MODELS_LIST = [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gemini-2.0-flash',
    'gemini-2.5-flash'
  ] as const;
  const MODEL_NAMES: Record<models_list_type, string> = {
    'gpt-4.1': 'GPT-4.1',
    'gpt-4.1-mini': 'GPT-4.1 Mini',
    'gpt-4.1-nano': 'GPT-4.1 Nano',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash'
  } as const;
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
</script>

<svelte:head>
  <title>व्याकरणम्</title>
</svelte:head>

<div class="mt-6 space-y-4">
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
  <button
    class="btn preset-filled-primary-200-800 font-semibold"
    onclick={analyzeShloka}
    disabled={is_fetching}
  >
    Analyze
  </button>
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
