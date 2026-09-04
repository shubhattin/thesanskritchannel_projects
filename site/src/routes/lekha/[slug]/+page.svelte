<script lang="ts">
  import '@app/lib/carta_markdown/code/shiki-theme.css';
  import LekhaCodeBlockCopy from '$components/lekha/LekhaCodeBlockCopy.svelte';
  import MainTextScriptSelector from '$components/main_text/MainTextScriptSelector.svelte';
  import { getFontClass } from '~/components/utils/font_list';
  import { get_display_script_from_id } from '$lib/main_text/display-script';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';
  import { DEFAULT_SCRIPT_ID } from '$lib/cookies';
  import { renderLekhaMarkdownToHtml } from '@app/lib/carta_markdown/markdown';
  import { get_script_from_id } from '@app/state/lang_list';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let display_html = $derived(data.entry.html);
  let ssr_script_id = $derived(data.script_id);

  const scriptFontClass = $derived(
    getFontClass(get_display_script_from_id(site_prefs.script_id)) ?? 'font-normal'
  );

  $effect(() => {
    const sid = site_prefs.script_id;
    const content = data.entry.content;
    const has_indicator = data.entry.has_script_indicator;

    if (!has_indicator) return;

    if (sid === ssr_script_id) {
      display_html = data.entry.html;
      return;
    }

    if (sid === DEFAULT_SCRIPT_ID && data.entry.html_base) {
      display_html = data.entry.html_base;
      return;
    }

    if (sid === DEFAULT_SCRIPT_ID) {
      display_html = data.entry.html;
      return;
    }

    let cancelled = false;
    const script = get_script_from_id(sid) ?? 'Devanagari';
    (async () => {
      const html = await renderLekhaMarkdownToHtml(content, { script });
      if (!cancelled) display_html = html;
    })();

    return () => {
      cancelled = true;
    };
  });

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

<svelte:head>
  <title>{data.entry.title} — Lekha</title>
  {#if data.entry.description}
    <meta name="description" content={data.entry.description} />
  {/if}
</svelte:head>

<article class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <p class="mb-8 text-sm text-muted-foreground">
    <a
      href="/lekha"
      class="inline-flex items-center gap-1.5 text-primary transition-colors hover:text-primary/90 hover:underline"
    >
      <span aria-hidden="true" class="select-none">←</span>
      All posts
    </a>
  </p>
  <header class="mb-10 border-b border-border pb-8">
    <h1 class="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
      {data.entry.title}
    </h1>
    {#if data.entry.description}
      <p class="mt-4 text-lg text-muted-foreground">{data.entry.description}</p>
    {/if}
    <div class="mt-4 flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <time datetime={toIso(data.entry.published_at)}>
          {formatDate(data.entry.published_at)}
        </time>
      </div>
      {#if data.entry.has_script_indicator}
        <MainTextScriptSelector />
      {/if}
    </div>
  </header>
  <div
    data-lekha-markdown
    class={`lekha-markdown ${scriptFontClass} prose max-w-none prose-neutral dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-a:text-primary`}
  >
    {@html display_html}
  </div>
  <LekhaCodeBlockCopy />
  <p class="mt-12 text-sm text-muted-foreground">
    <a
      href="/lekha"
      class="inline-flex items-center gap-1.5 text-primary transition-colors hover:text-primary/90 hover:underline"
    >
      <span aria-hidden="true" class="select-none">←</span>
      All posts
    </a>
  </p>
</article>
