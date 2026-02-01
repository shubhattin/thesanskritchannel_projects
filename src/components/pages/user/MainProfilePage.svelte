<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Popover from '$lib/components/ui/popover';
  import { CgMenuGridO } from 'svelte-icons-pack/cg';
  import { BiLogOut } from 'svelte-icons-pack/bi';
  import { signOut, authClient } from '~/lib/auth-client';
  import Icon from '~/tools/Icon.svelte';
  import NonAdminInfo from './NonAdminInfo.svelte';
  import AdminPanel from './AdminPanel.svelte';
  import { useQueryClient, useIsFetching } from '@tanstack/svelte-query';
  import { LuRefreshCw } from 'svelte-icons-pack/lu';
  import { cn } from '$lib/utils';
  import UpdateName from './UpdateName.svelte';

  const query_client = useQueryClient();

  type SessionType = typeof authClient.$Infer.Session;

  let { user, is_current_app_scope }: { user: SessionType['user']; is_current_app_scope: boolean } =
    $props();

  let dot_popover_status = $state(false);
  let logout_modal_status = $state(false);

  const log_out = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          goto('/login');
        }
      }
    });
  };

  const refresh_data = async () => {
    await Promise.all([
      query_client.invalidateQueries({
        queryKey: ['user_info']
      }),
      user.role === 'admin' &&
        query_client.invalidateQueries({
          queryKey: ['users_list']
        })
    ]);
  };

  const user_info_is_fetching = useIsFetching({
    queryKey: ['user_info']
  });
  const users_list_is_fetching = useIsFetching({
    queryKey: ['users_list']
  });

  let is_fetching = $derived(
    user.role === 'admin' ? !!$users_list_is_fetching : !!$user_info_is_fetching
  );
</script>

{#if user}
  <div>
    <span class="text-lg font-semibold sm:text-xl">{user.name}</span>
    <Popover.Root bind:open={dot_popover_status}>
      <Popover.Trigger class="ml-2 sm:ml-6">
        <span class="rounded-full outline-none select-none hover:text-muted-foreground">
          <Icon src={CgMenuGridO} class="text-2xl" />
        </span>
      </Popover.Trigger>
      <Popover.Content side="bottom" class="w-auto p-1">
        <div class="flex flex-col items-center justify-center space-y-1">
          <UpdateName />
          <Dialog.Root bind:open={logout_modal_status}>
            <Dialog.Trigger>
              <span
                class="flex w-full cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-muted"
              >
                <Icon class="text-2xl" src={BiLogOut} />
                <span class="text-sm font-semibold">Logout</span>
              </span>
            </Dialog.Trigger>
            <Dialog.Content class="max-w-xs">
              <Dialog.Header>
                <Dialog.Title class="text-lg font-bold">Are you sure to logout?</Dialog.Title>
              </Dialog.Header>
              <div class="flex gap-2">
                <button
                  class="rounded-lg bg-muted px-4 py-2 font-semibold hover:bg-muted/80"
                  onclick={log_out}
                >
                  Confirm
                </button>
                <button
                  onclick={() => (logout_modal_status = false)}
                  class="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      </Popover.Content>
    </Popover.Root>
    <button
      class={cn(
        'ml-3 p-0 text-sm outline-none select-none hover:text-muted-foreground sm:ml-4',
        is_fetching && 'animate-spin'
      )}
      onclick={refresh_data}
      disabled={is_fetching}
    >
      <Icon src={LuRefreshCw} class="text-lg" />
    </button>
  </div>
  <a class="text-sm text-muted-foreground sm:text-base" href={`mailto:${user.email}`}
    >{user.email}</a
  >
  <div class="mt-3">
    {#if user?.role === 'user'}
      <NonAdminInfo user_info={user} user_is_current_app_scope={is_current_app_scope} />
    {:else if user?.role === 'admin'}
      <AdminPanel />
    {/if}
  </div>
{/if}
