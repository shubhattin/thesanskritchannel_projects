<script lang="ts">
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { client } from '~/api/client';
  import {
    DEFAULT_IMAGE_SYSTEM_PROMPT,
    DEFAULT_IMAGE_SYSTEM_PROMPT_TITLE
  } from '~/api/routes/ai/image_prompt_defaults';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Tabs from '$lib/components/ui/tabs';
  import Markdown from 'svelte-markdown';
  import MarkdownTextarea from './MarkdownTextarea.svelte';
  import Plus from '@lucide/svelte/icons/plus';
  import Copy from '@lucide/svelte/icons/copy';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Lock from '@lucide/svelte/icons/lock';
  import { toast } from 'svelte-sonner';
  import { copy_text_to_clipboard } from '~/tools/kry';
  import { queryClient } from '~/state/queryClient';

  const TEMPLATES_QUERY_KEY = ['image_system_prompt_templates'];

  const templates_q = createQuery(() => ({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: () => client.ai.system_prompts.list.query(),
    staleTime: 30_000
  }));

  let search = $state('');
  let add_open = $state(false);
  let new_title = $state('');
  let editing_id = $state<number | null>(null);
  let edit_title = $state('');
  let edit_content = $state('');
  let delete_id = $state<number | null>(null);
  /** Accordion open values; everything collapsed by default. */
  let open_items = $state<string[]>([]);
  let highlighted_key = $state<string | null>(null);

  const item_key = (id: number) => `template-${id}`;

  const apply_hash = () => {
    const hash = window.location.hash;
    let key: string | null = null;
    if (hash === '#template-default') key = 'default';
    else {
      const match = hash.match(/^#template-(\d+)$/);
      if (match) key = item_key(parseInt(match[1], 10));
    }
    highlighted_key = key;
    if (key && !open_items.includes(key)) open_items = [...open_items, key];
    if (key) {
      const el = document.getElementById(key === 'default' ? 'template-default' : key);
      el?.scrollIntoView({ block: 'center' });
    }
  };

  // Open/scroll once the list has loaded (items render only after the query resolves).
  $effect(() => {
    if (templates_q.isSuccess) apply_hash();
  });
  $effect(() => {
    window.addEventListener('hashchange', apply_hash);
    return () => window.removeEventListener('hashchange', apply_hash);
  });

  const filtered = $derived(() => {
    const q = search.trim().toLowerCase();
    const rows = templates_q.data ?? [];
    if (!q) return rows;
    return rows.filter((t) => t.title.toLowerCase().includes(q));
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });

  const create_mut = createMutation(() => ({
    mutationFn: (title: string) => client.ai.system_prompts.create.mutate({ title }),
    onSuccess: async (row) => {
      toast.success(`Template “${row.title}” created`);
      new_title = '';
      add_open = false;
      search = '';
      await invalidate();
      highlighted_key = item_key(row.id);
      open_items = [item_key(row.id)];
    },
    onError: (e) => toast.error(e.message || 'Failed to create template')
  }));

  const update_mut = createMutation(() => ({
    mutationFn: (args: { id: number; title?: string; content?: string }) =>
      client.ai.system_prompts.update.mutate(args),
    onSuccess: async () => {
      toast.success('Template saved');
      editing_id = null;
      await invalidate();
    },
    onError: (e) => toast.error(e.message || 'Failed to save template')
  }));

  const delete_mut = createMutation(() => ({
    mutationFn: (id: number) => client.ai.system_prompts.delete.mutate({ id }),
    onSuccess: async () => {
      toast.success('Template deleted');
      delete_id = null;
      await invalidate();
    },
    onError: (e) => toast.error(e.message || 'Failed to delete template')
  }));

  const start_edit = (id: number, title: string, content: string) => {
    editing_id = id;
    edit_title = title;
    edit_content = content;
  };

  const char_hint = (content: string) =>
    content.trim() ? `${content.trim().length} chars` : 'empty';
</script>

<div class="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-xl font-bold">System Prompts</h1>
      <p class="text-sm text-muted-foreground">
        Image-prompt templates. The built-in default is static in code; templates here are
        selectable in the image tool (single + batch).
      </p>
    </div>
    <Button size="sm" onclick={() => (add_open = true)}>
      <Plus class="size-4" />
      New template
    </Button>
  </div>

  <Input placeholder="Search templates…" bind:value={search} class="max-w-sm" />

  {#if templates_q.isPending}
    <p class="py-8 text-center text-sm text-muted-foreground">Loading templates…</p>
  {:else if templates_q.isError}
    <p class="py-8 text-center text-sm text-destructive">
      Failed to load templates. {templates_q.error.message}
    </p>
  {:else}
    <Accordion.Root type="multiple" bind:value={open_items} class="flex flex-col gap-2.5">
      <div id="template-default">
        <Accordion.Item
          value="default"
          class="rounded-xl border border-border px-4 {highlighted_key === 'default'
            ? 'ring-2 ring-primary'
            : ''}"
        >
          <Accordion.Trigger class="py-3.5 hover:no-underline">
            <span
              class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 pr-2 text-left"
            >
              <span class="truncate text-sm font-semibold">{DEFAULT_IMAGE_SYSTEM_PROMPT_TITLE}</span
              >
              <Badge variant="secondary" class="gap-1">
                <Lock class="size-3" />
                Built-in
              </Badge>
              <span class="text-xs font-normal text-muted-foreground">
                {char_hint(DEFAULT_IMAGE_SYSTEM_PROMPT)}
              </span>
            </span>
          </Accordion.Trigger>
          <Accordion.Content>
            <div class="flex flex-col gap-2.5 pb-4">
              <div class="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => copy_text_to_clipboard(DEFAULT_IMAGE_SYSTEM_PROMPT)}
                >
                  <Copy class="size-3.5" />
                  Copy
                </Button>
              </div>
              <div
                class="md-preview prose prose-sm max-w-none max-h-80 overflow-y-auto rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed prose-neutral dark:prose-invert"
              >
                <Markdown source={DEFAULT_IMAGE_SYSTEM_PROMPT} />
              </div>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </div>

      {#if filtered().length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">
          {search ? `No templates match “${search}”.` : 'No templates yet — create one.'}
        </p>
      {/if}

      {#each filtered() as template (template.id)}
        <div id={item_key(template.id)}>
          <Accordion.Item
            value={item_key(template.id)}
            class="rounded-xl border border-border px-4 {highlighted_key === item_key(template.id)
              ? 'ring-2 ring-primary'
              : ''}"
          >
            <Accordion.Trigger class="py-3.5 hover:no-underline">
              <span
                class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 pr-2 text-left"
              >
                <span class="truncate text-sm font-semibold">{template.title}</span>
                <span class="text-xs font-normal text-muted-foreground">id {template.id}</span>
                {#if template.content.trim()}
                  <span class="text-xs font-normal text-muted-foreground">
                    {char_hint(template.content)}
                  </span>
                {:else}
                  <Badge variant="outline">Empty</Badge>
                {/if}
              </span>
            </Accordion.Trigger>
            <Accordion.Content>
              {#if editing_id === template.id}
                <div class="flex flex-col gap-3 pb-4">
                  <Input bind:value={edit_title} placeholder="Title" maxlength={200} />
                  <Tabs.Root value="edit">
                    <Tabs.List>
                      <Tabs.Trigger value="edit">Edit</Tabs.Trigger>
                      <Tabs.Trigger value="view">Preview</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="edit">
                      <MarkdownTextarea
                        bind:value={edit_content}
                        rows={12}
                        spellcheck={false}
                        placeholder="System prompt markdown…"
                      />
                    </Tabs.Content>
                    <Tabs.Content value="view">
                      <div
                        class="md-preview prose prose-sm max-w-none max-h-80 overflow-y-auto rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed prose-neutral dark:prose-invert"
                      >
                        {#if edit_content.trim()}
                          <Markdown source={edit_content} />
                        {:else}
                          <p class="text-muted-foreground">Nothing to preview.</p>
                        {/if}
                      </div>
                    </Tabs.Content>
                  </Tabs.Root>
                  <div class="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onclick={() => (editing_id = null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={update_mut.isPending || !edit_title.trim()}
                      onclick={() =>
                        update_mut.mutate({
                          id: template.id,
                          title: edit_title,
                          content: edit_content
                        })}
                    >
                      {update_mut.isPending ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              {:else}
                <div class="flex flex-col gap-2.5 pb-4">
                  <div class="flex shrink-0 items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => copy_text_to_clipboard(template.content)}
                    >
                      <Copy class="size-3.5" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => start_edit(template.id, template.title, template.content)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="text-destructive hover:text-destructive"
                      title="Delete template"
                      onclick={() => (delete_id = template.id)}
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                  <div
                    class="md-preview prose prose-sm max-w-none max-h-80 overflow-y-auto rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed prose-neutral dark:prose-invert"
                  >
                    {#if template.content.trim()}
                      <Markdown source={template.content} />
                    {:else}
                      <p class="text-muted-foreground">
                        Empty template — click Edit to write the prompt.
                      </p>
                    {/if}
                  </div>
                </div>
              {/if}
            </Accordion.Content>
          </Accordion.Item>
        </div>
      {/each}
    </Accordion.Root>
  {/if}
</div>

<Dialog.Root bind:open={add_open}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>New system prompt template</Dialog.Title>
      <Dialog.Description>Created empty — edit it after creation.</Dialog.Description>
    </Dialog.Header>
    <Input bind:value={new_title} placeholder="Template title…" maxlength={200} />
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (add_open = false)}>Cancel</Button>
      <Button
        disabled={!new_title.trim() || create_mut.isPending}
        onclick={() => create_mut.mutate(new_title.trim())}
      >
        {create_mut.isPending ? 'Creating…' : 'Create'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
  open={delete_id != null}
  onOpenChange={(open) => {
    if (!open) delete_id = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete this template?</AlertDialog.Title>
      <AlertDialog.Description>
        Past batch rows keep their stored snapshot, but new generations can no longer select it.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={delete_mut.isPending}
        onclick={() => delete_id != null && delete_mut.mutate(delete_id)}
      >
        {delete_mut.isPending ? 'Deleting…' : 'Delete'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
