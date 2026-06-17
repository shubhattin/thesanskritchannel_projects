<script lang="ts">
  import type { project_type } from '$app/state/project_list';
  import * as InputGroup from '~/lib/components/ui/input-group';
  import * as Pagination from '~/lib/components/ui/pagination';
  import * as Empty from '~/lib/components/ui/empty';
  import { Label } from '~/lib/components/ui/label';
  import { Switch } from '~/lib/components/ui/switch';
  import SearchIcon from '@lucide/svelte/icons/search';
  import KeyboardIcon from '@lucide/svelte/icons/keyboard';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';

  const PAGE_SIZE = 16;

  let { projects }: { projects: readonly project_type[] } = $props();

  let search_text = $state('');
  let typing_enabled = $state(false);
  let page = $state(1);

  const ctx = $derived(
    createTypingContext('Devanagari', {
      includeInherentVowel: true
    })
  );

  $effect(() => {
    ctx.ready;
  });

  const matches_query = (project: project_type, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    if (project.name.toLowerCase().includes(q)) return true;
    if (project.name_dev.toLowerCase().includes(q)) return true;
    if (project.description?.toLowerCase().includes(q)) return true;
    return false;
  };

  const filtered_projects = $derived(projects.filter((p) => matches_query(p, search_text)));
  const total_count = $derived(filtered_projects.length);
  const total_pages = $derived(Math.max(1, Math.ceil(total_count / PAGE_SIZE)));
  const current_page = $derived(Math.max(1, Math.min(page, total_pages)));

  const paginated_projects = $derived(
    filtered_projects.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE)
  );

  const showing_start = $derived(total_count === 0 ? 0 : (current_page - 1) * PAGE_SIZE + 1);
  const showing_end = $derived(Math.min(current_page * PAGE_SIZE, total_count));

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
</script>

<div class="flex flex-col gap-6">
  <InputGroup.Root class="h-10 w-full">
    <InputGroup.Addon align="inline-start" class="pl-2.5">
      <SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    </InputGroup.Addon>
    <InputGroup.Input
      placeholder="Search by English or Sanskrit name…"
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
      aria-label="Search texts"
    />
    <InputGroup.Addon
      align="inline-end"
      class="cursor-default gap-2 border-s border-border/50 ps-3 pe-2.5"
    >
      <Label
        for="texts-typing-switch"
        class="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground select-none"
      >
        <KeyboardIcon class="size-3.5" aria-hidden="true" />
        Typing
      </Label>
      <Switch id="texts-typing-switch" bind:checked={typing_enabled} />
    </InputGroup.Addon>
  </InputGroup.Root>

  {#if total_count > 0}
    <p class="text-xs text-muted-foreground">
      Showing {showing_start}–{showing_end} of {total_count} text{total_count === 1 ? '' : 's'}
    </p>
  {/if}

  {#if paginated_projects.length > 0}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each paginated_projects as project (project.id)}
        <a
          href={`/${project.key}`}
          class="group relative flex flex-col justify-between rounded-2xl border border-border bg-card/40 p-5 shadow-2xs backdrop-blur-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/85 hover:shadow-sm"
        >
          <!-- Subtle hover light effect -->
          <div
            class="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          ></div>

          <div class="relative flex flex-col gap-2">
            <p
              class="font-devanagari text-xl font-medium tracking-wide text-foreground transition-colors duration-300 group-hover:text-primary"
            >
              {project.name_dev}
            </p>
            <p class="text-sm font-semibold text-muted-foreground/90">{project.name}</p>
            {#if project.description}
              <p class="line-clamp-2 text-sm leading-relaxed text-muted-foreground/75">
                {project.description}
              </p>
            {/if}
          </div>
          <div
            class="relative mt-5 flex items-center gap-1 text-xs font-semibold text-primary/80 transition-colors duration-300 group-hover:text-primary"
          >
            <span>Read Text</span>
            <ArrowRight
              class="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <Empty.Root class="border border-dashed border-border/60 bg-muted/20 py-12">
      <Empty.Header>
        <Empty.Media variant="icon">
          <BookOpen aria-hidden="true" />
        </Empty.Media>
        <Empty.Title>No texts found</Empty.Title>
        <Empty.Description>
          Try a different search term or turn on Typing to search in Devanagari.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}

  {#if total_count > PAGE_SIZE}
    <Pagination.Root count={total_count} perPage={PAGE_SIZE} bind:page>
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
