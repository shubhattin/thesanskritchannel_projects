<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { APP_SCOPE_IDENTIFIERS } from '~/state/data_types';
  import { type AppScopeEnum } from '~/state/data_types';
  import type { Snippet } from 'svelte';
    import { client_q } from '~/api/client';

  let {
    user_id,
    scope_id,
    children
  }: {
    user_id: string;
    scope_id: AppScopeEnum;
    children: Snippet;
  } = $props();

  const scope_status_q = $derived(client_q.user.get_user_app_scope_status.query({
    user_id: user_id,
    scope_name: scope_id
  }));

  const scope_label = $derived(APP_SCOPE_IDENTIFIERS[scope_id]);
</script>

{#if $scope_status_q.isFetching}
  <Skeleton class="h-40 w-full" />
{:else if $scope_status_q.isError}
  <div class="space-y-2 text-destructive">
    <p class="text-sm">Failed to load {scope_label} scope status.</p>
    <button
      class="rounded-md bg-muted px-2 py-1 text-sm font-semibold hover:bg-muted/80"
      onclick={() => $scope_status_q.refetch()}
    >
      Retry
    </button>
  </div>
{:else if $scope_status_q.isSuccess && $scope_status_q.data}
  {@render children()}
{:else if $scope_status_q.isSuccess && !$scope_status_q.data}
  <div class="text-amber-600 dark:text-amber-500">
    Your account has not been added to the {scope_label} scope yet.
    <span class="text-xs">Contact the admin</span>
  </div>
{/if}
