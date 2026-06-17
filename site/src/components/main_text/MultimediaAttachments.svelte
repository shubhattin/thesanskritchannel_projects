<script lang="ts">
  import { get_lang_from_id } from '$app/state/lang_list';
  import {
    filter_by_media_lang,
    filter_by_media_tab,
    getYoutubeId,
    media_lang_tabs_list,
    media_tab_counts,
    media_type_tabs_list,
    type MediaLangTab,
    type MediaTab
  } from '$app/components/pages/main_app/multimedia/multimedia_lib';
  import VideoIcon from '@lucide/svelte/icons/video';
  import HeadphonesIcon from '@lucide/svelte/icons/headphones';
  import FileTextIcon from '@lucide/svelte/icons/file-text';
  import LinkIcon from '@lucide/svelte/icons/link';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import PlayIcon from '@lucide/svelte/icons/play';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
  import LanguagesIcon from '@lucide/svelte/icons/languages';
  import { slide } from 'svelte/transition';

  type MediaLinkRow = {
    id: number;
    lang_id: number | null;
    media_type: string;
    link: string;
    name: string;
    order: number;
  };

  type Props = {
    media_links: MediaLinkRow[];
    selected_lang_id?: number | null;
  };

  let { media_links = [], selected_lang_id = null }: Props = $props();

  let isOpen = $state(false);
  let activeTab = $state<MediaTab>('all');
  let activeLangTab = $state<MediaLangTab>('all');
  let activeVideos = $state<Record<number, boolean>>({});

  const getLangName = (langId: number | null): string | null => {
    if (langId === null) return null;
    try {
      return get_lang_from_id(langId);
    } catch {
      return null;
    }
  };

  const counts = $derived(media_tab_counts(media_links));
  const tabsList = $derived(media_type_tabs_list(counts));

  const typeFilteredLinks = $derived(filter_by_media_tab(media_links, activeTab));
  const langTabsList = $derived(
    media_lang_tabs_list(typeFilteredLinks, (lang_id) => getLangName(lang_id))
  );
  const filteredLinks = $derived(filter_by_media_lang(typeFilteredLinks, activeLangTab));

  const youtubeVideos = $derived(
    filteredLinks.filter((item) => item.media_type === 'video' && getYoutubeId(item.link) !== null)
  );

  const nonYoutubeLinks = $derived(
    filteredLinks.filter(
      (item) => !(item.media_type === 'video' && getYoutubeId(item.link) !== null)
    )
  );

  $effect(() => {
    if (
      selected_lang_id !== null &&
      media_links.some((item) => item.lang_id === selected_lang_id)
    ) {
      activeLangTab = selected_lang_id;
    }
  });

  $effect(() => {
    activeTab;
    typeFilteredLinks;
    if (
      activeLangTab !== 'all' &&
      !typeFilteredLinks.some((item) => item.lang_id === activeLangTab)
    ) {
      activeLangTab = 'all';
    }
  });
</script>

