<script lang="ts">
  import { PenLine, TriangleAlert, Plus, ArrowLeftRight, Trash2 } from '@lucide/svelte';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Popover from '$lib/components/ui/popover';
  import { Separator } from '$lib/components/ui/separator';
  import {
    can_convert_childless_to_list,
    can_convert_childless_to_shloka,
    type MapNodeWithClientId
  } from './map_edit_lib';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';

  let {
    editor_locked,
    editor_mode,
    selectedNode,
    selected_path_resolved,
    selected_is_root,
    list_count_draft = $bindable(''),
    count_input_invalid = false,
    onNameDevChange,
    onListNameChange,
    onListCountChange,
    onInputFieldFocus,
    onAddShlokaChild,
    onAddListChild,
    onConvertToList,
    onConvertToShloka
  }: {
    editor_locked: boolean;
    editor_mode: 'metadata' | 'order' | 'delete';
    selectedNode: MapNodeWithClientId | null;
    selected_path_resolved: string;
    selected_is_root: boolean;
    list_count_draft?: string;
    count_input_invalid?: boolean;
    onNameDevChange: (value: string) => void;
    onListNameChange: (value: string) => void;
    onListCountChange: (raw: string) => void;
    onInputFieldFocus: () => void;
    onAddShlokaChild: () => void;
    onAddListChild: () => void;
    onConvertToList: () => void;
    onConvertToShloka: () => void;
  } = $props();

  let add_child_popover_open = $state(false);

  const order_edit_mode = $derived(editor_mode === 'order');
  const delete_edit_mode = $derived(editor_mode === 'delete');

  const show_add_child = $derived(
    editor_mode === 'metadata' && selectedNode?.info.type === 'list' && !editor_locked
  );
  const show_convert_to_list = $derived(
    editor_mode === 'metadata' && can_convert_childless_to_list(selectedNode) && !editor_locked
  );
  const show_convert_to_shloka = $derived(
    editor_mode === 'metadata' && can_convert_childless_to_shloka(selectedNode) && !editor_locked
  );

  let typing_ctx = $derived(createTypingContext('Devanagari'));

  let typing_enabled = $state(true);
  const name_dev_input_id = 'map-edit-name-dev';
  const name_dev_switch_id = 'map-edit-name-dev-typing';

  $effect(() => {
    typing_ctx.ready;
  });

  function toggle_typing_from_keyboard(e: KeyboardEvent) {
    if (!e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key !== 'x' && key !== 'c') return false;
    e.preventDefault();
    typing_enabled = !typing_enabled;
    return true;
  }
</script>

