<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { Segment, Tabs } from '@skeletonlabs/skeleton-svelte';
  import NonAdminInfo from './NonAdminInfo.svelte';
  import { selected_user_id, selected_user_type } from '~/components/pages/user/user_state.svelte';
  import RevokeSessions from './RevokeSessions.svelte';
  import { CURRENT_APP_SCOPE } from '~/state/data_types';
  import { fetch_get } from '~/tools/fetch';
  import { user_info } from '~/state/user.svelte';
  import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';

  const users_list = createQuery({
    queryKey: ['users_list'],
    queryFn: async () => {
      type res_type = {
        email: string;
        id: string;
        name: string;
        role: string | null;
        app_scopes: {
          scope: string;
        }[];
      }[];
      const res = await fetch_get(`${PUBLIC_BETTER_AUTH_URL}/api/user/list_users`, {
        params: {
          user_id: $user_info?.id ?? ''
        },
        credentials: 'include'
      });
      if (!res.ok) return [];
      const users = (await res.json()) as res_type;
      return users;
    }
  });

  $effect(() => {
    // on tab change reset the selected user id
    if ($selected_user_type) $selected_user_id = null;
  });

  const get_filtered_users = () => {
    const users = $users_list.data!;

    if ($selected_user_type === 'admin') {
      return users.filter((user) => user.role === 'admin');
    } else if ($selected_user_type === 'project_scope') {
      return users.filter(
        (user) =>
          user.role === 'user' && user.app_scopes.some((scope) => scope.scope === CURRENT_APP_SCOPE)
      );
    } else if ($selected_user_type === 'non_project_scope') {
      return users.filter(
        (user) =>
          user.role !== 'admin' &&
          !user.app_scopes.some((scope) => scope.scope === CURRENT_APP_SCOPE)
      );
    }
  };

  const get_string_trimmed = (str: string, limit: number = 15) => {
    if (str.length > limit) return str.substring(0, limit) + '...';
    return str;
  };
</script>

{#if !$users_list.isFetching && $users_list.isSuccess}
  <Tabs
    value={$selected_user_type}
    base="mt-6"
    onValueChange={(e) => ($selected_user_type = e.value as typeof $selected_user_type)}
  >
    {#snippet list()}
      <Tabs.Control labelClasses="rounded-md font-semibold" value="admin">Admin</Tabs.Control>
      <Tabs.Control labelClasses="rounded-md font-semibold" value="project_scope"
        >Projects Portal</Tabs.Control
      >
      <Tabs.Control labelClasses="rounded-md font-semibold text-sm" value="non_project_scope"
        >Others</Tabs.Control
      >
    {/snippet}
    {#snippet content()}
      {@const users = get_filtered_users()!}
      {@const user = users.find((user) => user.id === $selected_user_id)}
      {#key $selected_user_type}
        {#if users.length === 0}
          <div class="text-warning-600 dark:text-warning-500">No Users Found</div>
        {:else}
          <div
            class="flex flex-col items-center justify-center space-y-2.5 sm:flex-row sm:items-start sm:justify-normal sm:space-x-3"
          >
            <div>
              <Segment
                name="size"
                orientation="vertical"
                onValueChange={(e) => ($selected_user_id = e.value!)}
                gap="gap-y-1 sm:gap-y-1.5"
              >
                {#each users as user (user.id)}
                  <Segment.Item labelClasses="text-base" value={user.id}>
                    {get_string_trimmed(user.name)}
                  </Segment.Item>
                {/each}
              </Segment>
            </div>
            <div class="mt-2 ml-0 w-full sm:ml-2">
              {#if user}
                {#if $selected_user_type === 'project_scope' || $selected_user_type === 'non_project_scope'}
                  <NonAdminInfo
                    user_info={user}
                    admin_edit={true}
                    user_is_current_app_scope={user.app_scopes.some(
                      (scope) => scope.scope === CURRENT_APP_SCOPE
                    )}
                  />
                {:else if $selected_user_type === 'admin'}
                  <div class="mt-2 text-base font-semibold">{user.name}</div>
                  <a
                    class="text-xs text-slate-500 sm:text-sm dark:text-slate-400"
                    href={`emailto:${user.email}`}>{user.email}</a
                  >
                  <RevokeSessions user_id={user.id} />
                {/if}
              {/if}
            </div>
          </div>
        {/if}
      {/key}
    {/snippet}
  </Tabs>
{:else}
  <div class="placeholder h-96 animate-pulse rounded-md"></div>
{/if}
