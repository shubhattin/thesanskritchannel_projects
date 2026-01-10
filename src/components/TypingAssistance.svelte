<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import {
    SCRIPT_LIST,
    preloadScriptData,
    type ScriptLangType,
    type ScriptListType
  } from 'lipilekhika';
  import { getScriptKramaData, getScriptTypingDataMap } from 'lipilekhika/typing';
  import { delay } from '~/tools/delay';
  import { ALL_LANG_SCRIPT_LIST } from '~/state/lang_list';
  import { cl_join } from '~/tools/cl_join';
  import { onDestroy } from 'svelte';
  import { Modal, Tabs } from '@skeletonlabs/skeleton-svelte';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';

  interface Props {
    sync_lang_script: string;
    modal_opened: boolean;
  }

  let { sync_lang_script, modal_opened = $bindable() }: Props = $props();
  let typing_assistance_lang = $derived(sync_lang_script);
  type TabsValue = 'image' | 'typing-map' | 'compare-scripts';
  let active_tab = $state<TabsValue>('image');

  const IMAGE_SCALING = 0.81;
  const ONE_PX = 1;
  const HEIGHT = 682 * IMAGE_SCALING;
  const WIDTH = 658 * IMAGE_SCALING;

  const scripts_list = SCRIPT_LIST as ScriptListType[];
  const ensureScriptListType = (value: string): ScriptListType => {
    if (scripts_list.includes(value as ScriptListType)) return value as ScriptListType;
    return scripts_list[0];
  };

  const script_for_helpers = $derived(ensureScriptListType(typing_assistance_lang));

  let script_to_compare_value = $state(
    scripts_list.includes('Romanized' as ScriptListType) ? 'Romanized' : ''
  );

  const script_to_compare = $derived(
    script_to_compare_value && scripts_list.includes(script_to_compare_value as ScriptListType)
      ? (script_to_compare_value as ScriptListType)
      : undefined
  );

  const available_compare_scripts = $derived(
    scripts_list.filter((script) => script !== script_for_helpers && script !== 'Normal')
  );

  let script_typing_map_promise = $derived(getScriptTypingDataMap(script_for_helpers));

  let base_script_krama_prom = $derived(getScriptKramaData(script_for_helpers));
  let script_to_compare_krama_prom = $derived(
    script_to_compare ? getScriptKramaData(script_to_compare) : null
  );

  type ListType = 'svara' | 'vyanjana' | 'anya' | 'mAtrA';
  type Item = [text: string, type: ListType, mappings: string[]];
  type KramaRow = [text: string, type: ListType];

  const isSvara = (t: ListType) => t === 'svara' || t === 'mAtrA';

  const filterCategory = (items: Item[], category: 'svara' | 'vyanjana' | 'anya') => {
    if (category === 'svara') return items.filter(([, t]) => isSvara(t));
    if (category === 'vyanjana') return items.filter(([, t]) => t === 'vyanjana');
    return items.filter(([, t]) => t === 'anya');
  };

  $effect(() => {
    if (
      script_to_compare_value &&
      !available_compare_scripts.includes(script_to_compare_value as ScriptListType)
    ) {
      script_to_compare_value = '';
    }
  });

  let usage_table = $derived(
    createQuery({
      queryKey: ['usage_table', typing_assistance_lang],
      enabled: modal_opened,
      queryFn: async () => {
        await delay(700);
        const script_data_load_promise = preloadScriptData(
          typing_assistance_lang as ScriptLangType
        );
        const IMAGE_URLS = import.meta.glob('/src/tools/converter/resources/images/*.png', {
          eager: true,
          query: '?url'
        });
        const image_lang =
          typing_assistance_lang === 'Devanagari' ? 'Sanskrit' : typing_assistance_lang;
        const url = (IMAGE_URLS[`/src/tools/converter/resources/images/${image_lang}.png`] as any)
          .default as string;
        const get_image_dimensiona = async (url: string) => {
          return new Promise<{ width: number; height: number }>((resolve, reject) => {
            let img = new Image();
            img.onload = function () {
              resolve({
                // @ts-ignore
                width: this.width * ONE_PX * IMAGE_SCALING,
                // @ts-ignore
                height: this.height * ONE_PX * IMAGE_SCALING
              });
            };
            img.src = url;
          });
        };
        const { height, width } = await get_image_dimensiona(url);
        await Promise.all([script_data_load_promise]);
        return { url, height, width };
      }
    })
  );
  onDestroy(() => {
    modal_opened = false;
  });
</script>

<Modal
  open={modal_opened}
  onOpenChange={(e) => (modal_opened = e.open)}
  contentBase="card p-1 dark:bg-slate-900 bg-slate-200  space-y-4 shadow-xl max-w-(--breakpoint-sm) mx-3 mt-0 max-h-[97%] max-w-[97%] overflow-scroll"
  backdropClasses="backdrop-blur-xs"
