<script lang="ts">
  import { AppBar, Modal, Popover } from '@skeletonlabs/skeleton-svelte';
  import ThemeChanger from './ThemeChanger.svelte';
  import Icon from '~/tools/Icon.svelte';
  import { SiGithub } from 'svelte-icons-pack/si';
  import { AiOutlineMenu } from 'svelte-icons-pack/ai';
  import { page } from '$app/state';
  import { PAGE_TITLES } from '~/state/page_titles';
  import type { Snippet } from 'svelte';
  import { ContributeIcon, SiConvertio, YoutubeIcon } from './icons';
  import { cl_join } from '~/tools/cl_join';
  import { BiArrowBack } from 'svelte-icons-pack/bi';

  let { start, headline, end }: { start?: Snippet; headline?: Snippet; end?: Snippet } = $props();

  let pathname = $derived(page.url.pathname);

  const get_page_title = () => {
    for (let key in PAGE_TITLES) {
      const { startsWith } = PAGE_TITLES[key];
      if (key === pathname && !startsWith) {
        return PAGE_TITLES[key];
      } else if (pathname.startsWith(key) && startsWith) {
        return PAGE_TITLES[key];
      }
    }
  };

  let app_bar_popover_status = $state(false);
  let support_modal_status = $state(false);

  const preload_component = () => import('~/components/SupportOptions.svelte');
</script>

<AppBar>
  {#snippet lead()}
    {@const page_title = get_page_title()}
    {#if start}
      {@render start()}
    {/if}
    {#if pathname === '/parivartak' || page.error}
      <a class="mr-2 text-xl" href="/" title="श्रीरामायणम्">
        <Icon
          src={BiArrowBack}
          class="-mt-1 mr-1 text-2xl hover:fill-blue-600 dark:hover:fill-sky-500"
        />
      </a>
    {/if}
    {#if headline}
      {@render headline()}
    {:else if page_title}
      <span class={page_title.classes}>
        {page_title.title}
      </span>
    {/if}
  {/snippet}
  {#snippet trail()}
    {@render end?.()}
    <button
      onclick={() => {
        support_modal_status = true;
      }}
      onmouseover={preload_component}
      onfocus={preload_component}
      class={cl_join(
        '-mt-1 btn rounded-md px-1 py-1 font-semibold outline-hidden select-none hover:bg-gray-200 sm:px-2 dark:hover:bg-gray-700',
        'mr-3 sm:mr-3'
      )}
    >
      <Icon src={ContributeIcon} class="text-3xl" />
      <span class="hidden text-sm sm:inline">Support Our Projects</span>
    </button>
    {#if pathname !== '/parivartak'}
      <a class="text-xl" href="/parivartak" title="Lipi Parivartak">
        <Icon src={SiConvertio} class="text-2xl hover:fill-emerald-600 dark:hover:fill-zinc-400" />
      </a>
    {/if}
    <Popover
      open={app_bar_popover_status}
      onOpenChange={(e) => (app_bar_popover_status = e.open)}
      positioning={{ placement: 'bottom' }}
      arrow={false}
      contentBase="card z-50 space-y-1 rounded-lg px-3 py-1.5 shadow-xl bg-surface-100-900"
      triggerBase="btn p-0 gap-0 outline-hidden select-none"
    >
      {#snippet trigger()}
        <Icon
          src={AiOutlineMenu}
          class="text-3xl hover:text-gray-500 active:text-blue-600 dark:hover:text-gray-400 dark:active:text-blue-400"
        />
      {/snippet}
      {#snippet content()}
        <a
          href="/parivartak"
          class="group flex space-x-2 rounded-md px-2 py-1 text-sm font-bold hover:bg-gray-200 sm:text-base dark:hover:bg-gray-700"
        >
          <Icon
            src={SiConvertio}
            class="text-2xl group-hover:fill-emerald-600 dark:group-hover:fill-zinc-400"
          />
          <span>Lipi Parivartak</span>
        </a>
        <a
          href="https://www.youtube.com/c/thesanskritchannel"
          target="_blank"
          rel="noopener noreferrer"
          class="flex space-x-1 rounded-md px-2 py-1 text-sm hover:bg-gray-200 sm:text-base dark:hover:bg-gray-700"
          onclick={() => (app_bar_popover_status = false)}
        >
          <Icon src={YoutubeIcon} class="mt-0 text-2xl text-[red]" />
          <span>The Sanskrit Channel</span>
        </a>
        <a
          href="https://github.com/shubhattin/thesanskritchannel_projects"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex space-x-1 rounded-md px-2 py-1 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
          onclick={() => (app_bar_popover_status = false)}
        >
          <Icon
            src={SiGithub}
            class="-mt-1 mr-1 text-xl group-hover:fill-indigo-700 dark:group-hover:fill-zinc-400"
          />
          <span>Projects's Github Page</span>
        </a>
        <div class="wont-close flex space-x-3 rounded-md px-2 py-1">
          <span class="mt-1">Set Theme</span>
          <ThemeChanger />
        </div>
      {/snippet}
    </Popover>
  {/snippet}
</AppBar>

<Modal
  open={support_modal_status}
  onOpenChange={(e) => (support_modal_status = e.open)}
  contentBase="card z-40 px-3 py-2 shadow-xl rounded-md select-none outline-none bg-slate-100 dark:bg-surface-900"
  backdropBackground="backdrop-blur-sm"
>
  {#snippet content()}
    {#await preload_component() then SupportOptions}
      <SupportOptions.default />
    {/await}
  {/snippet}
</Modal>
