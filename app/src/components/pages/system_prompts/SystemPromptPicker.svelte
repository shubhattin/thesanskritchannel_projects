<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { client } from '~/api/client';
  import { DEFAULT_IMAGE_SYSTEM_PROMPT_TITLE } from '~/api/routes/ai/get_image_prompt';
  import { Button } from '$lib/components/ui/button';
  import * as Select from '$lib/components/ui/select';
  import * as Popover from '$lib/components/ui/popover';
  import Markdown from 'svelte-markdown';
  import Eye from '@lucide/svelte/icons/eye';
  import Pencil from '@lucide/svelte/icons/pencil';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';

  type Props = {
    /** null = built-in default; number = template id */
    selected_template_id?: number | null;
    compact?: boolean;
  };

  let { selected_template_id = $bindable(null), compact = false }: Props = $props();

  const templates_q = createQuery(() => ({
    queryKey: ['image_system_prompt_templates'],
    queryFn: () => client.ai.system_prompts.list.query(),
    staleTime: 30_000
  }));

  const templates = $derived(templates_q.data ?? []);
  const selected_template = $derived(
    selected_template_id != null
      ? (templates.find((t) => t.id === selected_template_id) ?? null)
      : null
  );
  const selected_value = $derived(
    selected_template_id != null ? String(selected_template_id) : '__default__'
  );

  const preview_content = $derived(selected_template ? selected_template.content : null);
  const preview_title = $derived(
    selected_template ? selected_template.title : DEFAULT_IMAGE_SYSTEM_PROMPT_TITLE
  );
</script>

<div class="flex flex-wrap items-center gap-2">
  <span class="text-xs font-semibold text-muted-foreground">System prompt</span>
  <Select.Root
    type="single"
    value={selected_value}
    onValueChange={(v) => {
      selected_template_id = v === '__default__' ? null : parseInt(v);
    }}
  >
    <Select.Trigger
      class={compact ? 'w-48 text-xs' : 'w-56 text-xs'}
      title="Image system prompt template"
    >
      {selected_template ? selected_template.title : DEFAULT_IMAGE_SYSTEM_PROMPT_TITLE}
    </Select.Trigger>
    <Select.Content>
      <Select.Item value="__default__" label={DEFAULT_IMAGE_SYSTEM_PROMPT_TITLE} />
      {#each templates as template (template.id)}
        <Select.Item value={String(template.id)} label={template.title} />
      {/each}
    </Select.Content>
  </Select.Root>

  <Popover.Root>
    <Popover.Trigger
      type="button"
      class="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      aria-label="View selected system prompt"
    >
      <Eye class="size-3.5" />
      View
    </Popover.Trigger>
    <Popover.Content class="w-96 max-w-[min(24rem,90vw)] space-y-2 p-3" align="start">
      <p class="text-xs font-semibold">{preview_title}</p>
      <div
        class="max-h-[50vh] overflow-y-auto rounded-md border bg-muted/20 p-3 text-sm leading-relaxed"
      >
        {#if selected_template_id == null}
          <p class="text-xs text-muted-foreground">
            Built-in default (static in code). Pick a template to customize, or
            <a href="/system-prompts" target="_blank" rel="noopener noreferrer" class="underline"
              >manage templates</a
            >.
          </p>
        {:else if preview_content?.trim()}
          <Markdown source={preview_content} />
        {:else}
          <p class="text-xs text-muted-foreground">
            This template is empty — edit it on the System Prompts page.
          </p>
        {/if}
      </div>
      {#if selected_template_id != null}
        <a
          href="/system-prompts#template-{selected_template_id}"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Pencil class="size-3" />
          Edit template
        </a>
      {:else}
        <a
          href="/system-prompts"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Pencil class="size-3" />
          Manage templates
        </a>
      {/if}
    </Popover.Content>
  </Popover.Root>

  <Button
    variant="ghost"
    size="icon"
    class="size-7"
    title="Refresh template list"
    aria-label="Refresh template list"
    disabled={templates_q.isFetching}
    onclick={() => templates_q.refetch()}
  >
    <RefreshCw class={['size-3.5', templates_q.isFetching && 'animate-spin']} />
  </Button>
</div>
