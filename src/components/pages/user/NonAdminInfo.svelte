<script lang="ts">
  import { client, client_q } from '~/api/client';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import ConfirmPopover from '~/components/PopoverModals/ConfirmPopover.svelte';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { selected_user_type } from '~/components/pages/user/user_state.svelte';
  import { get_lang_from_id, LANG_LIST, LANG_LIST_IDS } from '~/state/lang_list';
  import { get_project_from_id, PROJECT_LIST } from '~/state/project_list';
  import Icon from '~/tools/Icon.svelte';
  import { BsPlusLg } from 'svelte-icons-pack/bs';
  import { cn } from '$lib/utils';
  import * as Popover from '$lib/components/ui/popover';
  import { CgClose } from 'svelte-icons-pack/cg';
  import { FiEdit3 } from 'svelte-icons-pack/fi';
  import * as Select from '$lib/components/ui/select';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { OiLinkExternal16 } from 'svelte-icons-pack/oi';
  import RevokeSessions from './RevokeSessions.svelte';
  import ms from 'ms';
  import { CURRENT_APP_SCOPE } from '~/state/data_types';
  import { AiOutlinePlus } from 'svelte-icons-pack/ai';
  import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
  import { fetch_post } from '~/tools/fetch';

  const query_client = useQueryClient();

  let {
    user_info,
    admin_edit = false,
    user_is_current_app_scope
  }: {
    user_info: {
      id: string;
      name: string;
      email: string;
      role?: string | null;
    };
    user_is_current_app_scope: boolean;
    admin_edit?: boolean;
  } = $props();

  let langugae_select_popover = $state(false);
  let selected_langs_ids = $state.raw<number[]>([]);

  const projects_info = $derived(
    createQuery({
      queryKey: ['user_info', user_info.id],
      queryFn: async () => {
        try {
          const data = await client.user.user_info.query({
            user_id: user_info.id
          });
          return data;
        } catch {
          return null;
        }
      },
      staleTime: ms('5mins')
    })
  );

  $effect(() => {
    if (!$projects_info.isSuccess) return;
    if (!selected_project_id || selected_project_id === '') return;
    const data = $projects_info.data;
    if (!user_is_current_app_scope) return;
    selected_langs_ids = [];
    const languages = data!.projects.find(
      (p) => p.project_id === parseInt(selected_project_id)
    )?.langugae_ids;
    if (languages) {
      selected_langs_ids = languages;
    }
  });

  let selected_project_id = $state<string>('');

  $effect(() => {
    // select the first project
    if (!$projects_info.isSuccess) return;
    if (!user_is_current_app_scope || $projects_info.data?.projects.length === 0) return;
    selected_project_id = $projects_info.data!.projects[0]?.project_id.toString();
  });

  let approve_popup_state = $state(false);

  const add_user_app_scope = async (user_id: string) => {
    const res = await fetch_post(`${PUBLIC_BETTER_AUTH_URL}/api/app_scope/add_user_app_scope`, {
      json: {
        user_id: user_id,
        scope: CURRENT_APP_SCOPE
      },
      credentials: 'include'
    });
    if (!res.ok) return;
    return (await res.json()) ?? ({ success: false } as { success: boolean });
  };

  const remove_user_from_current_app_scope_mut =
    client_q.user.remove_user_from_current_app_scope.mutation({
      onSuccess() {
        query_client.invalidateQueries({
          queryKey: ['user_info', user_info.id],
          exact: true
        });
        query_client.invalidateQueries({
          queryKey: ['users_list'],
          exact: true
        });
      }
    });

  const remove_user_from_current_app_scope = async () => {
    await $remove_user_from_current_app_scope_mut.mutateAsync({
      user_id: user_info.id
    });
  };

  const approve_user_func = async () => {
    $projects_info.refetch();
    await add_user_app_scope(user_info.id);
    query_client.invalidateQueries({
      queryKey: ['user_info', user_info.id]
    });
    query_client.invalidateQueries({
      queryKey: ['users_list']
    });
    $selected_user_type = 'project_scope';
    // $selected_user_id = user_info.id;
  };

  let add_project_popup = $state(false);

  const add_project_mut = client_q.project.add_to_project.mutation({
    onSuccess() {
      query_client.invalidateQueries({
        queryKey: ['user_info', user_info.id],
        exact: true
      });
    }
  });

  const add_project_for_user = async (project_id: number) => {
    add_project_popup = false;
    await $add_project_mut.mutateAsync({
      user_id: user_info.id,
      project_id
    });
  };

  let approve_remove_project_popup = $state(false);

  const project_remove_mut = client_q.project.remove_from_project.mutation({
    onSuccess() {
      query_client.invalidateQueries({
        queryKey: ['user_info', user_info.id],
        exact: true
      });
    }
  });

  const project_remove = async (project_id: number) => {
    approve_remove_project_popup = false;
    await $project_remove_mut.mutateAsync({
      user_id: user_info.id,
      project_id
    });
  };

  const add_language_mut = client_q.project.update_project_languages.mutation({
    onSuccess() {
      query_client.invalidateQueries({
        queryKey: ['user_info', user_info.id],
        exact: true
      });
    }
  });

  const add_language_to_project = async (project_id: number, languages_id: number[]) => {
    await $add_language_mut.mutateAsync({
      user_id: user_info.id,
      project_id,
      languages_id
    });
  };
