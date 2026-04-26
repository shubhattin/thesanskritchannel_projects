<script lang="ts">
  import { Carta, MarkdownEditor } from 'carta-md';
  import 'carta-md/default.css';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { useQueryClient } from '@tanstack/svelte-query';
  import { client_q } from '~/api/client';
  import { Debounced } from 'runed';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Switch } from '$lib/components/ui/switch';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Select from '$lib/components/ui/select';
  import LekhaTagsInput from './LekhaTagsInput.svelte';
  import {
    cartaHtmlSanitizer,
    lekhaUrlSlugify,
    renderLekhaMarkdownToHtml,
    sanitizeRenderedHtmlForPreview
  } from '~/utils/markdown';
  import {
    SCRIPT_LIST,
    get_script_from_id,
    get_script_id,
    type script_list_type
  } from '~/state/lang_list';
  import Check from '@lucide/svelte/icons/check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import type { SiteLekha } from '~/db/schema_zod';

  let {
    mode,
    lekha_id,
    initial
  }: {
    mode: 'edit' | 'create';
    lekha_id?: number;
    initial?: Omit<SiteLekha, 'id' | 'published_at' | 'updated_at'>;
  } = $props();

  let title = $state('');
  let description = $state('');
  let content = $state('');
  let tags = $state<string[]>([]);
  let draft = $state(true);
  let listed = $state(true);
  let search_indexed = $state(false);
  /** When true, slug is derived from title and the slug field is read-only. */
  let slug_auto = $state(true);
  let url_slug_manual = $state('');

  let preview_script_id = $state(get_script_id('Devanagari' as script_list_type) ?? 1);
  let editor_section = $state<'write' | 'preview'>('write');
  let preview_html = $state('');
  let preview_loading = $state(false);
  let preview_error = $state<string | null>(null);
  let form_error = $state<string | null>(null);
  let editor_ready = $state(false);

  onMount(() => {
    editor_ready = true;
  });

  $effect(() => {
    if (!initial) return;
    title = initial.title;
    description = initial.description;
    content = initial.content;
    tags = [...initial.tags];
    url_slug_manual = initial.url_slug;
    search_indexed = initial.search_indexed;
    draft = initial.draft;
    listed = initial.listed;
    slug_auto = lekhaUrlSlugify(initial.title) === lekhaUrlSlugify(initial.url_slug);
  });

  let slug_effective = $derived(
    slug_auto ? lekhaUrlSlugify(title) : lekhaUrlSlugify(url_slug_manual)
  );

  let debounced_for_slug = new Debounced(
    () => (slug_auto ? lekhaUrlSlugify(title) : lekhaUrlSlugify(url_slug_manual)),
    500
  );

  let slug_check_inputs = $state<{
    url_slug: string;
    exclude_id: number | undefined;
  }>({ url_slug: '', exclude_id: undefined });

  let debounced_val = $state('');
  let debounced_pend = $state(false);

  $effect(() => {
    const debounced_slug = debounced_for_slug.current;
    const debounced_slug_pending = debounced_for_slug.pending;
    const exclude_id_for_edit = mode === 'edit' && lekha_id != null ? lekha_id : undefined;
    debounced_val = debounced_slug;
    debounced_pend = debounced_slug_pending;
    slug_check_inputs = { url_slug: debounced_slug, exclude_id: exclude_id_for_edit };
  });

  let slug_in_sync = $derived(
    slug_effective.length > 0 && !debounced_pend && debounced_val === slug_effective
  );

  const slug_check_q = $derived(
    client_q.site.lekha.check_url_slug.query({
      url_slug: slug_check_inputs.url_slug,
      exclude_id: slug_check_inputs.exclude_id
    })
  );

  const carta = new Carta({
    sanitizer: cartaHtmlSanitizer
  });

  const script_options = SCRIPT_LIST.map((name) => ({
    name,
    id: get_script_id(name as script_list_type)
  })).filter((o): o is { name: string; id: number } => o.id != null);

  const query_client = useQueryClient();

  const invalidate_lekha_queries = async () => {
    // TODO:
    await query_client.invalidateQueries({
      queryKey: [['site', 'lekha', 'list_lekhas']],
      exact: false
    });
    await query_client.invalidateQueries({
      queryKey: [['site', 'lekha', 'get_lekha']],
      exact: false
    });
  };

  const add_mut = client_q.site.lekha.add_lekha.mutation({
    onSuccess: async ({ id }) => {
      await invalidate_lekha_queries();
      await goto(`/lekha/edit/${id}`);
    }
  });

  const edit_mut = client_q.site.lekha.edit_lekha.mutation({
    onSuccess: async () => {
      await invalidate_lekha_queries();
    }
  });

  $effect(() => {
    if (!browser || editor_section !== 'preview') return;
    const md = content;
    preview_loading = true;
    preview_error = null;
    let cancelled = false;
    (async () => {
      try {
        const html = await renderLekhaMarkdownToHtml(md, {
          script: get_script_from_id(preview_script_id)
        });
        if (!cancelled) {
          preview_html = sanitizeRenderedHtmlForPreview(html);
        }
      } catch (e) {
        if (!cancelled) {
          preview_error = e instanceof Error ? e.message : String(e);
          preview_html = '';
        }
      } finally {
        if (!cancelled) preview_loading = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  const save = (e: Event) => {
    e.preventDefault();
    form_error = null;
    if (!title.trim() || !description.trim() || !content.trim()) {
      form_error = 'Title, description, and content are required.';
      return;
    }
    const url_slug = slug_auto ? lekhaUrlSlugify(title) : lekhaUrlSlugify(url_slug_manual);
    if (!url_slug) {
      form_error = slug_auto
        ? 'Title must include at least one letter or digit for the URL slug.'
        : 'URL slug is required; use only letters, digits, and hyphens.';
      return;
    }
    if (browser && !slug_in_sync) {
      form_error = 'Please wait for the URL slug to finish updating before saving.';
      return;
    }
    if (browser && slug_effective) {
      const chk = get(slug_check_q);
      if (chk.isError) {
        form_error = 'Could not verify the URL slug. Check your connection and try again.';
        return;
      }
      if (chk.isPending || chk.isFetching) {
        form_error = 'Please wait for the URL slug to be verified before saving.';
        return;
      }
      if (chk.data?.exists) {
        form_error = 'This URL slug is already in use. Choose a different one.';
        return;
      }
    }
    const post_data = {
      title: title.trim(),
      description: description.trim(),
      content,
      tags,
      url_slug: slug_auto ? lekhaUrlSlugify(title) : url_slug_manual.trim(),
      draft,
      listed,
      search_indexed
    };
    if (mode === 'create') {
      $add_mut.mutate({ post_data });
    } else {
      if (lekha_id == null) {
        form_error = 'Missing post id.';
        return;
      }
      $edit_mut.mutate({ id: lekha_id, post_data });
    }
  };
</script>

{#snippet slug_status_icon()}
  {#if !slug_effective}
    <span class="sr-only">Enter a title or slug to check availability</span>
  {:else if !slug_in_sync || $slug_check_q.isPending || $slug_check_q.isFetching}
    <Loader2 class="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
    <span class="sr-only">Checking whether this URL slug is available…</span>
  {:else if $slug_check_q.isError}
    <CircleAlert class="size-5 shrink-0 text-destructive" aria-hidden="true" />
    <span class="sr-only">Could not verify URL slug</span>
  {:else if $slug_check_q.data?.exists}
    <CircleAlert class="size-5 shrink-0 text-destructive" aria-hidden="true" />
    <span class="sr-only">This URL slug is already in use</span>
  {:else}
    <Check
      class="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
      aria-hidden="true"
      strokeWidth={2.5}
    />
    <span class="sr-only">URL slug is available</span>
  {/if}
{/snippet}

<form class="mx-auto w-full max-w-3xl space-y-6 pb-10" onsubmit={save}>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-semibold tracking-tight">
      {mode === 'create' ? 'New lekha' : 'Edit lekha'}
    </h1>
    <div class="flex items-center gap-2">
      <Button type="button" variant="outline" href="/lekha">Cancel</Button>
      <Button
        type="submit"
        disabled={$add_mut.isPending ||
          $edit_mut.isPending ||
          (browser &&
            !!slug_effective &&
            (!slug_in_sync ||
              $slug_check_q.isError ||
              $slug_check_q.isPending ||
              $slug_check_q.isFetching ||
              $slug_check_q.data?.exists !== false))}
        data-testid="lekha-save"
      >
        {$add_mut.isPending || $edit_mut.isPending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  </div>

  {#if form_error}
    <p class="text-sm text-destructive" role="alert">{form_error}</p>
  {/if}
  {#if $add_mut.isError}
    <p class="text-sm text-destructive" role="alert">{String($add_mut.error)}</p>
  {/if}
  {#if $edit_mut.isError}
    <p class="text-sm text-destructive" role="alert">{String($edit_mut.error)}</p>
  {/if}

  <div class="grid gap-4 sm:grid-cols-1">
    <div class="space-y-2">
      <Label for="lekha-title">Title</Label>
      <Input id="lekha-title" bind:value={title} required autocomplete="off" />
    </div>
    <div class="space-y-2">
      <Label for="lekha-description">Description</Label>
      <Textarea
        id="lekha-description"
        bind:value={description}
        required
        rows={3}
        class="min-h-20"
      />
    </div>
    <div class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Label for="lekha-slug" class="mb-0">URL slug</Label>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground" id="slug-auto-hint">Auto from title</span>
          <Switch
            id="sw-slug-auto"
            bind:checked={slug_auto}
            aria-labelledby="slug-auto-hint"
            onCheckedChange={(v) => {
              if (!v) {
                const s = lekhaUrlSlugify(title);
                if (s && !url_slug_manual.trim()) url_slug_manual = s;
              }
            }}
          />
        </div>
      </div>
      {#if slug_auto}
        <div class="flex gap-2">
          <Input
            id="lekha-slug"
            value={lekhaUrlSlugify(title) || '—'}
            disabled
            class="min-w-0 flex-1 font-mono text-sm"
            title="Derived from the title; turn off “Auto from title” to set manually."
          />
          <div class="flex w-9 shrink-0 items-center justify-center self-center" aria-live="polite">
            {@render slug_status_icon()}
          </div>
        </div>
        <p class="text-xs text-muted-foreground">Updates when the title changes.</p>
      {:else}
        <div class="flex gap-2">
          <Input
            id="lekha-slug"
            bind:value={url_slug_manual}
            class="min-w-0 flex-1 font-mono text-sm"
            placeholder="my-post-slug"
            autocomplete="off"
          />
          <div class="flex w-9 shrink-0 items-center justify-center self-center" aria-live="polite">
            {@render slug_status_icon()}
          </div>
        </div>
        <p class="text-xs text-muted-foreground">Lowercase, letters, digits, and hyphens only.</p>
      {/if}
    </div>
  </div>

  <LekhaTagsInput bind:tags />

  <div class="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-1 md:grid-cols-3">
    <div
      class="flex items-center justify-between gap-3 md:flex-col md:items-stretch md:justify-start"
    >
      <Label for="sw-draft" class="text-sm font-medium">Draft</Label>
      <Switch id="sw-draft" bind:checked={draft} />
    </div>
    <div
      class="flex items-center justify-between gap-3 md:flex-col md:items-stretch md:justify-start"
    >
      <Label for="sw-listed" class="text-sm font-medium">Listed</Label>
      <Switch id="sw-listed" bind:checked={listed} />
    </div>
    <div
      class="flex items-center justify-between gap-3 md:flex-col md:items-stretch md:justify-start"
    >
      <Label for="sw-search" class="text-sm font-medium">Search indexed</Label>
      <Switch id="sw-search" bind:checked={search_indexed} />
    </div>
  </div>

  <div class="space-y-2">
    <Label>Content</Label>
    <Tabs.Root bind:value={editor_section} class="w-full">
      <Tabs.List class="grid w-full max-w-md grid-cols-2">
        <Tabs.Trigger value="write">Write</Tabs.Trigger>
        <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="write" class="mt-3 outline-none">
        {#if browser && editor_ready}
          <div class="lekha-carta">
            <MarkdownEditor
              {carta}
              bind:value={content}
              mode="tabs"
              scroll="async"
              placeholder="Write markdown…"
              selectedTab="write"
            />
          </div>
        {:else}
          <div
            class="flex min-h-[24rem] items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground"
          >
            Loading editor…
          </div>
        {/if}
      </Tabs.Content>
      <Tabs.Content value="preview" class="mt-3 space-y-3 outline-none">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-muted-foreground">Preview script</span>
          <Select.Root
            type="single"
            value={preview_script_id.toString()}
            onValueChange={(v) => {
              const n = parseInt(v, 10);
              if (Number.isFinite(n)) preview_script_id = n;
            }}
          >
            <Select.Trigger class="w-full sm:w-64" id="preview-script">
              {script_options.find((o) => o.id === preview_script_id)?.name ?? 'Script'}
            </Select.Trigger>
            <Select.Content>
              {#each script_options as opt (opt.id)}
                <Select.Item value={opt.id.toString()} label={opt.name}>{opt.name}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        {#if preview_loading}
          <p class="text-sm text-muted-foreground">Rendering preview…</p>
        {:else if preview_error}
          <p class="text-sm text-destructive">{preview_error}</p>
        {/if}
        <div
          class="prose max-w-none rounded-lg border bg-muted/20 p-4 text-foreground prose-neutral dark:prose-invert"
        >
          <!-- eslint-disable svelte/no-at-html-tags -->
          {@html preview_html || '<p class="text-muted-foreground">Nothing to preview.</p>'}
        </div>
      </Tabs.Content>
    </Tabs.Root>
  </div>
</form>

<style>
  :global(.lekha-carta .carta-theme__default) {
    --border-color: var(--border);
    --selection-color: color-mix(in oklab, var(--primary) 22%, transparent);
    --focus-outline: var(--ring);
    --hover-color: var(--muted);
    --caret-color: var(--foreground);
    --text-color: var(--foreground);
    --border-color-dark: var(--border);
    --selection-color-dark: color-mix(in oklab, var(--primary) 22%, transparent);
    --focus-outline-dark: var(--ring);
    --hover-color-dark: var(--muted);
    --caret-color-dark: var(--foreground);
    --text-color-dark: var(--foreground);
  }

  /* Carta's recommended dark-mode variable switch (docs: Editing Styles). */
  :global(html.dark .lekha-carta .carta-theme__default) {
    --border-color: var(--border-color-dark);
    --selection-color: var(--selection-color-dark);
    --focus-outline: var(--focus-outline-dark);
    --hover-color: var(--hover-color-dark);
    --caret-color: var(--caret-color-dark);
    --text-color: var(--text-color-dark);
  }

  :global(.lekha-carta .carta-theme__default.carta-editor) {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--background);
  }

  /* Hide Carta's internal Write/Preview strip (we already have outer tabs). */
  :global(.lekha-carta .carta-theme__default .carta-toolbar-left) {
    display: none !important;
  }

  :global(.lekha-carta .carta-filler) {
    display: none;
  }

  :global(.lekha-carta .carta-theme__default .carta-toolbar-right) {
    margin-left: auto;
    padding: 0 0.35rem;
  }

  :global(.lekha-carta .carta-theme__default .carta-toolbar) {
    background: var(--card);
  }

  :global(.lekha-carta .carta-theme__default .carta-input),
  :global(.lekha-carta .carta-theme__default .carta-renderer),
  :global(.lekha-carta .carta-theme__default .carta-icons-menu) {
    background: var(--background);
    color: var(--foreground);
  }

  :global(.lekha-carta .carta-theme__default .carta-input ::placeholder) {
    color: var(--muted-foreground);
  }

  :global(.lekha-carta .carta-theme__default .carta-input textarea),
  :global(.lekha-carta .carta-theme__default .carta-input pre) {
    color: var(--foreground);
  }

  :global(.lekha-carta .carta-theme__default .carta-input),
  :global(.lekha-carta .carta-theme__default .carta-renderer) {
    min-height: 24rem;
  }

  /* Carta docs dark-mode guidance for Shiki token colors. */
  :global(.lekha-carta .shiki) {
    background: var(--background) !important;
  }

  :global(html.dark .lekha-carta .shiki),
  :global(html.dark .lekha-carta .shiki span) {
    color: var(--shiki-dark) !important;
  }

  :global(.carta-font-code) {
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
    font-size: 0.95rem;
    line-height: 1.45;
    letter-spacing: normal;
  }
</style>
