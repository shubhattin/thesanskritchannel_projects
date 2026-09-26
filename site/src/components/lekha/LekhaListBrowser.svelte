<script lang="ts">
  import { tick, untrack } from 'svelte';
  import * as InputGroup from '~/lib/components/ui/input-group';
  import * as Pagination from '~/lib/components/ui/pagination';
  import * as Empty from '~/lib/components/ui/empty';
  import * as Popover from '~/lib/components/ui/popover';
  import * as Select from '~/lib/components/ui/select';
  import { Badge } from '~/lib/components/ui/badge';
  import { Button } from '~/lib/components/ui/button';
  import { Checkbox } from '~/lib/components/ui/checkbox';
  import { Input } from '~/lib/components/ui/input';
  import { Label } from '~/lib/components/ui/label';
  import { Switch } from '~/lib/components/ui/switch';
  import SearchIcon from '@lucide/svelte/icons/search';
  import KeyboardIcon from '@lucide/svelte/icons/keyboard';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import ArrowDownWideNarrow from '@lucide/svelte/icons/arrow-down-wide-narrow';
  import ArrowUpNarrowWide from '@lucide/svelte/icons/arrow-up-narrow-wide';
  import Tags from '@lucide/svelte/icons/tags';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import X from '@lucide/svelte/icons/x';
  import { clearTypingContextOnKeyDown, handleTypingBeforeInputEvent } from 'lipilekhika/typing';
  import { create_project_name_dev_normal_cache } from '@app/utils/search/project_name_dev_normal_cache';
  import { filter_lekhas_by_search } from '$lib/lekha/lekha_list_search';
  import { use_script_query } from '$lib/search/use-script-query.svelte';
  import { withPaginationListScroll } from '@app/lib/pagination-scroll';
  import { getFontClass } from '~/components/utils/font_list';
  import { get_display_script_from_id } from '$lib/main_text/display-script';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';

  const PAGE_SIZE = 10;

  type SortOrder = 'newest' | 'oldest';

  type LekhaListPost = {
    id: number;
    title: string;
    title_transliterated?: string | null;
    description: string | null;
    description_transliterated?: string | null;
    tags: string[];
    url_slug: string;
    published_at?: Date | string | null;
  };

  let { posts }: { posts: readonly LekhaListPost[] } = $props();

  const scriptFontClass = $derived(
    getFontClass(get_display_script_from_id(site_prefs.script_id)) ?? 'font-normal'
  );

  let search_text = $state('');
  let typing_enabled = $state(false);
  let page = $state(1);
  let sort_order = $state<SortOrder>('newest');
  /** Selected tag labels (canonical casing from posts). Empty = no tag filter. */
  let selected_tags = $state<string[]>([]);
  let tag_popover_open = $state(false);
  let tag_query = $state('');
  let tag_filter_input: HTMLInputElement | null = $state(null);

  const script_query = use_script_query(() => search_text);

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

  $effect(() => {
    if (!tag_popover_open) {
      tag_query = '';
      return;
    }
    void tick().then(() => tag_filter_input?.focus());
  });

  const available_tags = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      for (const tag of post.tags) {
        const t = tag.trim();
        if (!t) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([tag, count]) => ({ tag, count }));
  });

  const filtered_available_tags = $derived.by(() => {
    const q = tag_query.trim().toLowerCase();
    if (!q) return available_tags;
    return available_tags.filter(({ tag }) => tag.toLowerCase().includes(q));
  });

  const selected_tag_keys = $derived(new Set(selected_tags.map((t) => t.toLowerCase())));

  const filtered_posts = $derived.by(() => {
    void text_normal_cache_version;
    const query_normals = script_query.normals_for_text(search_text);
    let list = filter_lekhas_by_search(posts, search_text, (text) => text_normal_cache.get(text), {
      normals: query_normals
    });
    if (selected_tag_keys.size > 0) {
      list = list.filter((post) =>
        post.tags.some((tag) => selected_tag_keys.has(tag.trim().toLowerCase()))
      );
    }
    if (!search_text.trim()) {
      list.sort((a, b) => {
        const ta = publishedTime(a.published_at);
        const tb = publishedTime(b.published_at);
        return sort_order === 'newest' ? tb - ta : ta - tb;
      });
    }
    return list;
  });

  const total_count = $derived(filtered_posts.length);
  const total_pages = $derived(Math.max(1, Math.ceil(total_count / PAGE_SIZE)));
  const current_page = $derived(Math.max(1, Math.min(page, total_pages)));

  const paginated_posts = $derived(
    filtered_posts.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE)
  );

  const showing_start = $derived(total_count === 0 ? 0 : (current_page - 1) * PAGE_SIZE + 1);
  const showing_end = $derived(Math.min(current_page * PAGE_SIZE, total_count));

  const tag_trigger_label = $derived.by(() => {
    const n = selected_tags.length;
    if (n === 0) return 'All tags';
    if (n === 1) return selected_tags[0]!;
    return `${n} tags selected`;
  });

  const sort_label = $derived(sort_order === 'newest' ? 'Latest' : 'Oldest');

  $effect(() => {
    if (page > total_pages) page = total_pages;
  });

  function publishedTime(value: Date | string | null | undefined) {
    if (!value) return 0;
    const t = (value instanceof Date ? value : new Date(value)).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  let list_el = $state<HTMLElement | null>(null);

  function reset_page() {
    page = 1;
  }

  const list_ref = {
    get current() {
      return list_el;
    }
  };
  const change_page = withPaginationListScroll((next) => {
    page = next;
  }, list_ref);

  function set_sort_order(value: string | undefined) {
    if (value === 'newest' || value === 'oldest') {
      sort_order = value;
      reset_page();
    }
  }

  function is_tag_selected(tag: string) {
    return selected_tag_keys.has(tag.toLowerCase());
  }

  function toggle_tag(tag: string, checked: boolean) {
    const key = tag.toLowerCase();
    const current = untrack(() => selected_tags);
    if (checked) {
      if (current.some((t) => t.toLowerCase() === key)) return;
      selected_tags = [...current, tag];
    } else {
      selected_tags = current.filter((t) => t.toLowerCase() !== key);
    }
    reset_page();
  }

  function clear_tags() {
    selected_tags = [];
    reset_page();
  }

  function filter_by_tag_from_card(tag: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const key = tag.toLowerCase();
    if (is_tag_selected(tag)) {
      selected_tags = selected_tags.filter((t) => t.toLowerCase() !== key);
    } else {
      selected_tags = [...selected_tags, tag];
    }
    reset_page();
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
  <div class="flex flex-col gap-3 sm:gap-4">
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
            script_query.ctx,
            e,
            (newValue) => {
              search_text = newValue;
              reset_page();
            },
            typing_enabled
          )}
        onblur={() => script_query.ctx.clearContext()}
        onkeydown={(e) => {
          if (toggle_typing_from_keyboard(e)) return;
          clearTypingContextOnKeyDown(e, script_query.ctx);
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
          title={`${site_prefs.script} transliteration typing (Alt+X)`}
        />
      </InputGroup.Addon>
    </InputGroup.Root>

    <div
      class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center sm:gap-4"
    >
      <div class="flex w-full flex-col gap-1.5 sm:w-40">
        <Label for="lekha-sort-order" class="text-xs font-medium text-muted-foreground">
          Sort by date
        </Label>
        <Select.Root type="single" value={sort_order} onValueChange={set_sort_order}>
          <Select.Trigger id="lekha-sort-order" class="h-8 w-full">
            <span class="flex min-w-0 items-center gap-2">
              {#if sort_order === 'newest'}
                <ArrowDownWideNarrow
                  class="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              {:else}
                <ArrowUpNarrowWide
                  class="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              {/if}
              <span class="truncate">{sort_label}</span>
            </span>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="newest" label="Latest">
              <span class="flex items-center gap-2">
                <ArrowDownWideNarrow class="size-3.5 text-muted-foreground" aria-hidden="true" />
                Latest
              </span>
            </Select.Item>
            <Select.Item value="oldest" label="Oldest">
              <span class="flex items-center gap-2">
                <ArrowUpNarrowWide class="size-3.5 text-muted-foreground" aria-hidden="true" />
                Oldest
              </span>
            </Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      {#if available_tags.length > 0}
        <div class="flex w-full min-w-0 flex-col gap-1.5 sm:w-56">
          <Label for="lekha-tag-filter" class="text-xs font-medium text-muted-foreground">
            Filter by tags
          </Label>
          <div class="flex h-8 items-center gap-2">
            <Popover.Root bind:open={tag_popover_open}>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    id="lekha-tag-filter"
                    variant="outline"
                    size="sm"
                    class="h-8 min-w-0 flex-1 justify-between gap-2 font-normal"
                    aria-label="Filter by tags"
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      <Tags class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span class="truncate">{tag_trigger_label}</span>
                    </span>
                    <ChevronDown class="size-4 shrink-0 opacity-50" aria-hidden="true" />
                  </Button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content
                class="w-(--bits-popover-anchor-width) border-border bg-card p-2 text-card-foreground shadow-md"
                align="start"
              >
                <div class="relative mb-2">
                  <SearchIcon
                    class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    bind:ref={tag_filter_input}
                    bind:value={tag_query}
                    placeholder="Search tags…"
                    class="h-8 pl-8"
                    aria-label="Search tags"
                    onkeydown={(e) => e.stopPropagation()}
                  />
                </div>
                <div class="max-h-64 overflow-y-auto">
                  {#if filtered_available_tags.length === 0}
                    <p class="px-2 py-3 text-center text-sm text-muted-foreground">
                      No matching tags
                    </p>
                  {:else}
                    <ul class="flex flex-col gap-0.5">
                      {#each filtered_available_tags as { tag, count } (tag)}
                        <li>
                          <label
                            class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                          >
                            <Checkbox
                              checked={is_tag_selected(tag)}
                              onCheckedChange={(v) => toggle_tag(tag, v === true)}
                            />
                            <span class="min-w-0 flex-1 truncate text-sm">{tag}</span>
                            <span class="text-xs text-muted-foreground tabular-nums">{count}</span>
                          </label>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
                {#if selected_tags.length > 0}
                  <div class="mt-2 border-t border-border/60 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="h-7 w-full text-xs"
                      onclick={clear_tags}
                    >
                      Clear selection
                    </Button>
                  </div>
                {/if}
              </Popover.Content>
            </Popover.Root>
            {#if selected_tags.length > 0}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="size-8 shrink-0"
                onclick={clear_tags}
                aria-label="Clear tag filters"
                title="Clear tag filters"
              >
                <X aria-hidden="true" />
              </Button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if selected_tags.length > 0}
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs text-muted-foreground">Active tags:</span>
      {#each selected_tags as tag (tag)}
        <button
          type="button"
          class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onclick={() => toggle_tag(tag, false)}
          title={`Remove tag “${tag}”`}
        >
          <Badge variant="default" class="gap-1 font-normal">
            {tag}
            <X class="size-3 opacity-80" aria-hidden="true" />
          </Badge>
        </button>
      {/each}
    </div>
  {/if}

  {#if total_count > 0}
    <p class="text-xs text-muted-foreground">
      Showing {showing_start}–{showing_end} of {total_count} post{total_count === 1 ? '' : 's'}
      {#if total_pages > 1}
        · Page {current_page} of {total_pages}
      {/if}
    </p>
  {/if}

  {#if paginated_posts.length > 0}
    <ul class="grid grid-cols-1 gap-4 lg:grid-cols-2" bind:this={list_el}>
      {#each paginated_posts as post (post.id)}
        <li class="min-w-0">
          <a
            href={`/lekha/${post.url_slug}`}
            class="group flex h-full flex-col rounded-lg border border-border/60 bg-card/40 px-5 py-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <h2
              class={`text-lg font-semibold tracking-tight group-hover:text-primary ${post.title_transliterated ? scriptFontClass : ''}`}
            >
              {post.title_transliterated ?? post.title}
            </h2>
            {#if post.description_transliterated ?? post.description}
              <p
                class={`mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground ${post.description_transliterated ? scriptFontClass : ''}`}
              >
                {post.description_transliterated ?? post.description}
              </p>
            {/if}
            {#if post.tags.length > 0}
              <div class="mt-3 flex flex-wrap gap-1.5">
                {#each post.tags as tag (tag)}
                  <button
                    type="button"
                    class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onclick={(e) => filter_by_tag_from_card(tag, e)}
                    title={is_tag_selected(tag)
                      ? `Remove tag “${tag}” from filter`
                      : `Add tag “${tag}” to filter`}
                  >
                    <Badge
                      variant={is_tag_selected(tag) ? 'default' : 'secondary'}
                      class="font-normal"
                    >
                      {tag}
                    </Badge>
                  </button>
                {/each}
              </div>
            {/if}
            <time
              class="mt-auto block pt-3 text-xs text-muted-foreground"
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
          Try a different search term, clear tag filters, or turn on Typing for {site_prefs.script}.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}

  {#if total_pages > 1 && total_count > 0}
    <Pagination.Root
      count={total_count}
      perPage={PAGE_SIZE}
      bind:page
      onPageChange={change_page}
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
