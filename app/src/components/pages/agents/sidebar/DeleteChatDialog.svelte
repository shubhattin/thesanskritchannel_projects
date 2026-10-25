<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import { useTRPC } from '~/api/client';

  let { chat, onclose }: { chat: { id: string; title: string } | null; onclose: () => void } =
    $props();

  const trpc = useTRPC();
  const query_client = useQueryClient();

  const delete_mut = createMutation(() =>
    trpc.agents.delete_chat.mutationOptions({
      onSuccess: (_, input) => {
        void query_client.invalidateQueries({ queryKey: trpc.agents.list_chats.queryKey() });
        if (page.params.chat_id === input.id) void goto(resolve('/agents'));
        onclose();
      },
      onError: (error) => toast.error(error.message)
    })
  );
</script>

<AlertDialog.Root open={chat !== null} onOpenChange={(open) => !open && onclose()}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete “{chat?.title || 'New chat'}”?</AlertDialog.Title>
      <AlertDialog.Description>
        The conversation and its tool calls are deleted. This cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={delete_mut.isPending}>Cancel</AlertDialog.Cancel>
      <Button
        variant="destructive"
        disabled={delete_mut.isPending}
        onclick={() => chat && delete_mut.mutate({ id: chat.id })}
      >
        Delete
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
