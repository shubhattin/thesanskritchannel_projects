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
  import { cn } from '$lib/utils';
  import { onDestroy } from 'svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Tabs from '$lib/components/ui/tabs';
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

<Dialog.Root bind:open={modal_opened}>
  <Dialog.Content class="max-h-[97vh] max-w-[97vw] overflow-auto p-3 sm:max-w-xl">
    <div class="flex justify-end">
      <button
        aria-label="Close"
        class="absolute top-3 right-3 cursor-pointer text-muted-foreground outline-none select-none hover:text-foreground"
        onclick={() => (modal_opened = false)}><Icon src={AiOutlineClose} /></button
      >
    </div>
    <div class="space-y-4">
      <div>
        <select
          class="w-40 rounded-md border border-input bg-background px-3 py-2"
          bind:value={typing_assistance_lang}
        >
          {#each ALL_LANG_SCRIPT_LIST.filter((src) => src !== 'English') as lang_script}
            <option value={lang_script}>{lang_script}</option>
          {/each}
        </select>
      </div>

      <Tabs.Root bind:value={active_tab}>
        <Tabs.List>
          <Tabs.Trigger value="image">Image</Tabs.Trigger>
          <Tabs.Trigger value="typing-map">Typing Map</Tabs.Trigger>
          <Tabs.Trigger value="compare-scripts">Compare Scripts</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="image" class="mt-4 space-y-4">
          <div
            class={cn(
              'max-w-full',
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
                <div class="h-full w-full animate-pulse rounded-lg bg-muted"></div>
                <div class="h-4 animate-pulse rounded-md bg-muted"></div>
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
              <div class="text-sm text-wrap text-muted-foreground">
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
        </Tabs.Content>
        <Tabs.Content value="typing-map" class="mt-4 space-y-4">
          <div class="flex-1 space-y-4 pr-1">
            {#await script_typing_map_promise}
              <section class="space-y-6" aria-label="Loading typing map">
                {#each ['Svara', 'Vyanjana', 'Other', 'Script-specific Characters'] as title (title)}
                  <div>
                    <div class="mb-2 flex items-center justify-between gap-2">
                      <div class="h-6 w-32 animate-pulse rounded-md bg-muted"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {#each Array.from({ length: 12 }) as _, idx (title + idx)}
                        <div class="rounded-lg border border-border bg-card p-3">
                          <div class="h-6 w-14 animate-pulse rounded bg-muted"></div>
                          <div class="mt-2 flex flex-wrap gap-1">
                            <div class="h-4 w-8 animate-pulse rounded bg-muted opacity-70"></div>
                            <div class="h-4 w-10 animate-pulse rounded bg-muted opacity-60"></div>
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
                        class="col-span-full rounded-lg border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground"
                      >
                        No svara entries found for {script_for_helpers}.
                      </div>
                    {:else}
                      {#each svaraItems as [char, type, mappings] (char + type)}
                        <div
                          class="group rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                        >
                          <div class="flex items-start justify-between gap-2">
                            <div class="text-2xl leading-none font-semibold">{char}</div>
                          </div>
                          <div
                            class="mt-2 flex max-h-20 flex-wrap items-start gap-1 overflow-auto pr-1"
                          >
                            {#each mappings as m (m)}
                              <span
                                class="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-medium uppercase"
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
                        class="group rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      >
                        <div class="flex items-start justify-between gap-2">
                          <div class="text-2xl leading-none font-semibold">{char}</div>
                        </div>
                        <div class="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto pr-1">
                          {#each mappings as m (m)}
                            <span
                              class="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-medium uppercase"
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
                        class="group rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      >
                        <div class="flex items-start justify-between gap-2">
                          <div class="text-2xl leading-none font-semibold">{char}</div>
                        </div>
                        <div class="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto pr-1">
                          {#if mappings.length === 0}
                            <span class="text-xs text-muted-foreground">No mappings</span>
                          {:else}
                            {#each mappings as m (m)}
                              <span
                                class="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-medium uppercase"
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
                    <h3 class="text-lg font-semibold tracking-wide">Script-specific Characters</h3>
                  </div>
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {#each specific as [char, type, mappings] (char + type)}
                      <div
                        class="group rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      >
                        <div class="flex items-start justify-between gap-2">
                          {#if char !== '\u200d'}
                            <div class="text-2xl leading-none font-semibold">{char}</div>
                          {:else}
                            <div class="text-xs leading-none font-semibold">zero width joiner</div>
                          {/if}
                        </div>
                        <div class="mt-2 flex max-h-20 flex-wrap gap-1 overflow-auto pr-1">
                          {#if mappings.length === 0}
                            <span class="text-xs text-muted-foreground">No mappings</span>
                          {:else}
                            {#each mappings as m (m)}
                              <span
                                class="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-medium uppercase"
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
                        class="col-span-full rounded-lg border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground"
                      >
                        This script has no additional exclusive characters.
                      </div>
                    {/if}
                  </div>
                </div>
              </section>
            {:catch err}
              <div
                class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <p class="font-semibold">Could not load typing map</p>
                <p class="mt-1 text-xs opacity-80">{String(err)}</p>
              </div>
            {/await}
          </div>
        </Tabs.Content>
        <Tabs.Content value="compare-scripts" class="mt-4 space-y-4">
          <div class="space-y-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="text-sm text-muted-foreground">
                Current script: <span class="font-semibold text-foreground"
                  >{script_for_helpers}</span
                >
              </div>

              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span class="text-sm text-muted-foreground">Compare with</span>
                <select
                  class="w-full rounded-lg border border-input bg-background px-3 py-2 sm:w-64"
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
                class="rounded-lg border border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground"
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
                    <div class="rounded-lg border border-border bg-card p-3">
                      <div class="h-6 w-14 animate-pulse rounded bg-muted"></div>
                      <div class="mt-2"></div>
                      <div class="h-6 w-14 animate-pulse rounded bg-muted opacity-70"></div>
                    </div>
                  {/each}
                </div>
              {:then [base, compare]}
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {#each base as [baseText], i (baseText + i)}
                    {#if baseText.length !== 0}
                      <div
                        class="group rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      >
                        <div class="text-2xl leading-none font-semibold">{baseText}</div>
                        <div class="mt-2 text-xl leading-none font-semibold text-muted-foreground">
                          {compare[i]?.[0] ?? '—'}
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              {:catch err}
                <div
                  class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
                >
                  <p class="font-semibold">Could not load script comparison</p>
                  <p class="mt-1 text-xs opacity-80">{String(err)}</p>
                </div>
              {/await}
            {/if}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  </Dialog.Content>
</Dialog.Root>
