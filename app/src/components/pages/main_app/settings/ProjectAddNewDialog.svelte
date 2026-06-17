<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { Debounced } from 'runed';
  import { useTRPC } from '~/api/client';
  import { invalidate_project_list_queries } from '~/state/main_app/data.svelte';
  import { lekhaUrlSlugify } from '~/lib/carta_markdown/markdown';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import { toast } from 'svelte-sonner';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Check from '@lucide/svelte/icons/check';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  const trpc = useTRPC();

  let name = $state('');
  let name_dev = $state('');
  let description = $state('');
  let slug = $state('');

  const name_dev_input_id = 'new-project-name-dev';
  const name_dev_typing_switch_id = 'new-project-name-dev-typing';
  const typing_ctx = createTypingContext('Devanagari');
  let typing_enabled = $state(true);

  function toggle_typing_from_keyboard(e: KeyboardEvent) {
    if (!e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key !== 'x' && key !== 'c') return false;
    e.preventDefault();
    typing_enabled = !typing_enabled;
    return true;
  }

  const slug_effective = $derived(lekhaUrlSlugify(slug));

  const debounced_slug = new Debounced(() => slug_effective, 500);

  let slug_check_slug = $state('');
  let slug_debounce_pending = $state(false);

  $effect(() => {
    slug_check_slug = debounced_slug.current;
    slug_debounce_pending = debounced_slug.pending;
  });

  const slug_in_sync = $derived(
    slug_effective.length > 0 && !slug_debounce_pending && slug_check_slug === slug_effective
  );

  const slug_check_q = createQuery(() =>
    trpc.project.edit.check_project_slug.queryOptions(
      { slug: slug_check_slug },
      { enabled: browser && slug_check_slug.length > 0 }
    )
  );

  const slug_available = $derived(
    slug_in_sync &&
      !slug_check_q.isPending &&
      !slug_check_q.isFetching &&
      !slug_check_q.isError &&
      slug_check_q.data?.available === true
  );

  const can_submit = $derived(
    name.trim().length > 0 &&
      name_dev.trim().length > 0 &&
      slug_effective.length > 0 &&
      slug_available
  );

  const reset_form = () => {
    name = '';
    name_dev = '';
    description = '';
    slug = '';
  };

  $effect(() => {
    if (!open) reset_form();
  });

  const add_mut = createMutation(() =>
    trpc.project.edit.add_new_project.mutationOptions({
      onSuccess: async (data) => {
        await invalidate_project_list_queries();
        open = false;
        toast.success('Project created');
        await goto(`/${data.project.key}`);
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to create project');
      }
    })
  );

  const submit = () => {
    if (!can_submit) return;
    add_mut.mutate({
      name: name.trim(),
      name_dev: name_dev.trim(),
      description: description.trim() || null,
      slug: slug_effective
    });
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[90vh] max-w-lg overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Add new project</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">
        Create a new empty project. You can configure its map structure after creation.
      </Dialog.Description>
    </Dialog.Header>

    <form
      class="mt-2 flex flex-col gap-4"
      onsubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div class="space-y-2">
        <Label for="new-project-name">Name</Label>
        <Input
          id="new-project-name"
          bind:value={name}
          placeholder="e.g. Bhagavad Gita"
          autocomplete="off"
          required
        />
      </div>

      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Label for={name_dev_input_id}>Name (देवनागरी)</Label>
          <div class="flex items-center gap-2">
            <Label
              for={name_dev_typing_switch_id}
              class="cursor-pointer text-xs font-medium text-muted-foreground select-none"
            >
              Typing
            </Label>
            <Switch
              id={name_dev_typing_switch_id}
              bind:checked={typing_enabled}
              title="Devanagari transliteration typing (Alt+X / Alt+C)"
            />
          </div>
        </div>
        <Input
          id={name_dev_input_id}
          bind:value={name_dev}
          placeholder="Name in देवनागरी, e.g. श्रीमद्भगवद्गीता"
          autocomplete="off"
          required
          class="font-sans"
          onbeforeinput={(e) =>
            handleTypingBeforeInputEvent(typing_ctx, e, (v) => (name_dev = v), typing_enabled)}
          onblur={() => typing_ctx.clearContext()}
          onkeydown={(e) => {
            if (toggle_typing_from_keyboard(e)) return;
            clearTypingContextOnKeyDown(e, typing_ctx);
          }}
        />
      </div>

      <div class="space-y-2">
        <Label for="new-project-description">Description (optional)</Label>
        <Textarea
          id="new-project-description"
          bind:value={description}
          placeholder="Short description for listings and the project card"
          rows={3}
          class="resize-y"
        />
      </div>

      <div class="space-y-2">
        <Label for="new-project-slug">URL slug</Label>
        <p class="text-xs text-muted-foreground">
          Used in the project URL (e.g. <span class="font-mono">/your-slug</span>). Choose
          carefully: this should not be changed later, as it can break bookmarks and links.
        </p>
        <div class="flex gap-2">
          <Input
            id="new-project-slug"
            bind:value={slug}
            placeholder="e.g. bhagavad-gita"
            class="min-w-0 flex-1 font-mono text-sm"
            autocomplete="off"
            required
          />
          <div class="flex w-9 shrink-0 items-center justify-center self-center" aria-live="polite">
            {#if !slug_effective}
              <span class="sr-only">Enter a slug to check availability</span>
            {:else if !slug_in_sync || slug_check_q.isPending || slug_check_q.isFetching}
              <Loader2
                class="size-5 shrink-0 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
              <span class="sr-only">Checking slug availability…</span>
            {:else if slug_check_q.isError}
              <CircleAlert class="size-5 shrink-0 text-destructive" aria-hidden="true" />
              <span class="sr-only">Could not verify slug</span>
            {:else if !slug_check_q.data?.available}
              <CircleAlert class="size-5 shrink-0 text-destructive" aria-hidden="true" />
              <span class="sr-only">This slug is already in use</span>
            {:else}
              <Check
                class="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
                strokeWidth={2.5}
              />
              <span class="sr-only">Slug is available</span>
            {/if}
          </div>
        </div>
        <p class="text-xs text-muted-foreground">Lowercase letters, digits, and hyphens only.</p>
      </div>

      <div class="flex justify-end gap-2 border-t border-border/60 pt-3">
        <Button type="button" variant="ghost" onclick={() => (open = false)}>Cancel</Button>
        <Button type="submit" disabled={!can_submit || add_mut.isPending}>
          {add_mut.isPending ? 'Creating…' : 'Create project'}
        </Button>
      </div>
    </form>
  </Dialog.Content>
</Dialog.Root>
