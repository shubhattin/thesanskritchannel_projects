<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Label } from '$lib/components/ui/label';
  import AdminUserScopePanel from './AdminUserScopePanel.svelte';
  import { selected_user_id, selected_user_type } from '~/components/pages/user/user_state.svelte';
  import RevokeSessions from './RevokeSessions.svelte';
  import { APP_SCOPE_IDENTIFIERS, APP_SCOPE_ID_PROJECT_PORTAL } from '~/state/data_types';
  import type { AppScopeId } from '~/state/app_scope_queries';
  import { fetch_get } from '~/tools/fetch';
  import { user_info } from '~/state/user.svelte';
  import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
  import { Skeleton } from '$lib/components/ui/skeleton';

  const scope_ids = Object.keys(APP_SCOPE_IDENTIFIERS) as AppScopeId[];

  let active_scope_tab = $state<AppScopeId>(APP_SCOPE_ID_PROJECT_PORTAL);

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
    if ($selected_user_type) $selected_user_id = null;
  });

  $effect(() => {
    if ($selected_user_id) active_scope_tab = APP_SCOPE_ID_PROJECT_PORTAL;
  });

  const get_filtered_users = () => {
    const users = $users_list.data!;

    if ($selected_user_type === 'admin') {
      return users.filter((user) => user.role === 'admin');
    }
    return users.filter((user) => user.role !== 'admin');
  };

  const get_string_trimmed = (str: string, limit: number = 15) => {
    if (str.length > limit) return str.substring(0, limit) + '...';
    return str;
  };
</script>

{#if !$users_list.isFetching && $users_list.isSuccess}
  <Tabs.Root bind:value={$selected_user_type} class="mt-6">
    <Tabs.List>
      <Tabs.Trigger value="admin" class="rounded-md font-semibold">Admin</Tabs.Trigger>
      <Tabs.Trigger value="users" class="rounded-md font-semibold">Users</Tabs.Trigger>
    </Tabs.List>
    {#each ['admin', 'users'] as tabValue (tabValue)}
      <Tabs.Content value={tabValue}>
        {@const users = get_filtered_users() ?? []}
        {@const user = users.find((user) => user.id === $selected_user_id)}
        {#key $selected_user_type}
          {#if users.length === 0}
            <div class="text-amber-600 dark:text-amber-500">No Users Found</div>
          {:else}
            <div
              class="flex flex-col items-center justify-center gap-2.5 sm:flex-row sm:items-start sm:justify-normal sm:gap-3"
            >
              <div>
                <RadioGroup.Root
                  value={$selected_user_id ?? ''}
                  onValueChange={(value) => ($selected_user_id = value ?? null)}
                  class="flex flex-col gap-1 sm:gap-1.5"
                >
                  {#each users as user (user.id)}
                    <div class="flex items-center gap-2">
                      <RadioGroup.Item value={user.id} id={user.id} />
                      <Label for={user.id} class="cursor-pointer text-base">
                        {get_string_trimmed(user.name)}
                      </Label>
                    </div>
                  {/each}
                </RadioGroup.Root>
              </div>
              <div class="mt-2 ml-0 w-full sm:ml-2">
                {#if user}
                  {#if $selected_user_type === 'users'}
                    <Tabs.Root bind:value={active_scope_tab}>
                      <Tabs.List>
                        {#each scope_ids as scope_id (scope_id)}
                          <Tabs.Trigger value={scope_id} class="rounded-md font-semibold">
                            {APP_SCOPE_IDENTIFIERS[scope_id]}
                          </Tabs.Trigger>
                        {/each}
                      </Tabs.List>
                      {#each scope_ids as scope_id (scope_id)}
                        <Tabs.Content value={scope_id}>
                          <AdminUserScopePanel user_info={user} {scope_id} />
                        </Tabs.Content>
                      {/each}
                    </Tabs.Root>
                  {:else if $selected_user_type === 'admin'}
                    <div class="mt-2 text-base font-semibold">{user.name}</div>
                    <a
                      class="text-xs text-muted-foreground sm:text-sm"
                      href={`mailto:${user.email}`}>{user.email}</a
                    >
                    <RevokeSessions user_id={user.id} />
                  {/if}
                {/if}
              </div>
            </div>
          {/if}
        {/key}
      </Tabs.Content>
    {/each}
  </Tabs.Root>
{:else}
  <Skeleton class="h-96" />
{/if}
