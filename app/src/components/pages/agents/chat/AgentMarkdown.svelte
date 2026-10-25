<script lang="ts">
  import { cn } from '$lib/utils';
  import { renderAgentMarkdown } from './render_markdown';

  let { text, class: className }: { text: string; class?: string } = $props();

  const html = $derived(renderAgentMarkdown(text));
</script>

<!-- Sanitized by DOMPurify in renderAgentMarkdown -->
<div
  class={cn(
    'prose prose-sm max-w-none min-w-0 leading-relaxed text-foreground prose-neutral dark:prose-invert',
    'prose-p:my-2 prose-a:text-primary prose-a:underline-offset-2 prose-pre:my-2 prose-ol:my-2 prose-ul:my-2 prose-li:my-0.5 prose-table:my-2 prose-th:px-2 prose-td:px-2',
    '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
    className
  )}
>
  {@html html}
</div>
