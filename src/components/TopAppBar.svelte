<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Popover from '$lib/components/ui/popover';
  import ThemeChanger from './ThemeChanger.svelte';
  import Icon from '~/tools/Icon.svelte';
  import { SiGithub } from 'svelte-icons-pack/si';
  import { AiOutlineMenu } from 'svelte-icons-pack/ai';
  import { page } from '$app/state';
  import { PAGE_TITLES } from '~/state/page_titles';
  import type { Snippet } from 'svelte';
  import { ContributeIcon, SiConvertio, YoutubeIcon } from './icons';
  import { cn } from '$lib/utils';
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

<!-- AppBar replacement -->
<header
  class="flex items-center justify-between bg-card px-3 py-2 shadow-sm sm:px-4 dark:bg-card/80"
>
  <div class="flex items-center gap-2">
    {#if start}
      {@render start()}
    {/if}
    {#if page.error}
      <a class="mr-2 text-xl" href="/" title="श्रीरामायणम्">
        <Icon
          src={BiArrowBack}
          class="-mt-1 mr-1 text-2xl hover:fill-blue-600 dark:hover:fill-sky-500"
        />
      </a>
    {/if}
    {#if headline}
      {@render headline()}
    {:else}
      {@const page_title = get_page_title()}
      {#if page_title}
        <span class={page_title.classes}>
          {page_title.title}
        </span>
      {/if}
    {/if}
  </div>
  <div class="flex items-center gap-x-2 sm:gap-x-4">
    {@render end?.()}
    <button
      onclick={() => {
        support_modal_status = true;
      }}
      onmouseover={preload_component}
      onfocus={preload_component}
      class={cn(
        'flex items-center gap-1 rounded-md px-1 py-1 font-semibold transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring focus-visible:ring-ring/70 sm:px-2',
        ''
      )}
    >
      <Icon src={ContributeIcon} class="text-3xl" />
      <span class="hidden text-sm sm:inline">Support Our Projects</span>
    </button>
    <a
      class="text-xl"
      target="_blank"
      rel="noopener noreferrer"
      href="https://lipilekhika.in/app"
      title="Lipi Parivartak"
    >
      <Icon src={SiConvertio} class="text-2xl hover:fill-cyan-700 dark:hover:fill-zinc-400" />
    </a>
    <Popover.Root bind:open={app_bar_popover_status}>
      <Popover.Trigger class="p-0 outline-none select-none">
        <Icon
          src={AiOutlineMenu}
          class="text-3xl hover:text-muted-foreground active:text-blue-600 dark:active:text-blue-400"
        />
      </Popover.Trigger>
      <Popover.Content side="bottom" align="end" class="w-auto space-y-1 p-2">
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://lipilekhika.in/app"
          class="flex items-center gap-2 rounded-md bg-muted/20 px-2 py-1 text-sm font-bold transition-colors hover:rounded-lg hover:bg-accent/30 hover:text-accent-foreground sm:text-base"
        >
          <Icon src={SiConvertio} class="text-2xl" />
          <span>Lipi Parivartak</span>
        </a>
        <a
          href="https://www.youtube.com/c/thesanskritchannel"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1 rounded-md bg-muted/20 px-2 py-1 text-sm transition-colors hover:rounded-lg hover:bg-accent/30 hover:text-accent-foreground sm:text-base"
          onclick={() => (app_bar_popover_status = false)}
        >
          <Icon src={YoutubeIcon} class="mt-0 text-2xl text-[red]" />
          <span>The Sanskrit Channel</span>
        </a>
        <a
          href="https://github.com/shubhattin/thesanskritchannel_projects"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1 rounded-md bg-muted/20 px-2 py-1 text-sm transition-colors hover:rounded-lg hover:bg-accent/30 hover:text-accent-foreground"
          onclick={() => (app_bar_popover_status = false)}
        >
          <Icon src={SiGithub} class="-mt-1 mr-1 text-xl" />
          <span>Projects's Github Page</span>
        </a>
        <div class="flex items-center gap-3 rounded-md px-2 py-1">
          <span class="mt-1">Set Theme</span>
          <ThemeChanger />
        </div>
      </Popover.Content>
    </Popover.Root>
  </div>
</header>

<Dialog.Root bind:open={support_modal_status}>
  <Dialog.Content class="w-80 max-w-[calc(100vw-2rem)] bg-card p-3">
    {#await preload_component() then SupportOptions}
      <SupportOptions.default />
    {/await}
  </Dialog.Content>
</Dialog.Root>
