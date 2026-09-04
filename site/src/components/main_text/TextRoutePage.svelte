<script lang="ts">
  import MetaTags from '$components/tags/MetaTags.svelte';
  import LanguageSelect from '$components/main_text/LanguageSelect.svelte';
  import MainTextScriptSelector from '$components/main_text/MainTextScriptSelector.svelte';
  import TextSiblingNavigation, {
    type TextSiblingNavigationItem
  } from '$components/main_text/TextSiblingNavigation.svelte';
  import MultimediaAttachments from '$components/main_text/MultimediaAttachments.svelte';
  import { get_script_for_lang_id } from '@app/state/lang_list';
  import { get_node_at_path, is_sibling_nav_disabled } from '@app/state/project_list';
  import { build_project_path } from '@app/utils/project_site_paths';
  import { getFontClass } from '~/components/utils/font_list';
  import { get_display_script_from_id } from '$lib/main_text/display-script';
  import { transliterate_list_for_display_client } from '$lib/main_text/script-display-client';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';
  import { NONE_LANG_ID, DEFAULT_SCRIPT_ID } from '$lib/cookies';
  import type { TextRouteLoadData } from '$lib/main_text/text-route-types';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import BanIcon from '@lucide/svelte/icons/ban';

  type PageBundle = TextRouteLoadData & {
    script_id: number;
    lang_id: number;
  };

  let { data }: { data: PageBundle } = $props();

  /** Live client overrides; null means use SSR / base Devanagari. */
  let path_names_display = $state<string[] | null>(null);
  let child_names_display = $state<string[] | null>(null);
  let text_display = $state<string[] | null>(null);
  let sibling_names_display = $state<Record<string, string>>({});
  let translation_override = $state<Record<number, string> | null>(null);

  const resolved = $derived(data.resolved);
  /** Script id used when this page's load data was produced. */
  const ssr_script_id = $derived(data.script_id);
  const script_id = $derived(site_prefs.script_id);
  const translation = $derived(translation_override ?? data.translation);
  const scriptFontClass = $derived(
    getFontClass(get_display_script_from_id(script_id)) ?? 'font-normal'
  );
  const show_language_select = $derived(data.available_lang_ids.length > 0);
  const translationScript = $derived(get_script_for_lang_id(site_prefs.lang_id));
  const translationFontClass = $derived(
    translationScript ? (getFontClass(translationScript) ?? '') : ''
  );

  function pick_display(
    script: number,
    base: string[],
    ssr: string[] | null,
    live: string[] | null
  ): string[] {
    if (script === DEFAULT_SCRIPT_ID) return base;
    if (live) return live;
    if (script === ssr_script_id && ssr) return ssr;
    return base;
  }

  // Reset lang override when navigating to a different text payload.
  $effect(() => {
    void data.translation;
    void data.resolved.canonical_path;
    translation_override = null;
  });

  const display_path_names = $derived(
    pick_display(script_id, data.path_names_dev, data.transliterated_path_names, path_names_display)
  );

  // H1 + <title> stay Devanagari; body/breadcrumb use display_path_names.
  const current_title = $derived(data.path_names_dev.at(-1) ?? resolved.project_name);
  const page_title = $derived(`${current_title} | ${resolved.project_name}`);
  const page_description = $derived(
    data.path_names_dev.length === 0
      ? `Browse ${resolved.project_name}`
      : `Browse ${resolved.project_name} — ${data.path_names_dev.join(' / ')}`
  );

  const display_child_names = $derived(
    pick_display(
      script_id,
      data.child_items.map((c) => c.name_dev),
      data.transliterated_child_names,
      child_names_display
    )
  );

  const display_text = $derived(
    pick_display(
      script_id,
      (data.text ?? []).map((t) => t.text),
      data.transliterated_text,
      text_display
    )
  );

  const display_child_items = $derived(
    data.child_items.map((item, i) => ({
      ...item,
      name_display: display_child_names[i] ?? item.name_dev
    }))
  );

  const breadcrumb_items = $derived(
    display_path_names.map((name, index) => ({
      name,
      href:
        index === display_path_names.length - 1
          ? null
          : `/${resolved.project_key}/${resolved.canonical_path
              .split('/')
              .slice(2, index + 3)
              .join('/')}`,
      level_name: resolved.path_level_names[index]
    }))
  );

  const sibling_parent_path_params = $derived(resolved.path_params.slice(0, -1));
  const sibling_parent_node = $derived(
    resolved.node.info.type === 'shloka' && resolved.path_params.length > 0
      ? sibling_parent_path_params.length === 0
        ? resolved.map
        : get_node_at_path(resolved.map, sibling_parent_path_params)
      : null
  );
  const sibling_items = $derived(
    sibling_parent_node?.info.type === 'list' ? (sibling_parent_node.list ?? []) : []
  );
  const current_sibling_position = $derived(resolved.path_params.at(-1) ?? null);
  const previous_sibling_source = $derived(
    current_sibling_position !== null && current_sibling_position > 1
      ? (sibling_items[current_sibling_position - 2] ?? null)
      : null
  );
  const next_sibling_source = $derived(
    current_sibling_position !== null && current_sibling_position < sibling_items.length
      ? (sibling_items[current_sibling_position] ?? null)
      : null
  );

  function sibling_display_name(name_dev: string | undefined): string {
    if (!name_dev) return '';
    if (script_id === DEFAULT_SCRIPT_ID) return name_dev;
    const live = sibling_names_display[name_dev];
    if (live) return live;
    // SSR: $effect does not run — use pre-transliterated nav names from load.
    if (script_id === ssr_script_id) {
      return data.transliterated_nav_names?.[name_dev] ?? name_dev;
    }
    return name_dev;
  }

  const previous_sibling_item: TextSiblingNavigationItem | null = $derived.by(() => {
    if (!previous_sibling_source || current_sibling_position === null) return null;
    return {
      href:
        build_project_path(resolved.project_key, resolved.map, [
          ...sibling_parent_path_params,
          current_sibling_position - 1
        ]) ?? resolved.canonical_path,
      name_display: sibling_display_name(previous_sibling_source.name_dev),
      disabled: is_sibling_nav_disabled(
        previous_sibling_source,
        [...sibling_parent_path_params, current_sibling_position - 1],
        resolved.levels
      )
    };
  });

  const next_sibling_item: TextSiblingNavigationItem | null = $derived.by(() => {
    if (!next_sibling_source || current_sibling_position === null) return null;
    return {
      href:
        build_project_path(resolved.project_key, resolved.map, [
          ...sibling_parent_path_params,
          current_sibling_position + 1
        ]) ?? resolved.canonical_path,
      name_display: sibling_display_name(next_sibling_source.name_dev),
      disabled: is_sibling_nav_disabled(
        next_sibling_source,
        [...sibling_parent_path_params, current_sibling_position + 1],
        resolved.levels
      )
    };
  });

  const parent_path_params = $derived(resolved.path_params.slice(0, -1));
  const parent_href = $derived(
    parent_path_params.length === 0
      ? `/${resolved.project_key}`
      : (build_project_path(resolved.project_key, resolved.map, parent_path_params) ??
          `/${resolved.project_key}`)
  );
  const parent_name_dev = $derived(
    parent_path_params.length === 0
      ? resolved.map.name_dev
      : (resolved.path_names.at(-2) ?? resolved.map.name_dev)
  );
  /** Prefer breadcrumb path display (already SSR-transliterated); map root uses nav map. */
  const parent_name_display = $derived(
    resolved.path_params.length >= 2
      ? (display_path_names.at(-2) ?? sibling_display_name(parent_name_dev))
      : sibling_display_name(parent_name_dev)
  );
  const show_parent_back_link = $derived(resolved.path_params.length > 0 && !!parent_name_display);
  const show_project_root_back_link = $derived(resolved.path_params.length > 1);
  const is_empty_list_view = $derived(
    resolved.node.info.type === 'list' && (resolved.node.list ?? []).length === 0
  );

  $effect(() => {
    const sid = script_id;
    const loaded_script_id = ssr_script_id;
    const path_base = data.path_names_dev;
    const child_base = data.child_items.map((c) => c.name_dev);
    const text_base = (data.text ?? []).map((t) => t.text);
    const sibling_devs = [previous_sibling_source?.name_dev, next_sibling_source?.name_dev].filter(
      (n): n is string => !!n
    );
    // Map-root parent only (path depth 1); deeper parents come from display_path_names.
    const parent_dev =
      resolved.path_params.length === 1 && parent_name_dev ? parent_name_dev : null;
    const extra = [...sibling_devs, ...(parent_dev ? [parent_dev] : [])];

    if (sid === DEFAULT_SCRIPT_ID) {
      path_names_display = null;
      child_names_display = null;
      text_display = null;
      sibling_names_display = {};
      return;
    }

    // Same script as SSR — use pre-transliterated_* (incl. nav names); no client pass.
    if (sid === loaded_script_id) {
      path_names_display = null;
      child_names_display = null;
      text_display = null;
      sibling_names_display = data.transliterated_nav_names ?? {};
      return;
    }

    let cancelled = false;
    (async () => {
      const [paths, children, texts, extras] = await Promise.all([
        path_base.length
          ? transliterate_list_for_display_client(path_base, sid)
          : Promise.resolve(null),
        child_base.length
          ? transliterate_list_for_display_client(child_base, sid)
          : Promise.resolve(null),
        text_base.length
          ? transliterate_list_for_display_client(text_base, sid)
          : Promise.resolve(null),
        extra.length ? transliterate_list_for_display_client(extra, sid) : Promise.resolve([])
      ]);
      if (cancelled) return;
      path_names_display = paths;
      child_names_display = children;
      text_display = texts;
      const map: Record<string, string> = {};
      extra.forEach((dev, i) => {
        map[dev] = extras[i] ?? dev;
      });
      sibling_names_display = map;
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

<MetaTags title={page_title} description={page_description} />

<div class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
  <div class="flex flex-col gap-3">
    <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{current_title}</h1>
    {#if display_path_names.length > 0}
      <p class={`text-sm text-muted-foreground ${scriptFontClass}`}>
        {display_path_names.join(' / ')}
      </p>
    {/if}
  </div>

  <nav
    aria-label="Breadcrumb"
    class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
  >
    <a
      class="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      href="/texts"
    >
      <BookOpenIcon class="size-3.5" />
      Texts
    </a>

    <ChevronRightIcon class="size-3" />

    <a
      class="rounded-md px-2 py-1 transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      href={`/${resolved.project_key}`}
    >
      {resolved.project_name}
    </a>

    {#each breadcrumb_items as item}
      <ChevronRightIcon class="size-3" />
      {#if item.href}
        <a
          class="rounded-md px-2 py-1 transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          href={item.href}
        >
          <span class="text-xs text-muted-foreground/70">{item.level_name}:</span>{' '}
          <span class={scriptFontClass}>{item.name}</span>
        </a>
      {:else}
        <span class="rounded-md px-2 py-1 font-medium text-foreground" aria-current="page">
          <span class="text-xs text-muted-foreground/70">{item.level_name}:</span>{' '}
          <span class={scriptFontClass}>{item.name}</span>
        </span>
      {/if}
    {/each}
  </nav>

  {#if resolved.node.info.type === 'list'}
    <section class="flex flex-col gap-5">
      {#if show_parent_back_link || show_project_root_back_link}
        <div class="flex flex-wrap items-center gap-x-6 gap-y-1 sm:gap-x-8">
          {#if show_parent_back_link}
            <a
              class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              href={parent_href}
            >
              <ChevronLeftIcon class="size-3.5" />
              Back to{' '}
              <span class={`font-medium text-foreground ${scriptFontClass}`}>
                {parent_name_display}
              </span>
            </a>
          {/if}
          {#if show_project_root_back_link}
            <a
              class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              href={`/${resolved.project_key}`}
            >
              <ChevronLeftIcon class="size-3.5" />
              Back to {resolved.project_name}
            </a>
          {/if}
        </div>
      {/if}
      <MainTextScriptSelector />
      <MultimediaAttachments media_links={data.media_links} />
      {#if is_empty_list_view}
        <p
          class="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground"
        >
          No list data here.
        </p>
      {:else}
        <div class="grid gap-3">
          {#each display_child_items as item}
            {#if item.is_disabled}
              <div
                class="group flex cursor-not-allowed items-center gap-4 rounded-xl border border-dashed bg-muted/30 p-4 opacity-70"
                aria-disabled="true"
                title="No sub-sections available for this item"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"
                  style="font-variant-numeric: tabular-nums;"
                >
                  {item.index}
                </span>
                <div class="min-w-0 flex-1 space-y-0.5">
                  <p class={`truncate text-base font-medium ${scriptFontClass}`}>
                    {item.name_display}
                  </p>
                </div>
                <div class="shrink-0 text-muted-foreground">
                  <BanIcon class="size-4 text-muted-foreground/80" />
                </div>
              </div>
            {:else}
              <a
                class="card-hover-glow group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary/30"
                href={item.href}
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"
                  style="font-variant-numeric: tabular-nums;"
                >
                  {item.index}
                </span>
                <div class="min-w-0 flex-1 space-y-0.5">
                  <p class={`truncate text-base font-medium ${scriptFontClass}`}>
                    {item.name_display}
                  </p>
                </div>
                <div
                  class="shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
                >
                  {#if item.is_leaf}
                    <BookOpenIcon class="size-4" />
                  {:else}
                    <ChevronRightIcon
                      class="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    />
                  {/if}
                </div>
              </a>
            {/if}
          {/each}
        </div>
      {/if}
    </section>
  {:else}
    <section class="flex flex-col gap-5">
      {#if show_parent_back_link || show_project_root_back_link}
        <div class="flex flex-wrap items-center gap-x-6 gap-y-1 sm:gap-x-8">
          {#if show_parent_back_link}
            <a
              class="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              href={parent_href}
            >
              <ChevronLeftIcon class="size-3.5" />
              Back to{' '}
              <span class={`font-medium text-foreground ${scriptFontClass}`}>
                {parent_name_display}
              </span>
            </a>
          {/if}
          {#if show_project_root_back_link}
            <a
              class="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              href={`/${resolved.project_key}`}
            >
              <ChevronLeftIcon class="size-3.5" />
              Back to {resolved.project_name}
            </a>
          {/if}
        </div>
      {/if}

      <div class="flex flex-wrap gap-4">
        <MainTextScriptSelector />
        {#if show_language_select}
          <LanguageSelect
            available_lang_ids={data.available_lang_ids}
            project_id={resolved.project_id}
            path_params={resolved.path_params}
            on_translation_change={(t) => {
              translation_override = t;
            }}
          />
        {/if}
      </div>

      <TextSiblingNavigation
        previous_item={previous_sibling_item}
        next_item={next_sibling_item}
        script_font_class={scriptFontClass}
      />

      <MultimediaAttachments
        media_links={data.media_links}
        selected_lang_id={site_prefs.lang_id === NONE_LANG_ID ? null : site_prefs.lang_id}
      />

      <div class="space-y-4">
        {#each data.text ?? [] as item, index}
          <div id={`L-${item.index}`} class="rounded-lg border bg-card/50 p-4 sm:p-5">
            <div class="flex gap-3">
              <div class="min-w-0 flex-1 space-y-2">
                <div
                  class={`text-base leading-8 whitespace-pre-line sm:text-lg ${scriptFontClass}`}
                >
                  {display_text[index]}
                </div>
                {#if site_prefs.lang_id !== NONE_LANG_ID && translation?.[item.index]}
                  <div
                    class={`border-t border-border/30 pt-2 text-sm leading-7 whitespace-pre-line text-yellow-700 dark:text-yellow-400 ${translationFontClass}`}
                  >
                    {translation[item.index]}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

      <TextSiblingNavigation
        previous_item={previous_sibling_item}
        next_item={next_sibling_item}
        script_font_class={scriptFontClass}
      />
    </section>
  {/if}
</div>
