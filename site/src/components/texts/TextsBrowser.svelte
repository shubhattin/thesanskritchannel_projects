<script lang="ts">
  import type { project_type } from '@app/state/project_list';
  import * as InputGroup from '~/lib/components/ui/input-group';
  import * as Pagination from '~/lib/components/ui/pagination';
  import * as Empty from '~/lib/components/ui/empty';
  import { Label } from '~/lib/components/ui/label';
  import { Switch } from '~/lib/components/ui/switch';
  import SearchIcon from '@lucide/svelte/icons/search';
  import KeyboardIcon from '@lucide/svelte/icons/keyboard';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { clearTypingContextOnKeyDown, handleTypingBeforeInputEvent } from 'lipilekhika/typing';
  import { filter_projects_by_search } from '@app/utils/search/project_list_search';
  import { create_project_name_dev_normal_cache } from '@app/utils/search/project_name_dev_normal_cache';
  import { withPaginationListScroll } from '@app/lib/pagination-scroll';
  import MainTextScriptSelector from '$components/main_text/MainTextScriptSelector.svelte';
  import { getFontClass } from '~/components/utils/font_list';
  import { DEFAULT_SCRIPT_ID } from '$lib/cookies';
  import { load_display_names } from '$lib/main_text/display-name-cache';
  import { get_display_script_from_id } from '$lib/main_text/display-script';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';
  import { use_script_query } from '$lib/search/use-script-query.svelte';

  const PAGE_SIZE = 16;

  let {
    projects,
    ssr_script_id,
    name_devs_display
  }: {
    projects: readonly project_type[];
    ssr_script_id: number;
    name_devs_display: readonly string[] | null;
  } = $props();

  let search_text = $state('');
  let typing_enabled = $state(false);
  let page = $state(1);

  const script_query = use_script_query(() => search_text);
  const script_font_class = $derived(
    getFontClass(get_display_script_from_id(site_prefs.script_id)) ?? 'font-normal'
  );

  const name_dev_normal_cache = create_project_name_dev_normal_cache();
  let name_dev_cache_version = $state(0);
  let display_names = $state<{ script_id: number; names: ReadonlyMap<string, string> } | null>(
    null
  );

  $effect(() => {
    const name_devs = projects.map((project) => project.name_dev);
    void name_dev_normal_cache.ensure_all(name_devs).then(() => {
      name_dev_cache_version++;
    });
  });

  const ssr_display = $derived.by(() => {
    if (!name_devs_display || ssr_script_id === DEFAULT_SCRIPT_ID) return null;
    const names = new Map<string, string>();
    projects.forEach((project, index) => {
      const shown = name_devs_display[index];
      if (shown && shown !== project.name_dev) names.set(project.name_dev, shown);
    });
    return names;
  });

  $effect(() => {
    const script_id = site_prefs.script_id;
    if (script_id === DEFAULT_SCRIPT_ID) return;
    if (script_id === ssr_script_id && name_devs_display) return;

    const name_devs = projects.map((project) => project.name_dev);
    let cancelled = false;
    void load_display_names(name_devs, script_id).then((names) => {
      if (!cancelled) display_names = { script_id, names };
    });
    return () => {
      cancelled = true;
    };
  });

  const shown_name_dev = (name_dev: string) => {
    if (site_prefs.script_id === DEFAULT_SCRIPT_ID) return name_dev;
    if (display_names?.script_id === site_prefs.script_id) {
      return display_names.names.get(name_dev) ?? name_dev;
    }
    if (site_prefs.script_id === ssr_script_id) return ssr_display?.get(name_dev) ?? name_dev;
    return name_dev;
  };

  const filtered_projects = $derived.by(() => {
    void name_dev_cache_version;
    void display_names;
    const query_normals = script_query.normals_for_text(search_text);
    return filter_projects_by_search(
      projects,
      search_text,
      (name_dev) => name_dev_normal_cache.get(name_dev),
      {
        query_normals,
        get_name_dev_display: (name_dev) => {
          const shown = shown_name_dev(name_dev);
          return shown === name_dev ? undefined : shown;
        }
      }
    );
  });
  const total_count = $derived(filtered_projects.length);
  const total_pages = $derived(Math.max(1, Math.ceil(total_count / PAGE_SIZE)));
  const current_page = $derived(Math.max(1, Math.min(page, total_pages)));

  const paginated_projects = $derived(
    filtered_projects.slice((current_page - 1) * PAGE_SIZE, current_page * PAGE_SIZE)
  );

  const showing_start = $derived(total_count === 0 ? 0 : (current_page - 1) * PAGE_SIZE + 1);
  const showing_end = $derived(Math.min(current_page * PAGE_SIZE, total_count));

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
  <div class="flex flex-col items-center gap-3 lg:flex-row lg:items-center lg:gap-4">
    <InputGroup.Root class="h-10 w-full lg:min-w-0 lg:flex-1">
      <InputGroup.Addon align="inline-start" class="pl-2.5">
        <SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
      </InputGroup.Addon>
      <InputGroup.Input
        placeholder="Search by English or Sanskrit name…"
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
        <Switch
          id="texts-typing-switch"
          bind:checked={typing_enabled}
          title={`${site_prefs.script} transliteration typing (Alt+X)`}
        />
      </InputGroup.Addon>
    </InputGroup.Root>
    <div class="flex w-full justify-center lg:w-auto lg:shrink-0">
      <MainTextScriptSelector compact />
    </div>
  </div>

  {#if total_count > 0}
    <p class="text-xs text-muted-foreground">
      Showing {showing_start}–{showing_end} of {total_count} text{total_count === 1 ? '' : 's'}
      {#if total_pages > 1}
        · Page {current_page} of {total_pages}
      {/if}
    </p>
  {/if}

  {#if paginated_projects.length > 0}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" bind:this={list_el}>
      {#each paginated_projects as project (project.id)}
        {@const name_dev_shown = shown_name_dev(project.name_dev)}
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
              class={`text-xl font-medium tracking-wide text-foreground transition-colors duration-300 group-hover:text-primary ${name_dev_shown === project.name_dev ? 'font-devanagari' : script_font_class}`}
            >
              {name_dev_shown}
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
          Try a different search term, or turn on Typing to search in {site_prefs.script}.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}

  {#if total_pages > 1}
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
