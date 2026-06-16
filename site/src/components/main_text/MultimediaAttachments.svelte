<script lang="ts">
  import { get_lang_from_id } from '$app/state/lang_list';
  import VideoIcon from '@lucide/svelte/icons/video';
  import HeadphonesIcon from '@lucide/svelte/icons/headphones';
  import FileTextIcon from '@lucide/svelte/icons/file-text';
  import LinkIcon from '@lucide/svelte/icons/link';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import PlayIcon from '@lucide/svelte/icons/play';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { slide } from 'svelte/transition';

  type MediaLinkRow = {
    id: number;
    lang_id: number | null;
    media_type: string;
    link: string;
    name: string;
  };

  type Props = {
    media_links: MediaLinkRow[];
    selected_lang_id?: number | null;
  };

  let { media_links = [], selected_lang_id = null }: Props = $props();

  // Collapsible state
  let isOpen = $state(false);

  // Active filter tab
  let activeTab = $state<'all' | 'video' | 'audio' | 'pdf' | 'text'>('all');

  // Helper to extract YouTube video ID
  function getYoutubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  // Helper to get language name
  function getLangName(langId: number | null): string | null {
    if (langId === null) return null;
    try {
      return get_lang_from_id(langId);
    } catch {
      return null;
    }
  }

  // Count items per category
  const counts = $derived({
    all: media_links.length,
    video: media_links.filter((item) => item.media_type === 'video').length,
    audio: media_links.filter((item) => item.media_type === 'audio').length,
    pdf: media_links.filter((item) => item.media_type === 'pdf').length,
    text: media_links.filter((item) => item.media_type === 'text').length
  });

  // Filtered list
  const filteredLinks = $derived(
    activeTab === 'all' ? media_links : media_links.filter((item) => item.media_type === activeTab)
  );

  // Available tabs (only show tabs that have items)
  const tabsList = $derived(
    [
      { id: 'all', label: 'All', count: counts.all },
      { id: 'video', label: 'Videos', count: counts.video },
      { id: 'audio', label: 'Audio', count: counts.audio },
      { id: 'pdf', label: 'PDFs', count: counts.pdf },
      { id: 'text', label: 'Links', count: counts.text }
    ].filter((tab) => tab.count > 0)
  );

  // YouTube videos
  const youtubeVideos = $derived(
    filteredLinks.filter((item) => item.media_type === 'video' && getYoutubeId(item.link) !== null)
  );

  // Other links
  const nonYoutubeLinks = $derived(
    filteredLinks.filter(
      (item) => !(item.media_type === 'video' && getYoutubeId(item.link) !== null)
    )
  );
</script>

{#if media_links.length > 0}
  <div
    class="w-full rounded-2xl border border-border/60 bg-card/40 p-5 shadow-sm backdrop-blur-md transition-all duration-300"
  >
    <!-- Header with Toggle Button -->
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
        <!-- Categories Navigation (Only if there are multiple types) -->
        {#if tabsList.length > 1}
          <div class="flex w-fit flex-wrap gap-1.5 rounded-lg bg-muted/50 p-1">
            {#each tabsList as tab (tab.id)}
              <button
                onclick={() => (activeTab = tab.id as any)}
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
        {/if}

        <!-- Scrollable content container with max-height constraint -->
        <div class="max-h-[480px] scrollbar-thin space-y-4 overflow-y-auto pr-1.5">
          <!-- YouTube Embeds Grid (Only for Video type, rendered beautifully above the list) -->
          {#if youtubeVideos.length > 0}
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {#each youtubeVideos as video (video.id)}
                {@const ytid = getYoutubeId(video.link)}
                {#if ytid}
                  <div
                    class="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/20"
                  >
                    <div class="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                      <iframe
                        src="https://www.youtube.com/embed/{ytid}"
                        title={video.name}
                        class="absolute inset-0 h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                      ></iframe>
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

          <!-- Other Links List -->
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
                    <!-- Media Type Icon Box -->
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

                    <!-- Media details -->
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

                  <!-- External link action -->
                  <div
                    class="text-muted-foreground transition-colors duration-150 group-hover:text-primary"
                  >
                    <ExternalLinkIcon class="size-4" />
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
