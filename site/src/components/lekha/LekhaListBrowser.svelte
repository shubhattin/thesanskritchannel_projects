<script lang="ts">
  import * as InputGroup from '~/lib/components/ui/input-group';
  import * as Pagination from '~/lib/components/ui/pagination';
  import * as Empty from '~/lib/components/ui/empty';
  import { Badge } from '~/lib/components/ui/badge';
  import { Label } from '~/lib/components/ui/label';
  import { Switch } from '~/lib/components/ui/switch';
  import SearchIcon from '@lucide/svelte/icons/search';
  import KeyboardIcon from '@lucide/svelte/icons/keyboard';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import { create_project_name_dev_normal_cache } from '@app/utils/search/project_name_dev_normal_cache';
  import { filter_lekhas_by_search } from '$lib/lekha/lekha_list_search';

  const PAGE_SIZE = 15;

  type LekhaListPost = {
    id: number;
    title: string;
    description: string | null;
    tags: string[];
    url_slug: string;
    published_at?: Date | string | null;
  };

  let { posts }: { posts: readonly LekhaListPost[] } = $props();

  let search_text = $state('');
  let typing_enabled = $state(false);
  let page = $state(1);

  const ctx = createTypingContext('Devanagari', {
    includeInherentVowel: true
  });

  const text_normal_cache = create_project_name_dev_normal_cache();
  let text_normal_cache_version = $state(0);

  $effect(() => {
    const texts = posts.flatMap((post) => {
      const out = [post.title, ...post.tags];
      if (post.description?.trim()) out.push(post.description);
      return out;
    });
    void text_normal_cache.ensure_all(texts).then(() => {
      text_normal_cache_version++;
    });
  });

  const filtered_posts = $derived.by(() => {
    void text_normal_cache_version;
    return filter_lekhas_by_search(posts, search_text, (text) => text_normal_cache.get(text));
  });

  const total_count = $derived(filtered_posts.length);
  const total_pages = $derived(Math.max(1, Math.ceil(total_count / PAGE_SIZE)));
  const current_page = $derived(Math.max(1, Math.min(page, total_pages)));

  const paginated_posts = $derived(
    filtered_posts.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE)
  );

  const showing_start = $derived(total_count === 0 ? 0 : (current_page - 1) * PAGE_SIZE + 1);
  const showing_end = $derived(Math.min(current_page * PAGE_SIZE, total_count));

  $effect(() => {
    if (page > total_pages) page = total_pages;
  });

  function reset_page() {
    page = 1;
  }

  function toggle_typing_from_keyboard(e: KeyboardEvent) {
    if (!e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key !== 'x' && key !== 'c') return false;
    e.preventDefault();
    typing_enabled = !typing_enabled;
    return true;
  }

  function formatDate(value: Date | string | null | undefined) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function toIso(value: Date | string | null | undefined) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  }
</script>

<div class="flex flex-col gap-6">
  <InputGroup.Root class="h-10 w-full">
    <InputGroup.Addon align="inline-start" class="pl-2.5">
      <SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    </InputGroup.Addon>
    <InputGroup.Input
      placeholder="Search titles, descriptions, and tags…"
      bind:value={search_text}
      oninput={reset_page}
      onbeforeinput={(e) =>
        handleTypingBeforeInputEvent(
          ctx,
          e,
          (newValue) => {
            search_text = newValue;
            reset_page();
          },
          typing_enabled
        )}
      onblur={() => ctx.clearContext()}
      onkeydown={(e) => {
        if (toggle_typing_from_keyboard(e)) return;
        clearTypingContextOnKeyDown(e, ctx);
      }}
      aria-label="Search lekha posts"
    />
    <InputGroup.Addon
      align="inline-end"
      class="cursor-default gap-2 border-s border-border/50 ps-3 pe-2.5"
    >
      <Label
        for="lekha-list-typing-switch"
        class="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground select-none"
      >
        <KeyboardIcon class="size-3.5" aria-hidden="true" />
        Typing
      </Label>
      <Switch
        id="lekha-list-typing-switch"
        bind:checked={typing_enabled}
        title="Devanagari transliteration typing (Alt+X)"
      />
    </InputGroup.Addon>
  </InputGroup.Root>

  {#if total_count > 0}
    <p class="text-xs text-muted-foreground">
      Showing {showing_start}–{showing_end} of {total_count} post{total_count === 1 ? '' : 's'}
      {#if total_pages > 1}
        · Page {current_page} of {total_pages}
      {/if}
    </p>
  {/if}

  {#if paginated_posts.length > 0}
    <ul class="flex flex-col gap-4">
      {#each paginated_posts as post (post.id)}
        <li>
          <a
            href={`/lekha/${post.url_slug}`}
            class="group block rounded-lg border border-border/60 bg-card/40 px-5 py-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <h2 class="text-lg font-semibold tracking-tight group-hover:text-primary">
              {post.title}
            </h2>
            {#if post.description}
              <p class="mt-2 text-sm text-muted-foreground">{post.description}</p>
            {/if}
            {#if post.tags.length > 0}
              <div class="mt-3 flex flex-wrap gap-1.5">
                {#each post.tags as tag (tag)}
                  <Badge variant="secondary" class="font-normal">{tag}</Badge>
                {/each}
              </div>
            {/if}
            <time
              class="mt-3 block text-xs text-muted-foreground"
              datetime={toIso(post.published_at)}
            >
              {formatDate(post.published_at)}
            </time>
          </a>
        </li>
      {/each}
    </ul>
  {:else if posts.length === 0}
    <Empty.Root class="border border-dashed border-border/60 bg-muted/20 py-12">
      <Empty.Header>
        <Empty.Media variant="icon">
          <BookOpen aria-hidden="true" />
        </Empty.Media>
        <Empty.Title>No published posts yet</Empty.Title>
        <Empty.Description>
          Add listed, non-draft lekhas in the app; they will appear here when synced to the
          database.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <Empty.Root class="border border-dashed border-border/60 bg-muted/20 py-12">
      <Empty.Header>
        <Empty.Media variant="icon">
          <SearchIcon aria-hidden="true" />
        </Empty.Media>
        <Empty.Title>No posts found</Empty.Title>
        <Empty.Description>
          Try a different search term, or turn on Typing to search in Devanagari.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}

  {#if total_pages > 1 && total_count > 0}
    <Pagination.Root
      count={total_count}
      perPage={PAGE_SIZE}
      bind:page
      class="border-t border-border/60 pt-3"
    >
      {#snippet children({ pages, currentPage })}
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous />
          </Pagination.Item>
          {#each pages as pageItem (pageItem.key)}
            {#if pageItem.type === 'ellipsis'}
              <Pagination.Item>
                <Pagination.Ellipsis />
              </Pagination.Item>
            {:else}
              <Pagination.Item>
                <Pagination.Link page={pageItem} isActive={currentPage === pageItem.value}>
                  {pageItem.value}
                </Pagination.Link>
              </Pagination.Item>
            {/if}
          {/each}
          <Pagination.Item>
            <Pagination.Next />
          </Pagination.Item>
        </Pagination.Content>
      {/snippet}
    </Pagination.Root>
  {/if}
</div>
