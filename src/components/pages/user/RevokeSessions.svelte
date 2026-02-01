<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { authClient, useSession } from '~/lib/auth-client';
  import { Button } from '$lib/components/ui/button';
  import { Skeleton } from '$lib/components/ui/skeleton';

  const query_client = useQueryClient();

  const session = useSession();
  let user_info = $derived($session.data?.user);

  let { user_id }: { user_id: string } = $props();

  const userSessions_q = $derived(
    createQuery({
      queryKey: ['user_sessions', user_id],
      queryFn: async () => {
        const { data } = await authClient.admin.listUserSessions({
          userId: user_id
        });
        return data?.sessions;
      },
      enabled: user_info?.is_maintainer ?? false
    })
  );

  const revoke_user_session_mut = createMutation({
    mutationFn: async () => {
      await authClient.admin.revokeUserSessions({
        userId: user_id
      });
    },
    onSuccess: () => {
      query_client.invalidateQueries({
        queryKey: ['user_sessions', user_id]
      });
    }
  });

  const revoke_user_sessions_func = async () => {
    await $revoke_user_session_mut.mutateAsync();
  };
</script>

{#if user_info?.is_maintainer}
  <div class="mt-8">
    <div class="text-warning-500 dark:text-warning-400 mb-1.5 text-base font-semibold">
      User Sessions
    </div>
    {#if !$userSessions_q.isFetching && $userSessions_q.isSuccess}
      {@const sessions = $userSessions_q.data}
      {#if sessions && sessions.length > 0}
        <div>
          User has {sessions.length} sessions
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={$revoke_user_session_mut.isPending}
          ondblclick={revoke_user_sessions_func}
          class="mt-1"
        >
          Revoke All Sessions
        </Button>
      {:else}
        <div>User has no sessions</div>
      {/if}
    {:else}
      <Skeleton class="h-6 w-40 bg-muted" />
    {/if}
  </div>
{/if}