<Card.Root class="flex min-h-[420px] flex-col overflow-hidden lg:min-h-[min(72vh,640px)]">
  <div class="border-b border-border/60 bg-muted/20 px-5 py-3">
    <div class="flex items-center gap-2">
      <PenLine class="size-4 shrink-0 text-muted-foreground" />
      <span class="text-sm font-semibold">Node editor</span>
    </div>
    <p class="mt-0.5 text-xs text-muted-foreground">
      {#if selectedNode}
        <span class="text-foreground">{selected_path_resolved}</span>
      {:else}
        Select a node in the tree
      {/if}
    </p>
  </div>
  <Card.Content class="space-y-4 pt-4">
    {#if delete_edit_mode}
      <div
        class="rounded-lg border border-destructive/35 bg-destructive/8 px-4 py-3 dark:bg-destructive/12"
      >
        <div class="flex gap-2">
          <Trash2 class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <div class="space-y-1.5 text-sm text-muted-foreground">
            <p class="font-medium text-foreground">Delete nodes mode</p>
            <p>
              Use the trash icon on tree rows to remove nodes. Deleting a parent removes its entire
              subtree. Names and structure cannot be edited here; review impact in the changes panel
              before saving.
            </p>
            {#if selectedNode}
              <p>
                Inspecting <span class="font-medium text-foreground">{selected_path_resolved}</span
                >.
              </p>
            {/if}
          </div>
        </div>
      </div>
    {:else if order_edit_mode}
      <div class="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
        <p class="text-sm text-muted-foreground">
          {#if selectedNode}
            Viewing <span class="font-medium text-foreground">{selected_path_resolved}</span>.
            Reorder in the tree; names and list labels cannot be edited in this mode.
          {:else}
            Select a node to inspect it. Reorder siblings using drag handles in the tree.
          {/if}
        </p>
      </div>
    {:else if selectedNode}
      <div class="space-y-2">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <Label
            for={name_dev_input_id}
            class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Name (Devanagari)
          </Label>
          {#if !selected_is_root}
            <div class="flex items-center gap-2">
              <Label
                for={name_dev_switch_id}
                class="cursor-pointer text-xs font-medium text-muted-foreground select-none"
              >
                Typing
              </Label>
              <Switch
                id={name_dev_switch_id}
                bind:checked={typing_enabled}
                disabled={editor_locked}
                title="Devanagari transliteration typing (Alt+X / Alt+C)"
              />
            </div>
          {/if}
        </div>

        {#if !selected_is_root}
          <p class="flex items-start gap-1.5 text-xs text-muted-foreground">
            <PenLine class="mt-0.5 size-3 shrink-0 opacity-70" />
            <span>
              Toggle with
              <kbd
                class="rounded border border-border bg-background px-1 font-mono text-[10px] shadow-sm"
                >Alt+X</kbd
              >
              or
              <kbd
                class="rounded border border-border bg-background px-1 font-mono text-[10px] shadow-sm"
                >Alt+C</kbd
              >
            </span>
          </p>
        {/if}

        <Input
          id={name_dev_input_id}
          value={selectedNode.name_dev}
          disabled={selected_is_root || editor_locked}
          oninput={(e) => onNameDevChange(e.currentTarget.value)}
          onbeforeinput={(e) =>
            handleTypingBeforeInputEvent(typing_ctx, e, onNameDevChange, typing_enabled)}
          onfocus={onInputFieldFocus}
          onblur={() => typing_ctx.clearContext()}
          onkeydown={(e) => {
            if (toggle_typing_from_keyboard(e)) return;
            clearTypingContextOnKeyDown(e, typing_ctx);
          }}
        />

        {#if selected_is_root}
          <p class="text-xs text-muted-foreground">
            Root display name (Devanagari) is not edited here.
          </p>
        {/if}
      </div>

      {#if show_add_child || show_convert_to_list || show_convert_to_shloka}
        <Separator />
        <div class="flex flex-wrap gap-2">
          {#if show_add_child}
            <Popover.Root bind:open={add_child_popover_open}>
              <Popover.Trigger class="p-0 outline-none">
                <Button type="button" variant="outline" size="sm" class="gap-1.5">
                  <Plus class="size-3.5" />
                  Add child
                </Button>
              </Popover.Trigger>
              <Popover.Content align="start" class="w-44 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start"
                  onclick={() => {
                    add_child_popover_open = false;
                    onAddShlokaChild();
                  }}
                >
                  Add Shloka
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start"
                  onclick={() => {
                    add_child_popover_open = false;
                    onAddListChild();
                  }}
                >
                  Add List
                </Button>
              </Popover.Content>
            </Popover.Root>
          {/if}
          {#if show_convert_to_list}
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="gap-1.5"
              onclick={onConvertToList}
            >
              <ArrowLeftRight class="size-3.5" />
              Convert to List
            </Button>
          {/if}
          {#if show_convert_to_shloka}
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="gap-1.5"
              onclick={onConvertToShloka}
            >
              <ArrowLeftRight class="size-3.5" />
              Convert to Shloka
            </Button>
          {/if}
        </div>
      {/if}

      {#if selectedNode.info.type === 'list'}
        <Separator />
        <div class="space-y-1.5">
          <Label
            for="list_name"
            class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            List type label
          </Label>
          <Input
            id="list_name"
            value={selectedNode.info.list_name}
            disabled={editor_locked}
            oninput={(e) => onListNameChange(e.currentTarget.value)}
            onfocus={onInputFieldFocus}
          />
          <div
            class="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100"
            role="alert"
          >
            <TriangleAlert class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              Changing this label affects public URLs on the main site. Bookmarks and shared links
              that use the current level name in the path may stop working.
            </p>
          </div>
          {#if selected_is_root}
            <p class="text-xs text-muted-foreground">
              Top-level list type label (e.g. Veda, Kanda). Editable at the project root only.
            </p>
          {/if}
        </div>
        <div class="space-y-1.5">
          <Label
            for="list_count_expected"
            class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Expected list count <span class="font-normal normal-case">(optional)</span>
          </Label>
          <Input
            id="list_count_expected"
            inputmode="numeric"
            bind:value={list_count_draft}
            disabled={editor_locked}
            oninput={(e) => onListCountChange(e.currentTarget.value)}
            onfocus={onInputFieldFocus}
            aria-invalid={count_input_invalid}
          />
          {#if count_input_invalid}
            <p class="text-xs text-destructive">Enter a whole number ≥ 0, or leave empty.</p>
          {/if}
        </div>
        <div class="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
          <p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            List metadata
          </p>
          <dl class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <dt class="text-muted-foreground">List item count</dt>
            <dd class="font-medium tabular-nums">{selectedNode.list?.length ?? 0}</dd>
            {#if selectedNode.info.list_count_expected != null}
              <dt class="text-muted-foreground">Expected</dt>
              <dd class="font-medium tabular-nums">
                {selectedNode.info.list_count_expected}
              </dd>
            {/if}
          </dl>
        </div>
      {:else}
        <Separator />
        <div class="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
          <p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Shloka metadata
          </p>
          <dl class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <dt class="text-muted-foreground">Shloka count</dt>
            <dd class="font-medium tabular-nums">{selectedNode.info.shloka_count}</dd>
            <dt class="text-muted-foreground">Total lines</dt>
            <dd class="font-medium tabular-nums">{selectedNode.info.total}</dd>
            {#if selectedNode.info.shloka_count_expected != null}
              <dt class="text-muted-foreground">Expected</dt>
              <dd class="font-medium tabular-nums">
                {selectedNode.info.shloka_count_expected}
              </dd>
            {/if}
          </dl>
          <p class="mt-2 text-xs text-muted-foreground">
            Derived fields update when texts change; not editable here.
          </p>
        </div>
      {/if}
    {:else}
      <div class="flex h-full flex-col items-center justify-center py-8 text-center">
        <div class="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/60">
          <PenLine class="size-4 text-muted-foreground" />
        </div>
        <p class="text-sm text-muted-foreground">Choose a node from the tree to edit its fields.</p>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
