<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import ConfirmPopover from '~/components/PopoverModals/ConfirmPopover.svelte';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlinePlus } from 'svelte-icons-pack/ai';
  import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
  import { fetch_post } from '~/tools/fetch';
  import { useQueryClient } from '@tanstack/svelte-query';
  import { selected_user_type } from '~/components/pages/user/user_state.svelte';
  import { APP_SCOPE_IDENTIFIERS, APP_SCOPE_ID_PROJECT_PORTAL } from '~/state/data_types';
  import {
    app_scope_status_query_options,
    APP_SCOPE_STATUS_QUERY_KEY,
    type AppScopeId
  } from '~/state/app_scope_queries';
  import type { Snippet } from 'svelte';

  const query_client = useQueryClient();

  let {
    user_id,
    scope_id,
    admin_edit = false,
    children
  }: {
    user_id: string;
    scope_id: AppScopeId;
    admin_edit?: boolean;
    children: Snippet;
  } = $props();

  const scope_status_q = $derived(createQuery(app_scope_status_query_options(user_id, scope_id)));

  let approve_popup_state = $state(false);

  const scope_label = $derived(APP_SCOPE_IDENTIFIERS[scope_id]);

  const add_user_app_scope = async () => {
    const res = await fetch_post(`${PUBLIC_BETTER_AUTH_URL}/api/app_scope/add_user_app_scope`, {
      json: { user_id, scope: scope_id },
      credentials: 'include'
    });
    if (!res.ok) return;
    await query_client.invalidateQueries({
      queryKey: [APP_SCOPE_STATUS_QUERY_KEY, user_id, scope_id]
    });
    await query_client.invalidateQueries({ queryKey: ['user_info', user_id] });
    await query_client.invalidateQueries({ queryKey: ['users_list'] });
    if (scope_id === APP_SCOPE_ID_PROJECT_PORTAL) {
      selected_user_type.set('users');
    }
  };
</script>

{#if $scope_status_q.isFetching}
  <Skeleton class="h-40 w-full" />
{:else if $scope_status_q.isSuccess && $scope_status_q.data}
  {@render children()}
{:else if $scope_status_q.isSuccess && !$scope_status_q.data}
  {#if !admin_edit}
    <div class="text-amber-600 dark:text-amber-500">
      Your account has not been added to the {scope_label} scope yet.
      <span class="text-xs">Contact the admin</span>
    </div>
  {:else}
    <div class="mt-2 text-amber-600 dark:text-amber-500">
      This account has not been added to {scope_label} scope.
    </div>
    <div class="space-x-2">
      <ConfirmPopover
        bind:popup_state={approve_popup_state}
        confirm_func={() => {
          approve_popup_state = false;
          add_user_app_scope();
        }}
        placement="right"
        description="Sure to Approve this User ?"
      >
        <span
          class="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2 py-1 text-sm font-bold text-primary-foreground"
        >
          <Icon src={AiOutlinePlus} class="text-xl" />
          Add to {scope_label} Scope
        </span>
      </ConfirmPopover>
    </div>
  {/if}
{:else}
  <Skeleton class="h-40 w-full" />
{/if}
