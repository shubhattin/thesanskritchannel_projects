<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import Undo2Icon from '@lucide/svelte/icons/undo-2';
  import { toast } from 'svelte-sonner';
  import { useTRPC } from '~/api/client';
  import { MultimediaIcon } from '~/components/icons';
  import { lang_list_obj } from '~/state/lang_list';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import { useSession } from '~/lib/auth-client';
  import Icon from '~/tools/Icon.svelte';
  import AddMediaLink from './AddMediaLink.svelte';
  import EditMediaLink from './EditMediaLink.svelte';
  import { type media_list_type } from './index';
  import MediaTypeIcon from './MediaTypeIcon.svelte';
  import {
    baseline_to_draft,
    clone_draft,
    compute_multimedia_diff,
    create_empty_draft_item,
    filter_by_media_tab,
    getYoutubeId,
    is_draft_dirty,
    media_tab_counts,
    move_draft_item,
    validate_draft_items,
    type DraftMediaItem,
    type MediaLinkRow,
    type MediaTab
  } from './multimedia_lib';

  const trpc = useTRPC();
  const query_client = useQueryClient();
  const session = useSession();

  const is_admin = $derived($session.data?.user.role === 'admin');

  const media_list_q = createQuery(() =>
    trpc.media.get_media_list.queryOptions({
      project_id: $project_state!.project_id,
      selected_text_levels: $selected_text_levels
    })
  );

  const media_query_key = $derived(
    trpc.media.get_media_list.queryKey({
      project_id: $project_state!.project_id,
      selected_text_levels: $selected_text_levels
    })
  );

  const save_mut = createMutation(() =>
    trpc.media.save_project_multimedia.mutationOptions({
      onSuccess: async () => {
        await query_client.invalidateQueries({ queryKey: media_query_key, exact: true });
        baseline = [];
        draft = [];
        draft_undo_stack = [];
        text_edit_session_open = false;
        mode = 'view';
        toast.success('Multimedia saved successfully');
      },
      onError: (err) => {
        mode = 'edit';
        toast.error('Failed to save multimedia', {
          description: err.message || 'Please try again.'
        });
      }
    })
  );

  let dialog_open = $state(false);
  let mode = $state<'view' | 'edit'>('view');
  let active_tab = $state<MediaTab>('all');
  let baseline = $state<MediaLinkRow[]>([]);
  let draft = $state<DraftMediaItem[]>([]);
  let draft_undo_stack = $state<DraftMediaItem[][]>([]);
  let text_edit_session_open = $state(false);
  let save_confirm_open = $state(false);
  let drag_index = $state<number | null>(null);
  let drop_index = $state<number | null>(null);

  const media_list = $derived(media_list_q.data ?? []);
  const counts = $derived(media_tab_counts(mode === 'edit' ? draft : media_list));
  const tabs_list = $derived(
    [
      { id: 'all' as const, label: 'All', count: counts.all },
      { id: 'video' as const, label: 'Videos', count: counts.video },
      { id: 'audio' as const, label: 'Audio', count: counts.audio },
      { id: 'pdf' as const, label: 'PDFs', count: counts.pdf },
      { id: 'text' as const, label: 'Links', count: counts.text }
    ].filter((tab) => tab.count > 0)
  );
  const filtered_view_items = $derived(filter_by_media_tab(media_list, active_tab));
  const dirty = $derived(is_draft_dirty(baseline, draft));
  const can_undo = $derived(draft_undo_stack.length > 0);
  const is_saving = $derived(save_mut.isPending);

  const get_lang_name = (lang_id: number | null) => {
    if (lang_id === null) return null;
    return Object.entries(lang_list_obj).find(([, id]) => id === lang_id)?.[0] ?? null;
  };

  const enter_edit_mode = () => {
    baseline = structuredClone(media_list).sort((a, b) => a.order - b.order);
    draft = baseline_to_draft(baseline);
    draft_undo_stack = [];
    text_edit_session_open = false;
    mode = 'edit';
    active_tab = 'all';
  };

  const cancel_edit = () => {
    draft = [];
    baseline = [];
    draft_undo_stack = [];
    text_edit_session_open = false;
    mode = 'view';
    drag_index = null;
    drop_index = null;
  };

  const push_draft_undo = () => {
    draft_undo_stack = [...draft_undo_stack, clone_draft(draft)];
  };

  const undo_draft = () => {
    const prev = draft_undo_stack.at(-1);
    if (!prev) return;
    draft = clone_draft(prev);
    draft_undo_stack = draft_undo_stack.slice(0, -1);
    text_edit_session_open = false;
  };

  const on_text_focus = () => {
    text_edit_session_open = false;
  };

  const on_text_blur = () => {
    text_edit_session_open = false;
  };

  const update_draft_text = (index: number, patch: Partial<DraftMediaItem>) => {
    if (!text_edit_session_open) {
      push_draft_undo();
      text_edit_session_open = true;
    }
    update_draft_item(index, patch);
  };

  const request_save = () => {
    if (!dirty) return;
    if (!validate_draft_items(draft)) {
      toast.error('Cannot save', {
        description: 'Fix invalid name or URL fields before saving.'
      });
      return;
    }
    save_confirm_open = true;
  };

  const confirm_save = () => {
    save_confirm_open = false;
    if (!validate_draft_items(draft)) {
      toast.error('Cannot save', {
        description: 'Fix invalid name or URL fields before saving.'
      });
      return;
    }
    const diff = compute_multimedia_diff(baseline, draft);
    mode = 'view';
    save_mut.mutate({
      project_id: $project_state!.project_id,
      selected_text_levels: $selected_text_levels,
      ...diff
    });
  };

  const update_draft_item = (index: number, patch: Partial<DraftMediaItem>) => {
    draft = draft.map((item, i) => (i === index ? { ...item, ...patch } : item));
  };

  const update_draft_select = (index: number, patch: Partial<DraftMediaItem>) => {
    push_draft_undo();
    update_draft_item(index, patch);
  };

  const delete_draft_item = (index: number) => {
    push_draft_undo();
    draft = draft.filter((_, i) => i !== index);
  };

  const add_draft_item = () => {
    push_draft_undo();
    draft = [...draft, create_empty_draft_item()];
  };

  const start_drag = (index: number, event: DragEvent) => {
    drag_index = index;
    const transfer = event.dataTransfer;
    if (!transfer) return;
    transfer.effectAllowed = 'move';
    transfer.setData('text/plain', String(index));
    const card = (event.currentTarget as HTMLElement).closest('[data-media-edit-card]');
    if (card instanceof HTMLElement) {
      transfer.setDragImage(card, 24, 24);
    }
  };

  const end_drag = () => {
    drag_index = null;
    drop_index = null;
  };

  const on_drag_over = (index: number, event: DragEvent) => {
    event.preventDefault();
    if (drag_index === null || drag_index === index) return;
    drop_index = index;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  };

  const on_drag_leave = (index: number, event: DragEvent) => {
    const current_target = event.currentTarget;
    if (!(current_target instanceof HTMLElement)) return;
    const related = event.relatedTarget;
    if (related instanceof Node && current_target.contains(related)) return;
    if (drop_index === index) drop_index = null;
  };

  const on_drop = (index: number, event: DragEvent) => {
    event.preventDefault();
    const from = drag_index;
    if (from !== null && from !== index) {
      push_draft_undo();
      draft = move_draft_item(draft, from, index);
    }
    end_drag();
  };

  const handle_dialog_open_change = (open: boolean) => {
    if (!open && mode === 'edit') return;
    dialog_open = open;
  };

  $effect(() => {
    if (!dialog_open && mode === 'edit') {
      cancel_edit();
    }
  });
