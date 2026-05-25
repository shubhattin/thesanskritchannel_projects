<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import ConfirmPopover from '~/components/PopoverModals/ConfirmPopover.svelte';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlinePlus } from 'svelte-icons-pack/ai';
  import {
    APP_SCOPE_IDENTIFIERS,
    APP_SCOPE_ID_LEKHA,
    APP_SCOPE_ID_PROJECT_PORTAL,
    type AppScopeEnum
  } from '~/state/data_types';
  import { client_q } from '~/api/client';
  import { toast } from 'svelte-sonner';
  import ProjectsPortalProfile from './ProjectsPortalProfile.svelte';
  import LekhaProfilePanel from './LekhaProfilePanel.svelte';

  const query_client = useQueryClient();

  let {
    user_info,
    scope_id = APP_SCOPE_ID_PROJECT_PORTAL
  }: {
    user_info: {
      id: string;
      name: string;
      email: string;
      role?: string | null;
    };
    scope_id?: AppScopeEnum;
  } = $props();

  const scope_status_q = $derived(
    client_q.user.get_user_app_scope_status.query({
      user_id: user_info.id,
      scope_name: scope_id
    })
  );

  let approve_popup_state = $state(false);

  const scope_label = $derived(APP_SCOPE_IDENTIFIERS[scope_id]);
  
  const add_user_app_scope_mut = client_q.user.add_user_to_app_scope.mutation({
    onSuccess() {
       client_q.user.get_user_app_scope_status.utils.invalidate({
        user_id: user_info.id,
        scope_name: scope_id
       });
      query_client.invalidateQueries({ queryKey: ['user_info', user_info.id] });
      query_client.invalidateQueries({ queryKey: ['users_list'] });
    },
    onError(error) {
      console.error('add_user_app_scope failed:', error);
      toast.error(`Could not add user to ${scope_label} scope`);
    }
  });

  const add_user_app_scope = async () => {
    await $add_user_app_scope_mut.mutateAsync({
      user_id: user_info.id,
      scope: scope_id
    });
  };

  const remove_user_from_app_scope_mut = client_q.user.remove_user_from_app_scope.mutation({
    onSuccess() {
      // query_client.invalidateQueries({
      //   queryKey: [APP_SCOPE_STATUS_QUERY_KEY, user_info.id, scope_id]
      // });
      client_q.user.get_user_app_scope_status.utils.invalidate({
        user_id: user_info.id,
        scope_name: scope_id
      });
      query_client.invalidateQueries({ queryKey: ['user_info', user_info.id] });
      query_client.invalidateQueries({ queryKey: ['users_list'] });
    }
  });

  const remove_user_from_app_scope = async () => {
    await $remove_user_from_app_scope_mut.mutateAsync({
      user_id: user_info.id,
      scope: scope_id
    });
  };
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
{:else if $scope_status_q.isSuccess && !$scope_status_q.data}
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
{:else if $scope_status_q.isSuccess}
  {#if scope_id === APP_SCOPE_ID_PROJECT_PORTAL}
    <ProjectsPortalProfile {user_info} admin_edit={true} />
  {:else if scope_id === APP_SCOPE_ID_LEKHA}
    <LekhaProfilePanel {scope_id} />
    <div class="mt-6">
      <ConfirmModal
        title={`Remove User from ${scope_label} Scope`}
        body_text={() => `Are you sure you want to reset user permissions to ${scope_label}?`}
        confirm_func={remove_user_from_app_scope}
        popup_state={false}
      >
        <button
          disabled={$remove_user_from_app_scope_mut.isPending}
          class="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground"
        >
          Remove User from {scope_label} Scope
        </button>
      </ConfirmModal>
    </div>
  {/if}
{/if}
