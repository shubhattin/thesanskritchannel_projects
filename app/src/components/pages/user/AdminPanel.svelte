<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { Label } from '$lib/components/ui/label';
  import NonAdminInfo from './NonAdminInfo.svelte';
  import { selected_user_id, selected_user_type } from '~/components/pages/user/user_state.svelte';
  import RevokeSessions from './RevokeSessions.svelte';
  import { CURRENT_APP_SCOPE } from '~/state/data_types';
  import { fetch_get } from '~/tools/fetch';
  import { user_info } from '~/state/user.svelte';
  import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
  import { Skeleton } from '$lib/components/ui/skeleton';

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
  <Tabs.Root bind:value={$selected_user_type} class="mt-6">
    <Tabs.List>
      <Tabs.Trigger value="admin" class="rounded-md font-semibold">Admin</Tabs.Trigger>
      <Tabs.Trigger value="project_scope" class="rounded-md font-semibold"
        >Projects Portal</Tabs.Trigger
      >
      <Tabs.Trigger value="non_project_scope" class="rounded-md text-sm font-semibold"
        >Others</Tabs.Trigger
      >
    </Tabs.List>
    {#each ['admin', 'project_scope', 'non_project_scope'] as tabValue (tabValue)}
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
