<script lang="ts">
  import { client, useTRPC } from '~/api/client';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import ConfirmPopover from '~/components/PopoverModals/ConfirmPopover.svelte';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { get_lang_from_id, LANG_LIST, LANG_LIST_IDS } from '~/state/lang_list';
  import { get_project_from_id, EMPTY_PROJECT_REGISTRY } from '~/state/project_list';
  import { project_list_q_options } from '~/state/main_app/data.svelte';
  import Icon from '~/tools/Icon.svelte';
  import { BsPlusLg } from 'svelte-icons-pack/bs';
  import { cn } from '$lib/utils';
  import * as Popover from '$lib/components/ui/popover';
  import { CgClose } from 'svelte-icons-pack/cg';
  import { FiEdit3 } from 'svelte-icons-pack/fi';
  import * as Select from '$lib/components/ui/select';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Button } from '$lib/components/ui/button';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { OiLinkExternal16 } from 'svelte-icons-pack/oi';
  import RevokeSessions from './RevokeSessions.svelte';
  import ms from 'ms';
  import { APP_SCOPE_ID_PROJECT_PORTAL } from '~/state/data_types';

  const query_client = useQueryClient();
  const trpc = useTRPC();
  const project_list_q = createQuery(() => project_list_q_options());
  const project_registry = $derived(project_list_q.data ?? EMPTY_PROJECT_REGISTRY);

  let {
    user_info,
    admin_edit = false
  }: {
    user_info: {
      id: string;
      name: string;
      email: string;
      role?: string | null;
    };
    admin_edit?: boolean;
  } = $props();

  let language_select_popover = $state(false);
  let selected_langs_ids = $state.raw<number[]>([]);
  let selected_project_id = $state<string>('');
  let add_project_popup = $state(false);
  let approve_remove_project_popup = $state(false);

  const projects_info = createQuery(() => ({
    queryKey: ['user_info', user_info.id],
    queryFn: () =>
      client.user.user_info.query({
        user_id: user_info.id
      }),
    staleTime: ms('5mins')
  }));

  $effect(() => {
    if (!projects_info.isSuccess) return;
    if (!selected_project_id || selected_project_id === '') return;
    const data = projects_info.data;
    selected_langs_ids = [];
    const languages = data!.projects.find(
      (p) => p.project_id === parseInt(selected_project_id)
    )?.langugae_ids;
    if (languages) {
      selected_langs_ids = languages;
    }
  });

  let last_seeded_user_id = $state<string | null>(null);

  $effect(() => {
    if (!projects_info.isSuccess) return;
    if (projects_info.data?.projects.length === 0) return;
    if (last_seeded_user_id === user_info.id) return;
    selected_project_id = projects_info.data!.projects[0]?.project_id.toString();
    last_seeded_user_id = user_info.id;
  });

  const remove_user_from_app_scope_mut = createMutation(() =>
    trpc.user.remove_user_from_app_scope.mutationOptions({
      onSuccess() {
        query_client.invalidateQueries({
          queryKey: ['user_info', user_info.id],
          exact: true
        });
        query_client.invalidateQueries({
          queryKey: ['users_list'],
          exact: true
        });
        query_client.invalidateQueries({
          queryKey: trpc.user.list_user_app_scopes.queryKey({ user_id: user_info.id })
        });
      }
    })
  );

  const remove_user_from_app_scope = async () => {
    await remove_user_from_app_scope_mut.mutateAsync({
      user_id: user_info.id,
      scope: APP_SCOPE_ID_PROJECT_PORTAL
    });
  };

  const add_project_mut = createMutation(() =>
    trpc.project.add_to_project.mutationOptions({
      onSuccess() {
        query_client.invalidateQueries({
          queryKey: ['user_info', user_info.id],
          exact: true
        });
      }
    })
  );

  const add_project_for_user = async (project_id: number) => {
    add_project_popup = false;
    await add_project_mut.mutateAsync({
      user_id: user_info.id,
      project_id
    });
  };

  const project_remove_mut = createMutation(() =>
    trpc.project.remove_from_project.mutationOptions({
      onSuccess() {
        query_client.invalidateQueries({
          queryKey: ['user_info', user_info.id],
          exact: true
        });
      }
    })
  );

  const project_remove = async (project_id: number) => {
    approve_remove_project_popup = false;
    await project_remove_mut.mutateAsync({
      user_id: user_info.id,
      project_id
    });
  };

  const add_language_mut = createMutation(() =>
    trpc.project.update_project_languages.mutationOptions({
      onSuccess() {
        query_client.invalidateQueries({
          queryKey: ['user_info', user_info.id],
          exact: true
        });
      }
    })
  );

  const add_language_to_project = async (project_id: number, languages_id: number[]) => {
    await add_language_mut.mutateAsync({
      user_id: user_info.id,
      project_id,
      languages_id
    });
  };
