<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { lipi_parivartak, load_parivartak_lang_data } from '~/tools/converter';
  import { delay } from '~/tools/delay';
  import { ALL_LANG_SCRIPT_LIST } from '~/state/lang_list';
  import { cl_join } from '~/tools/cl_join';
  import { onDestroy } from 'svelte';
  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';

  interface Props {
    sync_lang_script: string;
    modal_opened: boolean;
  }

  let { sync_lang_script, modal_opened = $bindable() }: Props = $props();
  let typing_assistance_lang = $derived(sync_lang_script);

  const IMAGE_SCALING = 0.81;
  const ONE_PX = 1;
  const HEIGHT = 682 * IMAGE_SCALING;
  const WIDTH = 658 * IMAGE_SCALING;

  const EXTRA_INFO_LIST = ['q.', '.x', 'qq', '.A', '.i', '.I', '.u', '.U', '.ai', '.au'];

  let usage_table = $derived(
    createQuery({
      queryKey: ['usage_table', typing_assistance_lang],
      enabled: modal_opened,
      queryFn: async () => {
        await delay(700);
        const script_data_load_promise = load_parivartak_lang_data(typing_assistance_lang);
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
    <select class="select w-40" bind:value={typing_assistance_lang}>
      {#each ALL_LANG_SCRIPT_LIST.filter((src) => src !== 'English') as lang_script}
        <option value={lang_script}>{lang_script}</option>
      {/each}
    </select>
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
        {#if !['Romanized'].includes(typing_assistance_lang)}
          {@render extra_info()}
        {/if}
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
  {/snippet}
</Modal>

{#snippet extra_info()}
  <div class="mb-2">
    <div
      class="grid grid-cols-4 gap-1 rounded-md border-2 border-gray-400 px-0 py-1 sm:grid-cols-6 dark:border-gray-600"
    >
      {#each EXTRA_INFO_LIST as char}
        <div class="inline-block space-x-1 text-center text-base">
          <span class="text-gray-500 dark:text-gray-400">{char}</span>
          ➜
          {#await lipi_parivartak(char, 'Normal', typing_assistance_lang) then text}
            <span class="font-bold">{text}</span>
          {/await}
        </div>
      {/each}
    </div>
  </div>
{/snippet}
