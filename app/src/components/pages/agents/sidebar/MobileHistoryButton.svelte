<script lang="ts">
  import PanelLeft from '@lucide/svelte/icons/panel-left';
  import { Button } from '$lib/components/ui/button';
  import * as Sheet from '$lib/components/ui/sheet';
  import ChatHistory from './ChatHistory.svelte';

  /** Opens the chat history in a drawer on small screens. */
  let open = $state(false);
</script>

<Sheet.Root bind:open>
  <Sheet.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon-sm" aria-label="Chat history" class="md:hidden">
        <PanelLeft />
      </Button>
    {/snippet}
  </Sheet.Trigger>
  <Sheet.Content side="left" class="pt-3">
    <Sheet.Title class="px-4 pb-2 text-sm font-semibold">Chats</Sheet.Title>
    <ChatHistory onnavigate={() => (open = false)} />
  </Sheet.Content>
</Sheet.Root>
