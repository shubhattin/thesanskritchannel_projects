<script lang="ts">
  import { Carta, MarkdownEditor } from 'carta-md';
  import 'carta-md/default.css';
  import '@cartamd/plugin-code/default.css';
  import '$lib/carta_markdown/code/shiki-theme.css';
  import '$lib/carta_markdown/video/video-container.css';
  import { browser } from '$app/environment';
  import { beforeNavigate, goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { useTRPC } from '~/api/client';
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
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import Icon from '~/tools/Icon.svelte';
  import { BsThreeDots, BsTrash } from 'svelte-icons-pack/bs';
  import { LanguageIcon } from '~/components/icons';
  import { build_main_site_lekha_href } from '~/utils/main_site_url';
  import ExternalLink from '@lucide/svelte/icons/external-link';

  let {
    lekha_id,
    initial
  }: {
    lekha_id: number;
    initial: Omit<SiteLekha, 'id'>;
  } = $props();
  const trpc = useTRPC();

  /** Content editor LipiLekhika context (separate from title/description). */
  const content_typing_ctx = createTypingContext('Devanagari');
  let content_typing_enabled = $state(false);

  /** Shared on/off for title + description; each field keeps its own typing context. */
  const title_typing_ctx = createTypingContext('Devanagari');
  const description_typing_ctx = createTypingContext('Devanagari');
  let meta_typing_enabled = $state(false);

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
  let auto_transliterate_title = $state(true);
  let auto_transliterate_description = $state(true);
  let auto_transliterate_content = $state(true);

  let preview_script_id = $state(get_script_id('Devanagari') ?? 1);
  let editor_section = $state<'write' | 'preview'>('write');
  let preview_html = $state('');
  let preview_loading = $state(false);
  let preview_error = $state<string | null>(null);
  let form_error = $state<string | null>(null);
  let editor_ready = $state(false);
  /** Draft state for the standalone slug-edit dialog. */
  let slug_dialog_open = $state(false);
  let slug_dialog_draft = $state('');
  /** Keep the previous slug as a redirect when the slug changes (default true). */
  let redirect_old_url = $state(true);
  let open_redirect_menu_id = $state<number | null>(null);
  let delete_dialog_open = $state(false);
  let publish_dialog_open = $state(false);
  let save_dialog_open = $state(false);
  /** Remark-format pipeline matching DB storage (manual format / post-save sync). */
  let format_busy = $state(false);
  /** Last session synced from `initial` (lekha id); avoids re-sync on referential re-renders. */
  let last_seeded = $state<number | null>(null);
  /** Snapshot of last saved / seeded form values for dirty detection. */
  let saved_snapshot = $state<{
    title: string;
    description: string;
    content: string;
    tags_key: string;
    listed: boolean;
    url_slug: string;
    auto_transliterate_title: boolean;
    auto_transliterate_description: boolean;
    auto_transliterate_content: boolean;
  } | null>(null);
  let leave_confirmed = false;

  function tagsKey(list: string[]) {
    return JSON.stringify(list);
  }

  function toggleMetaTypingFromKeyboard(e: KeyboardEvent) {
    if (!(e.altKey && (e.key === 'x' || e.key === 'X'))) return false;
    e.preventDefault();
    meta_typing_enabled = !meta_typing_enabled;
    return true;
  }

  function toggleContentTypingFromKeyboard(e: KeyboardEvent) {
    if (!(e.altKey && (e.key === 'x' || e.key === 'X'))) return false;
    e.preventDefault();
    content_typing_enabled = !content_typing_enabled;
    return true;
  }

  function formatPublishedDate(d: Date) {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Last saved slug this session (the `initial` prop is server-loaded and goes stale after a slug change). */
  let saved_url_slug = $state<string | null>(null);
  let canonical_slug = $derived(saved_url_slug ?? lekhaUrlSlugify(initial?.url_slug ?? ''));
  let slug_effective = $derived(canonical_slug);

  let published_main_site_href = $derived(
    !is_draft && slug_effective ? build_main_site_lekha_href(slug_effective) : null
  );

  function captureSavedSnapshot() {
    saved_snapshot = {
      title,
      description,
      content,
      tags_key: tagsKey(tags),
      listed,
      url_slug: slug_effective,
      auto_transliterate_title,
      auto_transliterate_description,
      auto_transliterate_content
    };
  }

  let is_dirty = $derived.by(() => {
    const snap = saved_snapshot;
    if (!snap) return false;
    return (
      title !== snap.title ||
      description !== snap.description ||
      content !== snap.content ||
      tagsKey(tags) !== snap.tags_key ||
      listed !== snap.listed ||
      slug_effective !== snap.url_slug ||
      auto_transliterate_title !== snap.auto_transliterate_title ||
      auto_transliterate_description !== snap.auto_transliterate_description ||
      auto_transliterate_content !== snap.auto_transliterate_content
    );
  });

  $effect(() => {
    if (lekha_id != null && initial) {
      if (last_seeded !== lekha_id) {
        last_seeded = lekha_id;
        published_at_shown = initial.published_at ? new Date(initial.published_at) : null;
        listed = initial.listed;
        auto_transliterate_title = initial.auto_transliterate_title;
        auto_transliterate_description = initial.auto_transliterate_description;
        auto_transliterate_content = initial.auto_transliterate_content;
        saved_url_slug = null;
        redirect_old_url = true;
        queueMicrotask(() => captureSavedSnapshot());
      }
    }
  });

  onMount(() => {
    editor_ready = true;
    // Tab close / refresh guard only in production — local HMR reloads would be noisy in DEV.
    if (!browser || import.meta.env.DEV) return;
    const on_beforeunload = (e: BeforeUnloadEvent) => {
      if (!is_dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', on_beforeunload);
    return () => window.removeEventListener('beforeunload', on_beforeunload);
  });

  beforeNavigate(({ cancel }) => {
    if (import.meta.env.DEV || !is_dirty || leave_confirmed) return;
    const ok = confirm('You have unsaved lekha edits. Leave and discard them?');
    if (!ok) {
      cancel();
      return;
    }
    leave_confirmed = true;
    queueMicrotask(() => {
      leave_confirmed = false;
    });
  });

  const debounced_for_slug = new Debounced(() => slug_effective, 500);

  let slug_check_inputs = $state<{
    url_slug: string;
    exclude_id: number | undefined;
  }>({ url_slug: '', exclude_id: undefined });

  let debounced_val = $state('');
  let debounced_pend = $state(false);

  $effect(() => {
    const debounced_slug = debounced_for_slug.current;
    const debounced_slug_pending = debounced_for_slug.pending;
    const exclude_id_for_edit = lekha_id;
    debounced_val = debounced_slug;
    debounced_pend = debounced_slug_pending;
    slug_check_inputs = { url_slug: debounced_slug, exclude_id: exclude_id_for_edit };
  });

  let slug_in_sync = $derived(
    slug_effective.length > 0 && !debounced_pend && debounced_val === slug_effective
  );

  const slug_check_q = createQuery(() =>
    trpc.site.lekha.check_url_slug.queryOptions({
      url_slug: slug_check_inputs.url_slug,
      exclude_id: slug_check_inputs.exclude_id
    })
  );

  /** Pure: validation message from the current URL-slug availability check, if it blocks saving. */
  const slug_check_error = (chk: typeof slug_check_q): string | null => {
    if (chk.isError) {
      return 'Could not verify the URL slug. Check your connection and try again.';
    }
    if (chk.isPending || chk.isFetching) {
      return 'Please wait for the URL slug to be verified before saving.';
    }
    if (chk.data?.exists) {
      return 'This URL slug is already in use. Choose a different one.';
    }
    return null;
  };

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
    id: get_script_id(
      // SAFETY: SCRIPT_LIST is Object.keys(script_list), so every entry is a valid script_list_type key.
      name as script_list_type
    )
  })).filter((o): o is { name: string; id: number } => o.id != null);

  const query_client = useQueryClient();
  const LEKHA_LIST_QUERY_KEY = [['site', 'lekha', 'list_lekhas']] as const;

  async function invalidateLekhaList() {
    await query_client.invalidateQueries({
      queryKey: LEKHA_LIST_QUERY_KEY,
      exact: false
    });
  }

  const edit_mut = createMutation(() =>
    trpc.site.lekha.edit_lekha.mutationOptions({
      onSuccess: async (res, vars) => {
        await invalidateLekhaList();
        if (res.draft != null) is_draft = res.draft;
        if (res.published_at) published_at_shown = new Date(res.published_at);
        const normalized = normalizeLekhaTextFields(vars.post_data);
        title = normalized.title;
        description = normalized.description;
        tags = normalized.tags;
        content = await sanitizeAndFormatLekhaMarkdownForStorage(normalized.content);
        listed = vars.post_data.listed;
        saved_url_slug = normalized.url_slug;
        await redirects_q.refetch();
        captureSavedSnapshot();
        save_dialog_open = false;
        toast.success('Lekha updated successfully');
      }
    })
  );

  const delete_mut = createMutation(() =>
    trpc.site.lekha.delete_lekha.mutationOptions({
      onSuccess: async () => {
        leave_confirmed = true;
        await invalidateLekhaList();
        await goto('/lekha');
      }
    })
  );

  const redirects_q = createQuery(() => ({
    ...trpc.site.lekha.list_lekha_redirects.queryOptions({ lekha_id }),
    staleTime: 0,
    refetchOnMount: 'always'
  }));

  const delete_redirect_mut = createMutation(() =>
    trpc.site.lekha.delete_lekha_redirect.mutationOptions({
      onSuccess: async () => {
        open_redirect_menu_id = null;
        await redirects_q.refetch();
        toast.success('Redirect rule deleted');
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete redirect rule');
      }
    })
  );

  const slug_dialog_debounced = new Debounced(() => lekhaUrlSlugify(slug_dialog_draft), 500);

  let slug_dialog_checked = $state('');
  let slug_dialog_pending = $state(false);

  $effect(() => {
    slug_dialog_checked = slug_dialog_debounced.current;
    slug_dialog_pending = slug_dialog_debounced.pending;
  });

  const slug_dialog_effective = $derived(lekhaUrlSlugify(slug_dialog_draft));
  const slug_dialog_in_sync = $derived(
    slug_dialog_effective.length > 0 &&
      !slug_dialog_pending &&
      slug_dialog_checked === slug_dialog_effective
  );

  const slug_dialog_check_q = createQuery(() => ({
    ...trpc.site.lekha.check_url_slug.queryOptions({
      url_slug: slug_dialog_checked,
      exclude_id: lekha_id
    }),
    enabled: browser && slug_dialog_open && slug_dialog_checked.length > 0
  }));

  const slug_dialog_changed = $derived(
    slug_dialog_effective.length > 0 && slug_dialog_effective !== canonical_slug
  );

  const slug_dialog_replaces = $derived(
    slug_dialog_changed &&
      slug_dialog_in_sync &&
      !slug_dialog_check_q.isPending &&
      !slug_dialog_check_q.isFetching &&
      slug_dialog_check_q.data?.replaces_redirect === true
  );

  /** Blocker message for the slug dialog confirm, if the new slug cannot be saved yet. */
  const slug_dialog_blocker = $derived.by((): string | null => {
    if (!slug_dialog_effective) {
      return 'Enter a valid slug (letters, digits, and hyphens).';
    }
    if (!slug_dialog_in_sync || slug_dialog_check_q.isPending || slug_dialog_check_q.isFetching) {
      return 'Please wait for the URL slug to be verified.';
    }
    if (slug_dialog_check_q.isError) {
      return 'Could not verify the URL slug. Check your connection and try again.';
    }
    if (slug_dialog_check_q.data?.exists) {
      return 'This URL slug is already in use. Choose a different one.';
    }
    return null;
  });

  function openSlugDialog() {
    slug_dialog_draft = canonical_slug;
    redirect_old_url = true;
    slug_dialog_open = true;
  }

  function confirmSlugDialog() {
    if (edit_mut.isPending) return;
    if (!slug_dialog_changed) {
      slug_dialog_open = false;
      return;
    }
    if (slug_dialog_blocker) return;
    const post_data = { ...buildPostData(is_draft), url_slug: slug_dialog_effective };
    edit_mut.mutate(
      { id: lekha_id, post_data, redirect_old_url },
      {
        onSuccess: () => {
          slug_dialog_open = false;
        }
      }
    );
  }

  $effect(() => {
    if (!browser || editor_section !== 'preview') return;
    const md = content;
    const transliterate_content = auto_transliterate_content;
    preview_loading = true;
    preview_error = null;
    let cancelled = false;
    (async () => {
      try {
        const html = await renderLekhaMarkdownToHtml(md, {
          script: get_script_from_id(preview_script_id),
          autoTransliterateContent: transliterate_content
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
      auto_transliterate_title,
      auto_transliterate_description,
      auto_transliterate_content
    };
  }

  function urlSlugForNormalize() {
    return canonical_slug;
  }

  async function formatMarkdown() {
    if (format_busy || edit_mut.isPending) return;
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
    if (!title.trim() || !content.trim()) {
      return 'Title and content are required.';
    }
    if (!canonical_slug) {
      return 'URL slug is missing. Edit the slug to set a valid one.';
    }
    if (browser && !slug_in_sync) {
      return 'Please wait for the URL slug to finish updating before saving.';
    }
    if (browser && slug_effective) {
      const slug_error = slug_check_error(slug_check_q);
      if (slug_error) return slug_error;
    }
    return null;
  }

  function requestSave(e?: Event) {
    e?.preventDefault();
    form_error = null;
    const err = validateLekhaForm();
    if (err) {
      form_error = err;
      return;
    }
    save_dialog_open = true;
  }

  function onSaveDialogOpenChange(next: boolean) {
    // Keep the dialog open while the save request is in flight.
    // if (!next && edit_mut.isPending) return;
    save_dialog_open = next;
  }

  function confirmSave() {
    form_error = null;
    if (edit_mut.isPending) return;
    const err = validateLekhaForm();
    if (err) {
      form_error = err;
      save_dialog_open = false;
      return;
    }
    const post_data = buildPostData(is_draft);
    edit_mut.mutate({ id: lekha_id, post_data, redirect_old_url });
  }

  function confirmPublish() {
    form_error = null;
    if (edit_mut.isPending) return;
    const err = validateLekhaForm();
    if (err) {
      form_error = err;
      return;
    }
    const post_data = buildPostData(false);
    edit_mut.mutate(
      { id: lekha_id, post_data, redirect_old_url },
      {
        onSuccess: () => {
          publish_dialog_open = false;
        }
      }
    );
  }

  function onPublishDialogOpenChange(next: boolean) {
    if (!next && edit_mut.isPending) return;
    publish_dialog_open = next;
  }
</script>

{#snippet slug_status_icon()}
  {#if !slug_effective}
    <span class="sr-only">Enter a title or slug to check availability</span>
  {:else if !slug_in_sync || slug_check_q.isPending || slug_check_q.isFetching}
    <Loader2 class="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
    <span class="sr-only">Checking whether this URL slug is available…</span>
  {:else if slug_check_q.isError}
    <CircleAlert class="size-5 shrink-0 text-destructive" aria-hidden="true" />
    <span class="sr-only">Could not verify URL slug</span>
  {:else if slug_check_q.data?.exists}
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

<form class="mx-auto w-full max-w-3xl space-y-4 pb-8" onsubmit={requestSave}>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
      <a
        href="/lekha"
        class="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft class="size-4 shrink-0" aria-hidden="true" />
        Lekha List
      </a>
    </div>
    <div class="flex items-center gap-2">
      <AlertDialog.Root bind:open={delete_dialog_open}>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              variant="destructive"
              class="shrink-0"
              data-testid="lekha-delete"
              disabled={delete_mut.isPending}
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
          {#if delete_mut.isError}
            <p class="px-6 text-sm text-destructive" role="alert">
              {String(delete_mut.error)}
            </p>
          {/if}
          <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <Button
              type="button"
              variant="destructive"
              class="shrink-0"
              disabled={delete_mut.isPending}
              onclick={() => {
                delete_mut.mutate({ id: lekha_id });
              }}
            >
              {delete_mut.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
      <AlertDialog.Root open={save_dialog_open} onOpenChange={onSaveDialogOpenChange}>
        <Button
          type="submit"
          disabled={edit_mut.isPending ||
            delete_mut.isPending ||
            (browser &&
              !!slug_effective &&
              (!slug_in_sync ||
                slug_check_q.isError ||
                slug_check_q.isPending ||
                slug_check_q.isFetching ||
                slug_check_q.data?.exists !== false))}
          data-testid="lekha-save"
        >
          {edit_mut.isPending ? 'Saving…' : 'Save'}
        </Button>
        <AlertDialog.Content
          class="max-w-md"
          interactOutsideBehavior="ignore"
          escapeKeydownBehavior={edit_mut.isPending ? 'ignore' : 'close'}
        >
          <AlertDialog.Header>
            <AlertDialog.Title>Save changes?</AlertDialog.Title>
            <AlertDialog.Description class="text-sm text-muted-foreground">
              This will update the lekha with your current edits
              {is_draft ? ' (still a draft)' : ' on the live post'}.
            </AlertDialog.Description>
          </AlertDialog.Header>
          {#if edit_mut.isError}
            <p class="px-6 text-sm text-destructive" role="alert">{String(edit_mut.error)}</p>
          {/if}
          <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
            <AlertDialog.Cancel disabled={edit_mut.isPending}>Cancel</AlertDialog.Cancel>
            <Button
              type="button"
              class="shrink-0"
              disabled={edit_mut.isPending}
              onclick={confirmSave}
              data-testid="lekha-save-confirm"
            >
              {edit_mut.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  </div>

  {#if is_draft}
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 text-sm"
    >
      <span class="text-muted-foreground">This lekha is a draft.</span>
      <AlertDialog.Root open={publish_dialog_open} onOpenChange={onPublishDialogOpenChange}>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              size="sm"
              variant="secondary"
              class="shrink-0"
              data-testid="lekha-publish"
              disabled={edit_mut.isPending || delete_mut.isPending}
            >
              Publish
            </Button>
          {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content
          class="max-w-md"
          interactOutsideBehavior="ignore"
          escapeKeydownBehavior={edit_mut.isPending ? 'ignore' : 'close'}
        >
          <AlertDialog.Header>
            <AlertDialog.Title>Publish this lekha?</AlertDialog.Title>
            <AlertDialog.Description class="text-sm text-muted-foreground">
              This will go live per your Listed choice. You can still edit the post afterwards.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <Button
              type="button"
              class="shrink-0"
              disabled={edit_mut.isPending}
              onclick={confirmPublish}
              data-testid="lekha-publish-confirm"
            >
              {edit_mut.isPending ? 'Publishing…' : 'Publish'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  {:else if published_at_shown}
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 text-sm text-muted-foreground"
    >
      <div class="flex min-w-0 items-center gap-2">
        <Check
          class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span>Published {formatPublishedDate(published_at_shown)}</span>
      </div>
      {#if published_main_site_href}
        <a
          href={published_main_site_href}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          data-testid="lekha-main-site-link"
        >
          <ExternalLink class="size-3.5 shrink-0" aria-hidden="true" />
          View on main site
          <span class="sr-only">(opens in a new tab)</span>
        </a>
      {/if}
    </div>
  {/if}

  {#if form_error}
    <p class="text-sm text-destructive" role="alert">{form_error}</p>
  {/if}
  {#if edit_mut.isError && !save_dialog_open && !publish_dialog_open}
    <p class="text-sm text-destructive" role="alert">{String(edit_mut.error)}</p>
  {/if}
  {#if delete_mut.isError && !delete_dialog_open}
    <p class="text-sm text-destructive" role="alert">{String(delete_mut.error)}</p>
  {/if}

  <div class="grid gap-3 sm:grid-cols-1">
    <div class="space-y-1.5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Label for="lekha-title">Title</Label>
        <div class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <div class="flex items-center gap-2">
            <Label
              for="lekha-auto-transliterate-title"
              class="cursor-pointer text-xs font-normal text-muted-foreground select-none"
            >
              Auto transliterate
            </Label>
            <Switch
              id="lekha-auto-transliterate-title"
              bind:checked={auto_transliterate_title}
              disabled={edit_mut.isPending}
            />
            {@render auto_transliterate_info(
              'What title auto transliterate does',
              'Transliterates the whole title from Devanagari into the reader’s script.'
            )}
          </div>
          <div class="flex items-center gap-2">
            <Icon src={LanguageIcon} outerClass="shrink-0 text-muted-foreground" class="size-4" />
            <Label
              for="lekha-meta-typing-enabled"
              class="cursor-pointer text-xs font-normal text-muted-foreground select-none"
              >Typing</Label
            >
            <Switch
              id="lekha-meta-typing-enabled"
              bind:checked={meta_typing_enabled}
              disabled={edit_mut.isPending}
              title="Devanagari transliteration for title and description (Alt+X)"
            />
          </div>
        </div>
      </div>
      <Input
        id="lekha-title"
        class="font-semibold"
        bind:value={title}
        required
        autocomplete="off"
        onbeforeinput={(e) =>
          handleTypingBeforeInputEvent(
            title_typing_ctx,
            e,
            (v) => (title = v),
            meta_typing_enabled
          )}
        onblur={() => title_typing_ctx.clearContext()}
        onkeydown={(e) => {
          if (toggleMetaTypingFromKeyboard(e)) return;
          clearTypingContextOnKeyDown(e, title_typing_ctx);
        }}
      />
      <p class="text-xs text-muted-foreground">
        Shared with description — toggle with
        <kbd class="rounded border border-border bg-background px-1 font-mono text-[10px] shadow-sm"
          >Alt+X</kbd
        >
      </p>
    </div>
    <div class="space-y-1.5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Label for="lekha-description">
          Description
          <span class="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <div class="flex items-center gap-2">
          <Label
            for="lekha-auto-transliterate-description"
            class="cursor-pointer text-xs font-normal text-muted-foreground select-none"
          >
            Auto transliterate
          </Label>
          <Switch
            id="lekha-auto-transliterate-description"
            bind:checked={auto_transliterate_description}
            disabled={edit_mut.isPending}
          />
          {@render auto_transliterate_info(
            'What description auto transliterate does',
            'Transliterates the whole description from Devanagari into the reader’s script.'
          )}
        </div>
      </div>
      <Textarea
        id="lekha-description"
        bind:value={description}
        rows={3}
        class="min-h-20"
        onbeforeinput={(e) =>
          handleTypingBeforeInputEvent(
            description_typing_ctx,
            e,
            (v) => (description = v),
            meta_typing_enabled
          )}
        onblur={() => description_typing_ctx.clearContext()}
        onkeydown={(e) => {
          if (toggleMetaTypingFromKeyboard(e)) return;
          clearTypingContextOnKeyDown(e, description_typing_ctx);
        }}
      />
    </div>
    <div class="space-y-1.5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <Label for="lekha-slug-locked" class="mb-0">URL slug</Label>
        <Button type="button" variant="outline" size="sm" class="shrink-0" onclick={openSlugDialog}>
          Edit
        </Button>
      </div>
      <div class="flex gap-2">
        <Input
          id="lekha-slug-locked"
          value={canonical_slug || '—'}
          disabled
          class="min-w-0 flex-1 font-mono text-sm"
          title="Use Edit to change the slug."
        />
        <div class="flex w-9 shrink-0 items-center justify-center self-center" aria-live="polite">
          {@render slug_status_icon()}
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        Existing links keep working — changing the slug keeps the old one redirecting.
      </p>

      <AlertDialog.Root bind:open={slug_dialog_open}>
        <AlertDialog.Content class="max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Title>Edit URL slug</AlertDialog.Title>
            <AlertDialog.Description class="text-sm text-muted-foreground">
              Changing the slug updates the post&rsquo;s public address.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <div class="space-y-2 px-6 pb-2">
            <div class="flex gap-2">
              <Input
                id="lekha-slug-dialog"
                bind:value={slug_dialog_draft}
                class="min-w-0 flex-1 font-mono text-sm"
                placeholder="my-post-slug"
                autocomplete="off"
              />
              <div
                class="flex w-9 shrink-0 items-center justify-center self-center"
                aria-live="polite"
              >
                {#if !slug_dialog_effective}
                  <span class="sr-only">Enter a slug to check availability</span>
                {:else if !slug_dialog_in_sync || slug_dialog_check_q.isPending || slug_dialog_check_q.isFetching}
                  <Loader2
                    class="size-5 shrink-0 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span class="sr-only">Checking whether this URL slug is available…</span>
                {:else if slug_dialog_check_q.isError}
                  <CircleAlert class="size-5 shrink-0 text-destructive" aria-hidden="true" />
                  <span class="sr-only">Could not verify URL slug</span>
                {:else if slug_dialog_check_q.data?.exists}
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
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              Lowercase, letters, digits, and hyphens only.
            </p>
            {#if slug_dialog_changed}
              <p class="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {#if redirect_old_url}
                  The old slug <span class="font-mono">/lekha/{canonical_slug}</span> will redirect
                  to <span class="font-mono">/lekha/{slug_dialog_effective}</span>.
                {:else}
                  The old slug <span class="font-mono">/lekha/{canonical_slug}</span> will stop working.
                {/if}
              </p>
              <label class="flex items-start gap-2 text-sm">
                <Checkbox bind:checked={redirect_old_url} class="mt-0.5" />
                <span>Redirect old URL to the new slug</span>
              </label>
            {/if}
            {#if slug_dialog_replaces}
              <p class="text-xs text-amber-700 dark:text-amber-300" role="status">
                This slug is used by an existing redirect rule, which will be replaced.
              </p>
            {/if}
            {#if edit_mut.isError && slug_dialog_open}
              <p class="text-sm text-destructive" role="alert">{String(edit_mut.error)}</p>
            {/if}
          </div>
          <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
            <AlertDialog.Cancel disabled={edit_mut.isPending}>Cancel</AlertDialog.Cancel>
            <Button
              type="button"
              class="shrink-0"
              disabled={edit_mut.isPending || !slug_dialog_changed || !!slug_dialog_blocker}
              onclick={confirmSlugDialog}
            >
              {edit_mut.isPending ? 'Saving…' : 'Save slug'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  </div>

  {#if (redirects_q.data?.length ?? 0) > 0}
    <div class="flex flex-col gap-3 border-t border-border/60 pt-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold">Redirect rules</h3>
        <p class="text-xs text-muted-foreground">
          Old URL slugs that redirect to this lekha&rsquo;s current slug.
        </p>
      </div>

      <ul class="flex flex-col gap-1.5">
        {#each redirects_q.data ?? [] as rule (rule.id)}
          <li
            class="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
          >
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="truncate font-mono text-sm">/lekha/{rule.url_slug}</span>
              <span class="text-xs text-muted-foreground">
                → /lekha/{canonical_slug}
              </span>
            </div>
            <Popover.Root
              open={open_redirect_menu_id === rule.id}
              onOpenChange={(open) => {
                open_redirect_menu_id = open ? rule.id : null;
              }}
            >
              <Popover.Trigger
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
                aria-label="Redirect actions"
              >
                <Icon src={BsThreeDots} class="text-base" />
              </Popover.Trigger>
              <Popover.Content class="w-36 p-1" align="end" sideOffset={6}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-8 w-full justify-start gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={delete_redirect_mut.isPending}
                  onclick={() => {
                    delete_redirect_mut.mutate({
                      lekha_id,
                      redirect_id: rule.id
                    });
                  }}
                >
                  <Icon src={BsTrash} class="text-sm" />
                  {delete_redirect_mut.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </Popover.Content>
            </Popover.Root>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <LekhaTagsInput bind:tags />

  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-1.5">
      <Checkbox id="cb-listed" bind:checked={listed} disabled={edit_mut.isPending} />
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
    <div class="flex items-center gap-2">
      <Label
        for="lekha-auto-transliterate-content"
        class="cursor-pointer text-sm leading-none font-normal"
      >
        Auto transliterate content
      </Label>
      <Switch
        id="lekha-auto-transliterate-content"
        bind:checked={auto_transliterate_content}
        disabled={edit_mut.isPending}
      />
      {@render auto_transliterate_info(
        'What content auto transliterate does',
        'Transliterates the whole post from Devanagari. When off, only text inside <lipi> tags is transliterated.'
      )}
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
        <div class="flex flex-wrap items-center justify-end gap-3">
          <div class="flex items-center gap-2">
            <Icon src={LanguageIcon} outerClass="shrink-0 text-muted-foreground" class="size-4" />
            <Label
              for="lekha-typing-enabled"
              class="cursor-pointer text-xs font-normal text-muted-foreground select-none"
              >Typing</Label
            >
            <Switch
              id="lekha-typing-enabled"
              bind:checked={content_typing_enabled}
              disabled={edit_mut.isPending}
              title="Transliteration typing for content (Alt+X)"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="shrink-0 gap-1.5"
            disabled={format_busy || edit_mut.isPending}
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
      </div>
      <Tabs.Content value="write" class="mt-3 outline-none">
        {#if browser && editor_ready}
          <div
            class="lekha-carta"
            class:pointer-events-none={edit_mut.isPending}
            class:opacity-60={edit_mut.isPending}
            aria-busy={edit_mut.isPending}
          >
            <MarkdownEditor
              {carta}
              bind:value={content}
              mode="tabs"
              scroll="async"
              placeholder="Write markdown…"
              selectedTab="write"
              textarea={{
                onbeforeinput: (e: Event) =>
                  handleTypingBeforeInputEvent(
                    content_typing_ctx,
                    e,
                    (v) => (content = v),
                    content_typing_enabled
                  ),
                onblur: () => content_typing_ctx.clearContext(),
                onkeydown: (e: KeyboardEvent) => {
                  if (toggleContentTypingFromKeyboard(e)) return;
                  clearTypingContextOnKeyDown(e, content_typing_ctx);
                }
              }}
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

{#snippet auto_transliterate_info(label: string, text: string)}
  <Popover.Root>
    <Popover.Trigger
      class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      type="button"
      aria-label={label}
    >
      <Info class="size-3.5" aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Content side="top" class="w-auto max-w-xs p-3 text-pretty" sideOffset={4}>
      <p class="text-sm leading-snug">{text}</p>
    </Popover.Content>
  </Popover.Root>
{/snippet}

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
