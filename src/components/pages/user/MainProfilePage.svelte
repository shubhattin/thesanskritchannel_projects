<script lang="ts">
  import { goto } from '$app/navigation';
  import { Modal, Popover } from '@skeletonlabs/skeleton-svelte';
  import { CgMenuGridO } from 'svelte-icons-pack/cg';
  import { BiLogOut, BiRename } from 'svelte-icons-pack/bi';
  import { signOut, authClient } from '~/lib/auth-client';
  import Icon from '~/tools/Icon.svelte';
  import NonAdminInfo from './NonAdminInfo.svelte';
  import AdminPanel from './AdminPanel.svelte';
  import { useQueryClient, useIsFetching } from '@tanstack/svelte-query';
  import { LuRefreshCw } from 'svelte-icons-pack/lu';
  import { cl_join } from '~/tools/cl_join';
  import UpdateName from './UpdateName.svelte';

  const query_client = useQueryClient();

  type SessionType = typeof authClient.$Infer.Session;

  let { user }: { user: SessionType['user'] } = $props();

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

<div>
  <span class="text-lg font-semibold sm:text-xl">{user.name}</span>
  <Popover
    open={dot_popover_status}
    onOpenChange={(e) => (dot_popover_status = e.open)}
    positioning={{ placement: 'bottom' }}
    arrow={false}
    contentBase="card z-50 rounded-lg px-1 py-1 shadow-xl bg-surface-100-900"
    triggerBase="ml-2 sm:ml-6"
  >
    {#snippet trigger()}
      <span
        class="rounded-full outline-hidden select-none hover:text-gray-500 dark:hover:text-gray-400"
      >
        <Icon src={CgMenuGridO} class="text-2xl" />
      </span>
    {/snippet}
    {#snippet content()}
      <div class="flex flex-col items-center justify-center space-y-1">
        <UpdateName />
        <Modal
          open={logout_modal_status}
          onOpenChange={(e) => (logout_modal_status = e.open)}
          contentBase="card z-60 space-y-2 rounded-lg px-3 py-2 shadow-xl bg-surface-100-900"
          backdropBackground="backdrop-blur-xs"
        >
          {#snippet trigger()}
            <span
              class="btn flex w-full gap-1 space-x-1 rounded-md px-1 py-0 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Icon class="text-2xl" src={BiLogOut} />
              <span class="text-sm font-semibold">Logout</span>
            </span>
          {/snippet}
          {#snippet content()}
            <div class="text-lg font-bold">Are you sure to logout ?</div>
            <div class="space-x-2">
              <button
                class="btn rounded-lg bg-surface-200 font-semibold dark:bg-surface-700"
                onclick={log_out}
              >
                Confirm
              </button>
              <button
                onclick={() => (logout_modal_status = false)}
                class="btn rounded-lg preset-outlined-surface-800-200 font-semibold"
              >
                Cancel
              </button>
            </div>
          {/snippet}
        </Modal>
      </div>
    {/snippet}
  </Popover>
  <button
    class={cl_join(
      'ml-3 btn p-0 text-sm outline-hidden select-none hover:text-gray-500 sm:ml-4 dark:hover:text-gray-400',
      is_fetching && 'animate-spin'
    )}
    onclick={refresh_data}
    disabled={is_fetching}
  >
    <Icon src={LuRefreshCw} class="text-lg" />
  </button>
</div>
<a class="text-sm text-slate-500 sm:text-base dark:text-slate-400" href={`emailto:${user.email}`}
  >{user.email}</a
>
<div class="mt-3">
  {#if user.role === 'user'}
    <NonAdminInfo user_info={user} />
  {:else if user.role === 'admin'}
    <AdminPanel />
  {/if}
</div>