>
  {#snippet content()}
    <div class="flex w-[97%] justify-end">
      <button
        aria-label="Close"
        class="absolute cursor-pointer text-gray-500 outline-none select-none hover:text-gray-700"
        onclick={() => (modal_opened = false)}><Icon src={AiOutlineClose} /></button
      >
    </div>
    <div class="space-y-4">
      <div>
        <select class="select w-40" bind:value={typing_assistance_lang}>
          {#each ALL_LANG_SCRIPT_LIST.filter((src) => src !== 'English') as lang_script}
            <option value={lang_script}>{lang_script}</option>
          {/each}
        </select>
      </div>

      <Tabs
        value={active_tab}
        onValueChange={(e) => (active_tab = e.value as TabsValue)}
        contentBase="space-y-4"
      >
        {#snippet list()}
          <Tabs.Control value="image">Image</Tabs.Control>
          <Tabs.Control value="typing-map">Typing Map</Tabs.Control>
          <Tabs.Control value="compare-scripts">Compare Scripts</Tabs.Control>
        {/snippet}
        {#snippet content()}
          {#if active_tab === 'image'}
            <div
              class={cl_join(
                'mt-4 max-w-full',
                !$usage_table.isFetching ? 'min-h-[580px] min-w-[560px]' : 'h-[580px] w-[560px]'
              )}
              style="
            min-height: {!$usage_table.isFetching ? `${HEIGHT}px` : 'auto'};
            min-width: {!$usage_table.isFetching ? `${WIDTH}px` : 'auto'};
            height: {$usage_table.isFetching ? `${HEIGHT}px` : 'auto'};
            width: {$usage_table.isFetching ? `${WIDTH}px` : 'auto'};
            "
            >
              {#if $usage_table.isFetching}
                <div class="h-full w-full space-y-1">
                  <div class="h-full placeholder w-full animate-pulse rounded-lg"></div>
                  <div class="placeholder animate-pulse rounded-md"></div>
                </div>
              {:else if $usage_table.isSuccess}
                {@const { url, height, width } = $usage_table.data}
                <img
                  style:height={`${height}px`}
                  style:width={`${width}px`}
                  alt={`${typing_assistance_lang} Usage Table`}
                  src={url}
                  class="block"
                />
                <div class="text-sm text-wrap text-stone-500 dark:text-stone-400">
                  Also use <span class="font-semibold">Lekhan Sahayika</span> in
                  <a
                    href="https://app-lipilekhika.pages.dev"
                    target="_blank"
                    class="text-blue-500 underline dark:text-blue-400">Lipi Lekhika</a
                  >
                  to familiarise yourself with the typing tool.
                </div>
              {/if}
            </div>
          {:else if active_tab === 'typing-map'}
            <div class="mt-2 flex-1 space-y-4 pr-1">
              {#await script_typing_map_promise}
                <section class="space-y-6" aria-label="Loading typing map">
                  {#each ['Svara', 'Vyanjana', 'Other', 'Script-specific Characters'] as title (title)}
                    <div>
                      <div class="mb-2 flex items-center justify-between gap-2">
                        <div
                          class="h-6 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800"
                        ></div>
                      </div>
                      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {#each Array.from({ length: 12 }) as _, idx (title + idx)}
                          <div
                            class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50"
                          >
                            <div
                              class="h-6 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-800"
                            ></div>
                            <div class="mt-2 flex flex-wrap gap-1">
                              <div
                                class="h-4 w-8 animate-pulse rounded bg-slate-200 opacity-70 dark:bg-slate-800"
                              ></div>
                              <div
                                class="h-4 w-10 animate-pulse rounded bg-slate-200 opacity-60 dark:bg-slate-800"
                              ></div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </section>
              {:then script_typing_map}
                {@const common = (script_typing_map.common_krama_map ?? []) as Item[]}
                {@const specific = (script_typing_map.script_specific_krama_map ?? []) as Item[]}
                {@const svaraItems = filterCategory(common, 'svara')}
                {@const vyanjanaItems = filterCategory(common, 'vyanjana')}
                {@const otherItems = filterCategory(common, 'anya')}

                <section class="space-y-6">
                  <div>
                    <div class="mb-2 flex items-center justify-between gap-2">
                      <h3 class="text-lg font-semibold tracking-wide">Svara</h3>
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {#if svaraItems.length === 0}
                        <div
                          class="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50"
                        >
                          No svara entries found for {script_for_helpers}.
                        </div>
                      {:else}
                        {#each svaraItems as [char, type, mappings] (char + type)}
                          <div
                            class="group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                          >
                            <div class="flex items-start justify-between gap-2">
                              <div class="text-2xl leading-none font-semibold">{char}</div>
                            </div>
                            <div
                              class="mt-2 flex max-h-20 flex-wrap items-start gap-1 overflow-auto pr-1"
                            >
                              {#each mappings as m (m)}
                                <span
                                  class="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {m}
                                </span>
                              {/each}
                            </div>
                          </div>
                        {/each}
                      {/if}
                    </div>
                  </div>

                  <div>
                    <div class="mb-2 flex items-center justify-between gap-2">
                      <h3 class="text-lg font-semibold tracking-wide">Vyanjana</h3>
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {#each vyanjanaItems as [char, type, mappings] (char + type)}
                        <div
                          class="group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                        >
                          <div class="flex items-start justify-between gap-2">
                            <div class="text-2xl leading-none font-semibold">{char}</div>
                          </div>
                          <div class="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto pr-1">
                            {#each mappings as m (m)}
                              <span
                                class="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {m}
                              </span>
                            {/each}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>

                  <div>
                    <div class="mb-2 flex items-center justify-between gap-2">
                      <h3 class="text-lg font-semibold tracking-wide">Other</h3>
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {#each otherItems as [char, type, mappings] (char + type)}
                        <div
                          class="group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                        >
                          <div class="flex items-start justify-between gap-2">
                            <div class="text-2xl leading-none font-semibold">{char}</div>
                          </div>
                          <div class="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto pr-1">
                            {#if mappings.length === 0}
                              <span class="text-xs text-slate-500 dark:text-slate-400"
                                >No mappings</span
                              >
                            {:else}
                              {#each mappings as m (m)}
                                <span
                                  class="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {m}
                                </span>
                              {/each}
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>

                  <div>
                    <div class="mb-2 flex items-center justify-between gap-2">
                      <h3 class="text-lg font-semibold tracking-wide">
                        Script-specific Characters
                      </h3>
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {#each specific as [char, type, mappings] (char + type)}
                        <div
                          class="group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                        >
                          <div class="flex items-start justify-between gap-2">
                            {#if char !== '\u200d'}
                              <div class="text-2xl leading-none font-semibold">{char}</div>
                            {:else}
                              <div class="text-xs leading-none font-semibold">
                                zero width joiner
                              </div>
                            {/if}
                          </div>
                          <div class="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto pr-1">
                            {#if mappings.length === 0}
                              <span class="text-xs text-slate-500 dark:text-slate-400"
                                >No mappings</span
                              >
                            {:else}
                              {#each mappings as m (m)}
                                <span
                                  class="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {m}
                                </span>
                              {/each}
                            {/if}
                          </div>
                        </div>
                      {/each}
                      {#if specific.length === 0}
                        <div
                          class="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50"
                        >
                          This script has no additional exclusive characters.
                        </div>
                      {/if}
                    </div>
                  </div>
                </section>
              {:catch err}
                <div
                  class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
                >
                  <p class="font-semibold">Could not load typing map</p>
                  <p class="mt-1 text-xs opacity-80">{String(err)}</p>
                </div>
              {/await}
            </div>
          {:else}
            <div class="space-y-4">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="text-sm text-slate-600 dark:text-slate-400">
                  Current script: <span class="font-semibold text-slate-900 dark:text-slate-100"
                    >{script_for_helpers}</span
                  >
                </div>

                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span class="text-sm text-slate-600 dark:text-slate-400">Compare with</span>
                  <select
                    class="select w-full rounded-lg border-slate-300 bg-white sm:w-64 dark:border-slate-700 dark:bg-slate-900"
                    bind:value={script_to_compare_value}
                  >
                    <option value="">Select a script</option>
                    {#each available_compare_scripts as script_option (script_option)}
                      <option value={script_option}>{script_option}</option>
                    {/each}
                  </select>
                </div>
              </div>

              {#if !script_to_compare}
                <div
                  class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
                >
                  Select a script to compare against <span class="font-semibold"
                    >{script_for_helpers}</span
                  >.
                </div>
              {:else}
                {@const compareProm = script_to_compare_krama_prom as Promise<KramaRow[]>}
                {#await Promise.all([base_script_krama_prom as Promise<KramaRow[]>, compareProm])}
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {#each Array.from({ length: 12 }) as _, idx (idx)}
                      <div
                        class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50"
                      >
                        <div
                          class="h-6 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-800"
                        ></div>
                        <div class="mt-2"></div>
                        <div
                          class="h-6 w-14 animate-pulse rounded bg-slate-200 opacity-70 dark:bg-slate-800"
                        ></div>
                      </div>
                    {/each}
                  </div>
                {:then [base, compare]}
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {#each base as [baseText], i (baseText + i)}
                      {#if baseText.length !== 0}
                        <div
                          class="group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                        >
                          <div class="text-2xl leading-none font-semibold">{baseText}</div>
                          <div
                            class="mt-2 text-xl leading-none font-semibold text-slate-500 dark:text-slate-400"
                          >
                            {compare[i]?.[0] ?? '—'}
                          </div>
                        </div>
                      {/if}
                    {/each}
                  </div>
                {:catch err}
                  <div
                    class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
                  >
                    <p class="font-semibold">Could not load script comparison</p>
                    <p class="mt-1 text-xs opacity-80">{String(err)}</p>
                  </div>
                {/await}
              {/if}
            </div>
          {/if}
        {/snippet}
      </Tabs>
    </div>
  {/snippet}
</Modal>