</script>

{#if !$projects_info.isFetching && $projects_info.isSuccess && $projects_info.data}
  {@const data = $projects_info.data}
  {#if admin_edit}
    <div class="text-base font-semibold">{user_info.name}</div>
    <a class="text-xs text-muted-foreground sm:text-sm" href={`emailto:${user_info.email}`}
      >{user_info.email}</a
    >
  {/if}
  {#if !user_is_current_app_scope}
    {#if !admin_edit}
      <div class="text-amber-600 dark:text-amber-500">
        Your account has not been added to the Projects Portal scope yet. <span class="text-xs"
          >Contact the admin</span
        >
      </div>
    {:else}
      <div class="mt-2 text-amber-600 dark:text-amber-500">
        This account has not been added to Projects Portal scope.
      </div>
      <div class="space-x-2">
        <ConfirmPopover
          bind:popup_state={approve_popup_state}
          confirm_func={() => {
            approve_popup_state = false;
            approve_user_func();
          }}
          placement="right"
          description="Sure to Approve this User ?"
        >
          <span
            class="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2 py-1 text-sm font-bold text-primary-foreground"
          >
            <Icon src={AiOutlinePlus} class="text-xl" />
            Add to Projects Portal Scope
          </span>
        </ConfirmPopover>
      </div>
    {/if}
  {:else}
    {@const projects = data.projects}
    {#if projects.length === 0}
      {#if !admin_edit}
        <div>You Have not been assigned to any projects yet.</div>
      {:else}
        <div class="mt-2 text-sm">No Projects Alloted to this user</div>
        <div class="mt-2.5">
          {@render add_project(true)}
        </div>
      {/if}
    {:else}
      {@const current_project = projects.find(
        (p) => p.project_id === parseInt(selected_project_id)
      )}
      {@const current_project_info = current_project
        ? get_project_from_id(current_project.project_id)
        : null}
      <div class="mt-2.5">
        <label class="inline-block">
          <span class="text-sm font-semibold">Project</span>
          <Select.Root type="single" bind:value={selected_project_id as any}>
            <Select.Trigger class="w-56 text-sm sm:w-60">
              {projects.find((p) => p.project_id.toString() === selected_project_id)
                ? get_project_from_id(
                    projects.find((p) => p.project_id.toString() === selected_project_id)!
                      .project_id
                  ).name
                : 'Select Project'}
            </Select.Trigger>
            <Select.Content>
              {#each projects as project}
                <Select.Item value={project.project_id.toString()}
                  >{get_project_from_id(project.project_id).name}</Select.Item
                >
              {/each}
            </Select.Content>
          </Select.Root>
        </label>
        {#if admin_edit}
          {@render add_project()}
          <ConfirmPopover
            bind:popup_state={approve_remove_project_popup}
            confirm_func={() => {
              approve_remove_project_popup = false;
              project_remove(current_project_info!.id);
            }}
            placement="bottom"
            description="Sure to unassign this Project ?"
            class="text-sm"
          >
            <button disabled={$project_remove_mut.isPending} class="ml-2 hover:text-destructive">
              <Icon src={CgClose} class="text-xl" />
            </button>
          </ConfirmPopover>
        {/if}
        {#if current_project_info}
          {@const url = `/${current_project_info.key}`}
          <a
            class="ml-1.5 inline-block p-0 hover:text-blue-600 dark:hover:text-blue-500"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${current_project_info.name} Project`}
          >
            <Icon src={OiLinkExternal16} class="text-lg" />
          </a>
        {/if}
      </div>
      {#if current_project_info && current_project}
        {#if current_project_info.description}
          <div class="mt-2 text-sm text-muted-foreground">
            {current_project_info.description}
          </div>
        {/if}
        {@const language_ids = current_project.langugae_ids}
        {#if language_ids.length === 0}
          {#if !admin_edit}
            <div class="mt-2">You have not been alloted any Languages to work upon.</div>
          {:else}
            <div class="mt-4 text-sm">No Language Alloted</div>
            <div class="mt-2.5">
              {@render add_language(true)}
            </div>
          {/if}
        {:else}
          <div class="mt-2">
            <div class="gap-2 text-sm text-muted-foreground">
              <span>Languages</span>
              <span class="inline-flex gap-2">
                {#each language_ids as lang_id}
                  <div class="rounded-md bg-muted px-2 py-1 text-xs">
                    {get_lang_from_id(lang_id)}
                  </div>
                {/each}
              </span>
              {@render add_language(false)}
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  {/if}
  {#if admin_edit}
    <RevokeSessions user_id={user_info.id} />
    {#if user_is_current_app_scope}
      <div class="mt-6">
        <ConfirmModal
          title="Remove User from Projects Portal Scope"
          body_text={() => 'Are you sure you want to reset user permissions to Projects Portal ?'}
          confirm_func={remove_user_from_current_app_scope}
          popup_state={false}
        >
          <button
            disabled={$remove_user_from_current_app_scope_mut.isPending}
            class="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground"
          >
            Remove User from Projects Portal Scope
          </button>
        </ConfirmModal>
      </div>
    {/if}
  {/if}
{:else}
  <div class="h-40 w-full animate-pulse rounded-md bg-muted"></div>
{/if}

{#snippet add_project(new_list = false)}
  {#if user_is_current_app_scope && $projects_info.data!.projects.length !== PROJECT_LIST.length}
    <Popover.Root bind:open={add_project_popup}>
      <Popover.Trigger class="ml-1">
        <span
          class={cn(
            'inline-flex items-center gap-1 rounded-md bg-primary px-1 py-0.5 font-semibold text-primary-foreground',
            new_list && 'px-2'
          )}
        >
          <Icon src={BsPlusLg} class="text-xl" />
          {#if new_list}
            Add Project
          {/if}
        </span>
      </Popover.Trigger>
      <Popover.Content side={new_list ? 'right' : 'bottom'} class="space-y-1 p-2 sm:space-y-1.5">
        {#each PROJECT_LIST as project}
          {#if user_is_current_app_scope && !$projects_info.data!.projects.find((p) => p.project_id === project.id)}
            <div class="block w-full">
              <ConfirmPopover
                popup_state={false}
                confirm_func={() => {
                  add_project_for_user(project.id);
                }}
                placement="bottom"
                description={`Are you sure you want this user to '${project.name}' project ?`}
                class="text-sm"
              >
                <span
                  class="block w-full cursor-pointer rounded-md px-2 py-1 text-center hover:bg-muted"
                >
                  {project.name}
                </span>
              </ConfirmPopover>
            </div>
          {/if}
        {/each}
      </Popover.Content>
    </Popover.Root>
  {/if}
{/snippet}
{#snippet add_language(new_list = false)}
  <Popover.Root bind:open={langugae_select_popover}>
    <Popover.Trigger class="ml-1">
      {#if admin_edit}
        {#if new_list}
          <span
            class="inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-sm text-primary-foreground"
          >
            <Icon src={BsPlusLg} class="text-xl" />
            Add Language
          </span>
        {:else}
          <span class="ml-1.5 inline-block p-0">
            <Icon src={FiEdit3} class="text-xl" />
          </span>
        {/if}
      {/if}
    </Popover.Trigger>
    <Popover.Content side={new_list ? 'right' : 'bottom'} class="w-64 space-y-2 p-3">
      <div class="max-h-60 space-y-2 overflow-y-auto pr-2">
        {#each LANG_LIST as lang, i (i)}
          <label class="flex items-center space-x-2">
            <Checkbox
              checked={selected_langs_ids.includes(LANG_LIST_IDS[i])}
              onCheckedChange={(checked) => {
                if (checked) {
                  selected_langs_ids = [...selected_langs_ids, LANG_LIST_IDS[i]];
                } else {
                  selected_langs_ids = selected_langs_ids.filter((id) => id !== LANG_LIST_IDS[i]);
                }
              }}
            />
            <span class="text-sm">{lang}</span>
          </label>
        {/each}
      </div>
      <Button
        onclick={() => {
          langugae_select_popover = false;
          add_language_to_project(parseInt(selected_project_id), selected_langs_ids);
        }}
        class="mt-2 w-full"
        size="sm">Update</Button
      >
    </Popover.Content>
  </Popover.Root>
{/snippet}
