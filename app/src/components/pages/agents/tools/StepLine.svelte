<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    icon,
    title,
    description,
    status
  }: {
    icon: Snippet;
    title: string;
    description?: string;
    status?: 'running' | 'error';
  } = $props();
</script>

<span class="flex min-w-0 items-center gap-2 text-xs">
  <span
    class={cn(
      'flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-3.5',
      status === 'running' && 'animate-pulse text-primary',
      status === 'error' && 'text-destructive'
    )}
  >
    {@render icon()}
  </span>
  <span
    class={cn(
      'shrink-0 font-medium text-foreground',
      status === 'running' && 'animate-pulse',
      status === 'error' && 'text-destructive'
    )}
  >
    {title}
  </span>
  {#if description}
    <span class="min-w-0 truncate text-muted-foreground">{description}</span>
  {/if}
</span>
