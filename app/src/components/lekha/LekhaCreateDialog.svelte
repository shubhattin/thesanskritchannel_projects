<script lang="ts">
  import { goto } from '$app/navigation';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { useTRPC } from '~/api/client';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Switch } from '$lib/components/ui/switch';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Popover from '$lib/components/ui/popover';
  import Info from '@lucide/svelte/icons/info';
  import { lekhaUrlSlugify } from '~/lib/carta_markdown/markdown';
  import Plus from '@lucide/svelte/icons/plus';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import Icon from '~/tools/Icon.svelte';
  import { LanguageIcon } from '~/components/icons';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const trpc = useTRPC();
  const query_client = useQueryClient();

  let title = $state('');
  let description = $state('');
  let form_error = $state<string | null>(null);
  let meta_typing_enabled = $state(false);
  let auto_transliterate_title = $state(true);
  let auto_transliterate_description = $state(true);

  const title_typing_ctx = createTypingContext('Devanagari');
  const description_typing_ctx = createTypingContext('Devanagari');

  const add_mut = createMutation(() =>
    trpc.site.lekha.add_lekha.mutationOptions({
      onSuccess: async ({ id }) => {
        await query_client.invalidateQueries({
          queryKey: [['site', 'lekha', 'list_lekhas']],
          exact: false
        });
        open = false;
        resetForm();
        await goto(`/lekha/edit/${id}`);
      }
    })
  );

  function resetForm() {
    title = '';
    description = '';
    form_error = null;
    meta_typing_enabled = false;
    auto_transliterate_title = true;
    auto_transliterate_description = true;
    title_typing_ctx.clearContext();
    description_typing_ctx.clearContext();
  }

  function onOpenChange(next: boolean) {
    open = next;
    if (!next) {
      resetForm();
      add_mut.reset();
    }
  }

  function toggleMetaTypingFromKeyboard(e: KeyboardEvent) {
    if (!(e.altKey && (e.key === 'x' || e.key === 'X' || e.key === 'c' || e.key === 'C'))) {
      return false;
    }
    e.preventDefault();
    meta_typing_enabled = !meta_typing_enabled;
    return true;
  }

  function submit(e: Event) {
    e.preventDefault();
    form_error = null;
    const trimmed_title = title.trim();
    if (!trimmed_title) {
      form_error = 'Title is required.';
      return;
    }
    const url_slug = lekhaUrlSlugify(trimmed_title);
    if (!url_slug) {
      form_error = 'Title must include at least one letter or digit for the URL slug.';
      return;
    }
    add_mut.mutate({
      post_data: {
        title: trimmed_title,
        description: description.trim(),
        content: '',
        tags: [],
        url_slug,
        listed: true,
        auto_transliterate_title,
        auto_transliterate_description,
        auto_transliterate_content: true
      }
    });
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <Button {...props} class="shrink-0 gap-2">
        <Plus class="size-4" aria-hidden="true" />
        New post
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content class="max-w-md sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>New lekha</Dialog.Title>
      <Dialog.Description>
        Start with a title (and optional description). You’ll edit the full post next.
      </Dialog.Description>
    </Dialog.Header>
    <form class="flex flex-col gap-4" onsubmit={submit}>
      <div class="flex items-center justify-end gap-2">
        <Icon src={LanguageIcon} outerClass="shrink-0 text-muted-foreground" class="size-4" />
        <Label
          for="lekha-create-typing"
          class="cursor-pointer text-xs font-normal text-muted-foreground select-none"
        >
          Typing
        </Label>
        <Switch
          id="lekha-create-typing"
          bind:checked={meta_typing_enabled}
          disabled={add_mut.isPending}
          title="Devanagari transliteration for title and description (Alt+X)"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Label for="lekha-create-title">Title</Label>
          <div class="flex items-center gap-2">
            <Label
              for="lekha-create-auto-transliterate-title"
              class="cursor-pointer text-xs font-normal text-muted-foreground select-none"
            >
              Auto transliterate
            </Label>
            <Switch
              id="lekha-create-auto-transliterate-title"
              bind:checked={auto_transliterate_title}
              disabled={add_mut.isPending}
            />
            {@render auto_transliterate_info(
              'What title auto transliterate does',
              'Transliterates the whole title from Devanagari into the reader’s script.'
            )}
          </div>
        </div>
        <Input
          id="lekha-create-title"
          bind:value={title}
          required
          autocomplete="off"
          disabled={add_mut.isPending}
          placeholder="Post title"
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
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Label for="lekha-create-description">
            Description
            <span class="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div class="flex items-center gap-2">
            <Label
              for="lekha-create-auto-transliterate-description"
              class="cursor-pointer text-xs font-normal text-muted-foreground select-none"
            >
              Auto transliterate
            </Label>
            <Switch
              id="lekha-create-auto-transliterate-description"
              bind:checked={auto_transliterate_description}
              disabled={add_mut.isPending}
            />
            {@render auto_transliterate_info(
              'What description auto transliterate does',
              'Transliterates the whole description from Devanagari into the reader’s script.'
            )}
          </div>
        </div>
        <Textarea
          id="lekha-create-description"
          bind:value={description}
          rows={3}
          class="min-h-20"
          disabled={add_mut.isPending}
          placeholder="Short summary"
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
      {#if form_error}
        <p class="text-sm text-destructive" role="alert">{form_error}</p>
      {/if}
      {#if add_mut.isError}
        <p class="text-sm text-destructive" role="alert">{String(add_mut.error)}</p>
      {/if}
      <Dialog.Footer class="gap-2 sm:justify-end">
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} type="button" variant="outline" disabled={add_mut.isPending}>
              Cancel
            </Button>
          {/snippet}
        </Dialog.Close>
        <Button type="submit" disabled={add_mut.isPending || !title.trim()}>
          {add_mut.isPending ? 'Creating…' : 'Create & edit'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

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