</script>

{#if projects_info.isFetching}
  <Skeleton class="h-40 w-full" />
{:else if projects_info.isError}
  <div class="space-y-2 text-destructive">
    <p class="text-sm">Failed to load project assignments.</p>
    <button
      class="rounded-md bg-muted px-2 py-1 text-sm font-semibold hover:bg-muted/80"
      onclick={() => projects_info.refetch()}
    >
      Retry
    </button>
  </div>
{:else if projects_info.isSuccess && projects_info.data}
  {@const data = projects_info.data}
  {#if admin_edit}
    <div class="text-base font-semibold">{user_info.name}</div>
    <a class="text-xs text-muted-foreground sm:text-sm" href={`mailto:${user_info.email}`}
      >{user_info.email}</a
    >
  {/if}
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
    {@const current_project = projects.find((p) => p.project_id === parseInt(selected_project_id))}
    {@const current_project_info = current_project
      ? get_project_from_id(current_project.project_id, project_registry)
      : null}
    <div class="mt-2.5">
      <label class="inline-block">
        <span class="text-sm font-semibold">Project</span>
        <Select.Root type="single" bind:value={selected_project_id as any}>
          <Select.Trigger class="w-56 text-sm sm:w-60">
            {projects.find((p) => p.project_id.toString() === selected_project_id)
              ? get_project_from_id(
                  projects.find((p) => p.project_id.toString() === selected_project_id)!.project_id,
                  project_registry
                )?.name
              : 'Select Project'}
          </Select.Trigger>
          <Select.Content>
            {#each projects as project}
              <Select.Item value={project.project_id.toString()}
                >{get_project_from_id(project.project_id, project_registry)?.name ??
                  `Project ${project.project_id}`}</Select.Item
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
          <button disabled={project_remove_mut.isPending} class="ml-2 hover:text-destructive">
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
  {#if admin_edit}
    <RevokeSessions user_id={user_info.id} />
    <div class="mt-6">
      <ConfirmModal
        title="Remove User from Projects Portal Scope"
        body_text={() => 'Are you sure you want to reset user permissions to Projects Portal ?'}
        confirm_func={remove_user_from_app_scope}
        popup_state={false}
      >
        <button
          disabled={remove_user_from_app_scope_mut.isPending}
          class="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground"
        >
          Remove User from Projects Portal Scope
        </button>
      </ConfirmModal>
    </div>
  {/if}
{:else}
  <Skeleton class="h-40 w-full" />
{/if}

{#snippet add_project(new_list = false)}
  {#if project_list_q.isSuccess && projects_info.data!.projects.length !== project_registry.list.length}
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
        {#each project_registry.list as project (project.id)}
          {#if !projects_info.data!.projects.find((p) => p.project_id === project.id)}
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
  <Popover.Root bind:open={language_select_popover}>
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
          language_select_popover = false;
          add_language_to_project(parseInt(selected_project_id), selected_langs_ids);
        }}
        class="mt-2 w-full"
        size="sm">Update</Button
      >
    </Popover.Content>
  </Popover.Root>
{/snippet}