{#if media_links.length > 0}
  <div
    class="w-full rounded-2xl border border-border/60 bg-card/40 p-5 shadow-sm backdrop-blur-md transition-all duration-300"
  >
    <button
      onclick={() => (isOpen = !isOpen)}
      class="flex w-full items-center justify-between gap-4 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div class="flex items-center gap-2">
        <div class="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PlayIcon class="size-4 fill-primary/10" />
        </div>
        <h3 class="text-base font-semibold tracking-tight text-foreground">Multimedia Resources</h3>
        <span
          class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
        >
          {media_links.length}
        </span>
      </div>

      <div
        class="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <span class="text-xs font-medium">{isOpen ? 'Hide' : 'Show'}</span>
        <ChevronDownIcon
          class="size-4 transition-transform duration-250 {isOpen ? 'rotate-180' : ''}"
        />
      </div>
    </button>

    {#if isOpen}
      <div transition:slide={{ duration: 250 }} class="mt-4 space-y-4">
        {#if tabsList.length > 1}
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground"
            >
              <LayoutGridIcon class="size-3.5" />
              Type
            </span>
            <div class="flex w-fit flex-wrap gap-1.5 rounded-lg bg-muted/50 p-1">
              {#each tabsList as tab (tab.id)}
                <button
                  type="button"
                  onclick={() => (activeTab = tab.id)}
                  class="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none {activeTab ===
                  tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/40 hover:text-foreground'}"
                >
                  {tab.label}
                  <span
                    class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold {activeTab ===
                    tab.id
                      ? 'bg-muted/70 text-foreground'
                      : 'text-muted-foreground'}"
                  >
                    {tab.count}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if langTabsList.length > 1}
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground"
            >
              <LanguagesIcon class="size-3.5" />
              Language
            </span>
            <div class="flex w-fit flex-wrap gap-1.5 rounded-lg bg-muted/50 p-1">
              {#each langTabsList as tab (tab.id)}
                <button
                  type="button"
                  onclick={() => (activeLangTab = tab.id)}
                  class="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none {activeLangTab ===
                  tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/40 hover:text-foreground'}"
                >
                  {tab.label}
                  <span
                    class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold {activeLangTab ===
                    tab.id
                      ? 'bg-muted/70 text-foreground'
                      : 'text-muted-foreground'}"
                  >
                    {tab.count}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="max-h-[480px] scrollbar-thin space-y-4 overflow-y-auto pr-1.5">
          {#if youtubeVideos.length > 0}
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {#each youtubeVideos as video (video.id)}
                {@const ytid = getYoutubeId(video.link)}
                {#if ytid}
                  <div
                    class="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/20"
                  >
                    <div class="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                      {#if activeVideos[video.id]}
                        <iframe
                          src="https://www.youtube.com/embed/{ytid}?autoplay=1"
                          title={video.name}
                          class="absolute inset-0 h-full w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowfullscreen
                        ></iframe>
                      {:else}
                        <button
                          onclick={() => (activeVideos[video.id] = true)}
                          class="absolute inset-0 flex h-full w-full cursor-pointer items-center justify-center border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label="Play video: {video.name}"
                        >
                          <img
                            src="https://img.youtube.com/vi/{ytid}/hqdefault.jpg"
                            alt={video.name}
                            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                          <div
                            class="absolute inset-0 bg-black/10 transition-colors duration-250 group-hover:bg-black/30"
                          ></div>
                          <div
                            class="absolute flex size-12 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition-all duration-300 group-hover:scale-110 group-hover:bg-red-700"
                          >
                            <PlayIcon class="size-6 fill-white" />
                          </div>
                        </button>
                      {/if}
                    </div>
                    <div class="flex items-start justify-between gap-2 px-1 py-0.5">
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-foreground" title={video.name}>
                          {video.name}
                        </p>
                        {#if video.lang_id !== null}
                          {@const langName = getLangName(video.lang_id)}
                          {#if langName}
                            <span
                              class="mt-1 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {langName}
                            </span>
                          {/if}
                        {/if}
                      </div>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}

          {#if nonYoutubeLinks.length > 0}
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {#each nonYoutubeLinks as item (item.id)}
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-all duration-300 hover:border-primary/30 hover:bg-accent/10 hover:shadow-md"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <div
                      class="flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105
                      {item.media_type === 'video'
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                        : ''}
                      {item.media_type === 'audio'
                        ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400'
                        : ''}
                      {item.media_type === 'pdf'
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
                        : ''}
                      {item.media_type === 'text'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                        : ''}"
                    >
                      {#if item.media_type === 'video'}
                        <VideoIcon class="size-5" />
                      {:else if item.media_type === 'audio'}
                        <HeadphonesIcon class="size-5" />
                      {:else if item.media_type === 'pdf'}
                        <FileTextIcon class="size-5" />
                      {:else}
                        <LinkIcon class="size-5" />
                      {/if}
                    </div>

                    <div class="min-w-0 flex-1 space-y-0.5">
                      <p
                        class="truncate text-sm font-medium text-foreground transition-colors duration-150 group-hover:text-primary"
                      >
                        {item.name}
                      </p>
                      <div
                        class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span class="capitalize">{item.media_type}</span>
                        {#if item.lang_id !== null}
                          {@const langName = getLangName(item.lang_id)}
                          {#if langName}
                            <span class="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                            <span
                              class="py-0.2 rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground"
                            >
                              {langName}
                            </span>
                          {/if}
                        {/if}
                      </div>
                    </div>
                  </div>

                  <div
                    class="text-muted-foreground transition-colors duration-150 group-hover:text-primary"
                  >
                    <ExternalLinkIcon class="size-4" />
                  </div>
                </a>
              {/each}
            </div>
          {/if}

          {#if filteredLinks.length === 0}
            <p class="text-sm text-muted-foreground">
              No multimedia links match the current filters.
            </p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
