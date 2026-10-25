<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { useTRPC } from '~/api/client';

  let { chat, onclose }: { chat: { id: string; title: string }; onclose: () => void } = $props();

  const trpc = useTRPC();
  const query_client = useQueryClient();
  // svelte-ignore state_referenced_locally
  let title = $state(chat.title);

  const rename_mut = createMutation(() =>
    trpc.agents.rename_chat.mutationOptions({
      onSuccess: (_, input) => {
        void query_client.invalidateQueries({ queryKey: trpc.agents.list_chats.queryKey() });
        void query_client.invalidateQueries({
          queryKey: trpc.agents.get_chat.queryKey({ id: input.id })
        });
        onclose();
      },
      onError: (error) => toast.error(error.message)
    })
  );
</script>

<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
  <Dialog.Content>
    <form
      class="flex flex-col gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        if (title.trim()) rename_mut.mutate({ id: chat.id, title: title.trim() });
      }}
    >
      <Dialog.Header>
        <Dialog.Title>Rename chat</Dialog.Title>
      </Dialog.Header>
      <Input bind:value={title} maxlength={120} aria-label="Chat title" />
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={onclose}>Cancel</Button>
        <Button type="submit" disabled={!title.trim() || rename_mut.isPending}>Save</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
