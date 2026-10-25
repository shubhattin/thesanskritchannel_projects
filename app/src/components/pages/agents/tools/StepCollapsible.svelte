<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import * as Collapsible from '$lib/components/ui/collapsible';

  let {
    open = $bindable(false),
    line,
    children
  }: { open?: boolean; line: Snippet; children: Snippet } = $props();
</script>

<Collapsible.Root bind:open>
  <Collapsible.Trigger
    class="group/step flex w-full min-w-0 items-center gap-1 rounded-md py-0.5 text-left hover:bg-muted/50"
  >
    {@render line()}
    <ChevronRight
      class="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/step:rotate-90"
    />
  </Collapsible.Trigger>
  <Collapsible.Content class="mt-1.5 mb-2 ml-6 flex flex-col gap-2">
    {@render children()}
  </Collapsible.Content>
</Collapsible.Root>