</script>

<Dialog.Root open={dialog_open} onOpenChange={handle_dialog_open_change}>
  <Dialog.Trigger class="inline-flex outline-none select-none">
    <Button variant="ghost" class="h-auto flex-col gap-0.5 px-2 py-1 outline-none">
      <Icon src={MultimediaIcon} class="size-6 text-orange-600 dark:text-amber-200" />
      <span class="text-[10px] font-medium text-muted-foreground">Media</span>
    </Button>
  </Dialog.Trigger>
  <Dialog.Content
    showCloseButton={false}
    onInteractOutside={(event) => {
      if (mode === 'edit') event.preventDefault();
    }}
    onEscapeKeydown={(event) => {
      if (mode === 'edit') event.preventDefault();
    }}
    class="flex flex-col gap-2 overflow-hidden p-3 sm:gap-2.5 sm:p-4 {mode === 'edit'
      ? 'h-[min(92vh,52rem)] max-h-[92vh] w-[min(98vw,80rem)] max-w-7xl sm:max-w-7xl'
      : 'max-h-[min(85vh,36rem)] w-[min(92vw,44rem)] max-w-176 sm:max-w-176'}"
  >
    <Dialog.Header class="sr-only">
      <Dialog.Title>Multimedia</Dialog.Title>
    </Dialog.Header>
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-1.5">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold sm:text-base">Multimedia</h3>
        {#if media_list_q.isSuccess}
          <span
            class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
          >
            {mode === 'edit' ? draft.length : media_list.length}
          </span>
        {/if}
      </div>

      <div class="flex flex-wrap items-center gap-2">
        {#if is_saving}
          <span class="text-xs font-medium text-muted-foreground">Saving…</span>
        {/if}

        {#if is_admin}
          {#if mode === 'view'}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={is_saving}
              onclick={enter_edit_mode}
            >
              Edit
            </Button>
          {:else}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!can_undo || is_saving}
              onclick={undo_draft}
              aria-label="Undo"
            >
              <Undo2Icon class="size-4" />
              Undo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={is_saving}
              onclick={cancel_edit}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={!dirty || is_saving} onclick={request_save}>
              Save
            </Button>
          {/if}
        {/if}
      </div>
    </div>

    {#if mode === 'view' && tabs_list.length > 1}
      <div class="flex w-fit flex-wrap gap-1.5 rounded-lg bg-muted/50 p-1">
        {#each tabs_list as tab (tab.id)}
          <button
            type="button"
            onclick={() => (active_tab = tab.id)}
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all {active_tab ===
            tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-background/40 hover:text-foreground'}"
          >
            {tab.label}
            <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{tab.count}</span
            >
          </button>
        {/each}
      </div>
    {/if}

    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      {#if is_saving}
        <div class="space-y-2">
          <Skeleton class="h-20 w-full" />
          <Skeleton class="h-20 w-full" />
          <Skeleton class="h-20 w-full" />
        </div>
      {:else if media_list_q.isFetching}
        <div class="space-y-2">
          <Skeleton class="h-24 w-full" />
          <Skeleton class="h-24 w-full" />
        </div>
      {:else if media_list_q.isError}
        <p class="text-sm text-destructive">Failed to load multimedia links</p>
      {:else if mode === 'edit'}
        <div class="space-y-1" role="list">
          {#if draft.length === 0}
            <p class="text-xs text-muted-foreground">No links yet. Add one below.</p>
          {:else}
            {#each draft as item, index (item.id)}
              <EditMediaLink
                {item}
                {index}
                {drag_index}
                {drop_index}
                on_change={(patch) => update_draft_text(index, patch)}
                on_select_change={(patch) => update_draft_select(index, patch)}
                {on_text_focus}
                {on_text_blur}
                on_delete={() => delete_draft_item(index)}
                on_drag_start={start_drag}
                on_drag_end={end_drag}
                {on_drag_over}
                {on_drag_leave}
                {on_drop}
              />
            {/each}
          {/if}
          <AddMediaLink on_add={add_draft_item} />
        </div>
      {:else if filtered_view_items.length === 0}
        <p class="text-sm text-amber-600 dark:text-amber-500">No multimedia links found</p>
      {:else}
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {#each filtered_view_items as item (item.id)}
            {@const ytid = item.media_type === 'video' ? getYoutubeId(item.link) : null}
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              class="group rounded-xl border border-border bg-card p-2 shadow-sm transition-all hover:border-primary/30"
            >
              {#if ytid}
                <img
                  src="https://img.youtube.com/vi/{ytid}/hqdefault.jpg"
                  alt={item.name}
                  class="aspect-video w-full rounded-md object-cover"
                  loading="lazy"
                />
              {:else}
                <div class="flex aspect-video items-center justify-center rounded-md bg-muted/40">
                  <MediaTypeIcon media_type={item.media_type as media_list_type} />
                </div>
              {/if}
              <p class="mt-2 truncate text-xs font-medium" title={item.name}>{item.name}</p>
              {#if item.lang_id !== null}
                {@const lang_name = get_lang_name(item.lang_id)}
                {#if lang_name}
                  <span
                    class="mt-1 inline-block truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                  >
                    {lang_name}
                  </span>
                {/if}
              {/if}
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={save_confirm_open}>
  <AlertDialog.Content class="max-w-md">
    <AlertDialog.Header>
      <AlertDialog.Title>Save multimedia changes?</AlertDialog.Title>
      <AlertDialog.Description>
        This will apply your additions, edits, deletions, and reordering to this path.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={confirm_save}>Save</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
