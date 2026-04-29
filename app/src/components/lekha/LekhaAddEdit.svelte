<script lang="ts">
  import { Carta, MarkdownEditor } from 'carta-md';
  import 'carta-md/default.css';
  import '@cartamd/plugin-code/default.css';
  import '$lib/carta_markdown/code/shiki-theme.css';
  import '$lib/carta_markdown/video/video-container.css';
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
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Select from '$lib/components/ui/select';
  import { getLekhaCartaExtensions } from '~/lib/carta_markdown/lekhaCartaExtensions';
  import LekhaTagsInput from './LekhaTagsInput.svelte';
  import {
    cartaHtmlSanitizer,
    lekhaUrlSlugify,
    normalizeLekhaTextFields,
    renderLekhaMarkdownToHtml,
    sanitizeAndFormatLekhaMarkdownForStorage
  } from '~/lib/carta_markdown/markdown';
  import { LEKHA_SHIKI_DUAL } from '~/lib/carta_markdown/code/lekhaShikiThemes';
  import { LEKHA_SHIKI_LANGS } from '~/lib/carta_markdown/code/lekhaShikiLangs';
  import {
    SCRIPT_LIST,
    get_script_from_id,
    get_script_id,
    type script_list_type
  } from '~/state/lang_list';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Popover from '$lib/components/ui/popover';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Info from '@lucide/svelte/icons/info';
  import Check from '@lucide/svelte/icons/check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
  import type { SiteLekha } from '~/db/schema_zod';
  import { toast } from 'svelte-sonner';

  let {
    mode,
    lekha_id,
    initial
  }: {
    mode: 'edit' | 'create';
    lekha_id?: number;
    initial?: Omit<SiteLekha, 'id'>;
  } = $props();

  // In the new svelte versions, we can use $derived for value updating too
  // this works till the prop values does not chnage so we can do this here
  let title = $derived(initial?.title ?? '');
  let description = $derived(initial?.description ?? '');
  let content = $derived(initial?.content ?? '');
  let tags = $derived(initial?.tags ?? []);
  /** Create mode: always true when saving. Edit: synced from server, false after publish. */
  let is_draft = $derived(initial?.draft ?? true);
  let published_at_shown = $derived(initial?.published_at ?? null);
  let listed = $state(true);
  let search_indexed = $state(true);
  /** When true, slug is derived from title and the slug field is read-only. */
  let slug_auto = $derived(initial?.url_slug ? false : true);
  let url_slug_manual = $derived(initial?.url_slug ?? '');

  let preview_script_id = $state(get_script_id('Devanagari' as script_list_type) ?? 1);
  let editor_section = $state<'write' | 'preview'>('write');
  let preview_html = $state('');
  let preview_loading = $state(false);
  let preview_error = $state<string | null>(null);
  let form_error = $state<string | null>(null);
  let editor_ready = $state(false);
  /** Edit only: set true after the user confirms the unlock dialog. */
  let slug_edit_unlocked = $state(false);
  let delete_dialog_open = $state(false);
  let publish_dialog_open = $state(false);
  /** Remark-format pipeline matching DB storage (manual format / post-save sync). */
  let format_busy = $state(false);
  /** Last session synced from `initial` (`'new'` or lekha id); avoids re-sync on referential re-renders. */
  let last_seeded = $state<'new' | number | null>(null);

  let slug_section_unlocked = $derived(mode === 'create' || slug_edit_unlocked);

  $effect(() => {
    if (mode === 'create') {
      published_at_shown = null;
      if (last_seeded !== 'new') {
        last_seeded = 'new';
      }
      return;
    }
    if (mode === 'edit' && lekha_id != null && initial) {
      if (last_seeded !== lekha_id) {
        last_seeded = lekha_id;
        published_at_shown = initial.published_at ? new Date(initial.published_at) : null;
      }
    }
  });

  function formatPublishedDate(d: Date) {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  onMount(() => {
    editor_ready = true;
  });

  let slug_locked = $derived(mode === 'edit' && !slug_edit_unlocked);

  let slug_effective = $derived(
    slug_locked
      ? lekhaUrlSlugify(initial?.url_slug ?? '')
      : slug_auto
        ? lekhaUrlSlugify(title)
        : lekhaUrlSlugify(url_slug_manual)
  );

  const debounced_for_slug = new Debounced(
    () =>
      slug_locked
        ? lekhaUrlSlugify(initial?.url_slug ?? '')
        : slug_auto
          ? lekhaUrlSlugify(title)
          : lekhaUrlSlugify(url_slug_manual),
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
    sanitizer: cartaHtmlSanitizer,
    /** Align Shiki with `renderLekhaMarkdownToHtml` / site (`LEKHA_SHIKI_*`). */
    theme: LEKHA_SHIKI_DUAL,
    shikiOptions: {
      langs: [...LEKHA_SHIKI_LANGS]
    },
    /** Use `getLekhaCartaExtensions()` for custom order (Lipi after Italic); no default icon strip. */
    disableIcons: true,
    disableShortcuts: ['strikethrough'],
    disablePrefixes: ['taskList'],
    extensions: getLekhaCartaExtensions()
  });

  const script_options = SCRIPT_LIST.map((name) => ({
    name,
    id: get_script_id(name as script_list_type)
  })).filter((o): o is { name: string; id: number } => o.id != null);

  const query_client = useQueryClient();
  const LEKHA_LIST_QUERY_KEY = [['site', 'lekha', 'list_lekhas']] as const;

  async function invalidateLekhaList() {
    await query_client.invalidateQueries({
      queryKey: LEKHA_LIST_QUERY_KEY,
      exact: false
    });
  }

  const add_mut = client_q.site.lekha.add_lekha.mutation({
    onSuccess: async ({ id }) => {
      await invalidateLekhaList();
      await goto(`/lekha/edit/${id}`);
    }
  });

  const edit_mut = client_q.site.lekha.edit_lekha.mutation({
    onSuccess: async (res, vars) => {
      await invalidateLekhaList();
      if (res.draft != null) is_draft = res.draft;
      if (res.published_at) published_at_shown = new Date(res.published_at);
      const normalized = normalizeLekhaTextFields(vars.post_data);
      title = normalized.title;
      description = normalized.description;
      tags = normalized.tags;
      content = await sanitizeAndFormatLekhaMarkdownForStorage(normalized.content);
      toast.success('Lekha updated successfully');
    }
  });

  const delete_mut = client_q.site.lekha.delete_lekha.mutation({
    onSuccess: async () => {
      await invalidateLekhaList();
      await goto('/lekha');
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
          preview_html = html;
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

  function buildPostData(draft_for_request: boolean) {
    return {
      title: title.trim(),
      description: description.trim(),
      content,
      tags,
      url_slug: urlSlugForNormalize(),
      draft: draft_for_request,
      listed,
      search_indexed
    };
  }

  function urlSlugForNormalize() {
    return slug_locked
      ? (initial?.url_slug ?? '').trim()
      : slug_auto
        ? lekhaUrlSlugify(title)
        : url_slug_manual.trim();
  }

  async function formatMarkdown() {
    if (format_busy || $add_mut.isPending || $edit_mut.isPending) return;
    form_error = null;
    format_busy = true;
    try {
      const normalized = normalizeLekhaTextFields({
        title: title.trim(),
        description: description.trim(),
        content,
        tags,
        url_slug: urlSlugForNormalize()
      });
      title = normalized.title;
      description = normalized.description;
      tags = normalized.tags;
      content = await sanitizeAndFormatLekhaMarkdownForStorage(normalized.content);
    } catch (e) {
      form_error = e instanceof Error ? e.message : String(e);
    } finally {
      format_busy = false;
    }
  }

  function validateLekhaForm(): string | null {
    if (!title.trim() || !description.trim() || !content.trim()) {
      return 'Title, description, and content are required.';
    }
    const url_slug = slug_auto ? lekhaUrlSlugify(title) : lekhaUrlSlugify(url_slug_manual);
    if (!url_slug && !slug_locked) {
      return slug_auto
        ? 'Title must include at least one letter or digit for the URL slug.'
        : 'URL slug is required; use only letters, digits, and hyphens.';
    }
    if (browser && !slug_in_sync) {
      return 'Please wait for the URL slug to finish updating before saving.';
    }
    if (browser && slug_effective) {
      const chk = get(slug_check_q);
      if (chk.isError) {
        return 'Could not verify the URL slug. Check your connection and try again.';
      }
      if (chk.isPending || chk.isFetching) {
        return 'Please wait for the URL slug to be verified before saving.';
      }
      if (chk.data?.exists) {
        return 'This URL slug is already in use. Choose a different one.';
      }
    }
    return null;
  }

  const save = (e: Event) => {
    e.preventDefault();
    form_error = null;
    const err = validateLekhaForm();
    if (err) {
      form_error = err;
      return;
    }
    const post_data = buildPostData(mode === 'create' || is_draft);
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

  function confirmPublish() {
    form_error = null;
    if (lekha_id == null) {
      form_error = 'Missing post id.';
      return;
    }
    const err = validateLekhaForm();
    if (err) {
      form_error = err;
      return;
    }
    const post_data = buildPostData(false);
    $edit_mut.mutate(
      { id: lekha_id, post_data },
      {
        onSuccess: () => {
          publish_dialog_open = false;
        }
      }
    );
  }
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

<form class="mx-auto w-full max-w-3xl space-y-4 pb-8" onsubmit={save}>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
      {#if mode === 'edit'}
        <a
          href="/lekha"
          class="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft class="size-4 shrink-0" aria-hidden="true" />
          Lekha List
        </a>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if mode === 'edit' && lekha_id != null}
        <AlertDialog.Root bind:open={delete_dialog_open}>
          <AlertDialog.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="destructive"
                class="shrink-0"
                data-testid="lekha-delete"
                disabled={$delete_mut.isPending}
              >
                Delete
              </Button>
            {/snippet}
          </AlertDialog.Trigger>
          <AlertDialog.Content class="max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Title>Delete this lekha?</AlertDialog.Title>
              <AlertDialog.Description class="text-sm text-muted-foreground">
                This will permanently remove the post, including its content and URL. This action
                <strong>cannot be undone</strong> and the post cannot be restored. Any links to this lekha
                will stop working.
              </AlertDialog.Description>
            </AlertDialog.Header>
            {#if $delete_mut.isError}
              <p class="px-6 text-sm text-destructive" role="alert">
                {String($delete_mut.error)}
              </p>
            {/if}
            <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <Button
                type="button"
                variant="destructive"
                class="shrink-0"
                disabled={$delete_mut.isPending}
                onclick={() => {
                  if (lekha_id != null) {
                    $delete_mut.mutate({ id: lekha_id });
                  }
                }}
              >
                {$delete_mut.isPending ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>
      {/if}
      {#if mode === 'create'}
        <Button type="button" variant="outline" href="/lekha">Cancel</Button>
      {/if}
      <Button
        type="submit"
        disabled={$add_mut.isPending ||
          $edit_mut.isPending ||
          $delete_mut.isPending ||
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

  {#if mode === 'edit' && lekha_id != null}
    {#if is_draft}
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 text-sm"
      >
        <span class="text-muted-foreground">This lekha is a draft.</span>
        <AlertDialog.Root bind:open={publish_dialog_open}>
          <AlertDialog.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="sm"
                variant="secondary"
                class="shrink-0"
                data-testid="lekha-publish"
                disabled={$edit_mut.isPending || $delete_mut.isPending}
              >
                Publish
              </Button>
            {/snippet}
          </AlertDialog.Trigger>
          <AlertDialog.Content class="max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Title>Publish this lekha?</AlertDialog.Title>
              <AlertDialog.Description class="text-sm text-muted-foreground">
                This will go live per your Listed and Search indexed choices. You can still edit the
                post afterwards.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <Button
                type="button"
                class="shrink-0"
                disabled={$edit_mut.isPending}
                onclick={confirmPublish}
                data-testid="lekha-publish-confirm"
              >
                {$edit_mut.isPending ? 'Publishing…' : 'Publish'}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </div>
    {:else if published_at_shown}
      <div
        class="flex items-center gap-2 border-b border-border/60 pb-3 text-sm text-muted-foreground"
      >
        <Check
          class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span>Published {formatPublishedDate(published_at_shown)}</span>
      </div>
    {/if}
  {/if}

  {#if form_error}
    <p class="text-sm text-destructive" role="alert">{form_error}</p>
  {/if}
  {#if $add_mut.isError}
    <p class="text-sm text-destructive" role="alert">{String($add_mut.error)}</p>
  {/if}
  {#if $edit_mut.isError}
    <p class="text-sm text-destructive" role="alert">{String($edit_mut.error)}</p>
  {/if}
  {#if $delete_mut.isError && !delete_dialog_open}
    <p class="text-sm text-destructive" role="alert">{String($delete_mut.error)}</p>
  {/if}

  <div class="grid gap-3 sm:grid-cols-1">
    <div class="space-y-1.5">
      <Label for="lekha-title">Title</Label>
      <Input
        id="lekha-title"
        class="font-semibold"
        bind:value={title}
        required
        autocomplete="off"
      />
    </div>
    <div class="space-y-1.5">
      <Label for="lekha-description">Description</Label>
      <Textarea
        id="lekha-description"
        bind:value={description}
        required
        rows={3}
        class="min-h-20"
      />
    </div>
    <div class="space-y-1.5">
      {#if mode === 'create' || slug_section_unlocked}
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
            <div
              class="flex w-9 shrink-0 items-center justify-center self-center"
              aria-live="polite"
            >
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
            <div
              class="flex w-9 shrink-0 items-center justify-center self-center"
              aria-live="polite"
            >
              {@render slug_status_icon()}
            </div>
          </div>
          <p class="text-xs text-muted-foreground">Lowercase, letters, digits, and hyphens only.</p>
        {/if}
      {:else}
        <AlertDialog.Root>
          <div class="flex flex-wrap items-end justify-between gap-3">
            <Label for="lekha-slug-locked" class="mb-0">URL slug</Label>
            <AlertDialog.Trigger>
              {#snippet child({ props })}
                <Button {...props} type="button" variant="outline" size="sm" class="shrink-0">
                  Change URL slug
                </Button>
              {/snippet}
            </AlertDialog.Trigger>
          </div>
          <AlertDialog.Content class="max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Title>Change URL slug?</AlertDialog.Title>
              <AlertDialog.Description class="text-sm text-muted-foreground">
                Changing the URL slug updates the post&rsquo;s public address. Old links, bookmarks,
                and search results that used the previous slug will stop working unless you set up a
                redirect elsewhere. Only continue if you intend to change how this post is reached.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                onclick={() => {
                  slug_edit_unlocked = true;
                }}
              >
                Unlock and edit
              </AlertDialog.Action>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>
        <div class="flex gap-2">
          <Input
            id="lekha-slug-locked"
            value={initial?.url_slug || '—'}
            disabled
            class="min-w-0 flex-1 font-mono text-sm"
            title="The URL slug is locked. Use “Change URL slug” to edit it (may break existing links)."
          />
          <div class="flex w-9 shrink-0 items-center justify-center self-center" aria-live="polite">
            {@render slug_status_icon()}
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          The URL slug is locked to avoid broken links. Use “Change URL slug” to edit it; you will
          be asked to confirm.
        </p>
      {/if}
    </div>
  </div>

  <LekhaTagsInput bind:tags />

  <div class="flex flex-col gap-1.5">
    <div class="flex items-center gap-1.5">
      <Checkbox
        id="cb-listed"
        bind:checked={listed}
        disabled={$add_mut.isPending || $edit_mut.isPending}
      />
      <Label for="cb-listed" class="cursor-pointer text-sm leading-none font-normal">Listed</Label>
      <Popover.Root>
        <Popover.Trigger
          class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          aria-label="What Listed means"
        >
          <Info class="size-3.5" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Content side="top" class="w-auto max-w-xs p-3 text-pretty" sideOffset={4}>
          <p class="text-sm leading-snug">
            When enabled, this post is listed and can be found in search on the main site.
          </p>
        </Popover.Content>
      </Popover.Root>
    </div>
    <div class="flex items-center gap-1.5">
      <Checkbox
        id="cb-search"
        bind:checked={search_indexed}
        disabled={$add_mut.isPending || $edit_mut.isPending}
      />
      <Label for="cb-search" class="cursor-pointer text-sm leading-none font-normal"
        >Search indexed</Label
      >
      <Popover.Root>
        <Popover.Trigger
          class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          aria-label="What Search indexed means"
        >
          <Info class="size-3.5" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Content side="top" class="w-auto max-w-xs p-3 text-pretty" sideOffset={4}>
          <p class="text-sm leading-snug">
            When enabled, this post can be included in search engine (e.g. web) indexes.
          </p>
        </Popover.Content>
      </Popover.Root>
    </div>
  </div>

  <div class="space-y-1.5">
    <Label>Content</Label>
    <Tabs.Root bind:value={editor_section} class="w-full">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Tabs.List class="grid max-w-md min-w-48 flex-1 grid-cols-2">
          <Tabs.Trigger value="write">Write</Tabs.Trigger>
          <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
        </Tabs.List>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="shrink-0 gap-1.5"
          disabled={format_busy || $add_mut.isPending || $edit_mut.isPending}
          onclick={() => void formatMarkdown()}
        >
          {#if format_busy}
            <Loader2 class="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          {:else}
            <WandSparkles class="size-3.5 shrink-0" aria-hidden="true" />
          {/if}
          {format_busy ? 'Formatting…' : 'Format markdown'}
        </Button>
      </div>
      <Tabs.Content value="write" class="mt-3 outline-none">
        {#if browser && editor_ready}
          <div
            class="lekha-carta"
            class:pointer-events-none={$add_mut.isPending || $edit_mut.isPending}
            class:opacity-60={$add_mut.isPending || $edit_mut.isPending}
            aria-busy={$add_mut.isPending || $edit_mut.isPending}
          >
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
            class="flex min-h-96 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground"
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
          class="lekha-markdown markdown-body prose max-w-none rounded-lg border bg-muted/20 p-4 text-foreground prose-neutral dark:prose-invert"
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

  :global(.lekha-carta .carta-theme__default .carta-toolbar),
  :global(.lekha-carta .carta-theme__default .carta-icons-menu) {
    color: var(--foreground);
  }

  :global(.lekha-carta .carta-theme__default .carta-input),
  :global(.lekha-carta .carta-theme__default .carta-renderer),
  :global(.lekha-carta .carta-theme__default .carta-icons-menu) {
    background: var(--background);
  }

  /*
   * Avoid `color: var(--foreground)` on `.carta-input` — it cascades onto `.carta-highlight` / Shiki
   * overlay and washes out per-token hues (preview uses raw HTML outside this subtree).
   * Keep Shiki-controlled colors on `pre`/spans only; textarea must stay transparent.
   */
  :global(.lekha-carta .carta-theme__default .carta-input textarea) {
    color: transparent !important;
  }

  :global(.lekha-carta .carta-theme__default .carta-renderer) {
    color: var(--foreground);
  }

  :global(.lekha-carta .carta-theme__default .carta-input ::placeholder) {
    color: var(--muted-foreground);
  }

  :global(.lekha-carta .carta-theme__default .carta-input),
  :global(.lekha-carta .carta-theme__default .carta-renderer) {
    min-height: 24rem;
  }

  :global(.carta-font-code) {
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
    font-size: 0.95rem;
    line-height: 1.45;
    letter-spacing: normal;
  }
</style>
