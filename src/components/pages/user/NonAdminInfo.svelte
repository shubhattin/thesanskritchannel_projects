<script lang="ts">
  import { client, client_q } from '~/api/client';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import ConfirmPopover from '~/components/PopoverModals/ConfirmPopover.svelte';
  import { selected_user_id, selected_user_type } from '~/components/pages/user/user_state.svelte';
  import { get_lang_from_id, LANG_LIST, LANG_LIST_IDS } from '~/state/lang_list';
  import { get_project_from_id, PROJECT_LIST } from '~/state/project_list';
  import Icon from '~/tools/Icon.svelte';
  import { BsCheckLg, BsPlusLg } from 'svelte-icons-pack/bs';
  import { cl_join } from '~/tools/cl_join';
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import { CgClose } from 'svelte-icons-pack/cg';
  import { FiEdit3 } from 'svelte-icons-pack/fi';
  import { authClient } from '~/lib/auth-client';
  import { OiLinkExternal16 } from 'svelte-icons-pack/oi';
  import RevokeSessions from './RevokeSessions.svelte';

  const query_client = useQueryClient();

  let {
    user_info,
    admin_edit = false
  }: {
    user_info: {
      id: string;
      name: string;
      email: string;
      role?: string | null;
      is_approved?: boolean | null;
    };
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
      }
    })
  );

  $effect(() => {
    if (!$projects_info.isSuccess) return;
    if (!selected_project_id || selected_project_id === '') return;
    const data = $projects_info.data;
    if (!user_info.is_approved) return;
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
    if (!user_info.is_approved || $projects_info.data?.projects.length === 0) return;
    selected_project_id = $projects_info.data!.projects[0]?.project_id.toString();
  });

  let approve_popup_state = $state(false);

  const approve_user_func = async () => {
    $projects_info.refetch();
    await authClient.user_info.approve_user({
      userId: user_info.id
    });
    query_client.invalidateQueries({
      queryKey: ['user_info', user_info.id]
    });
    query_client.invalidateQueries({
      queryKey: ['users_list']
    });
    $selected_user_type = 'regular';
    // $selected_user_id = user_info.id;
  };

  let remove_user_popup = $state(false);

  const remove_user_mut = client_q.user.remove_user.mutation({
    onSuccess() {
      query_client.invalidateQueries({
        queryKey: ['users_list']
      });
      $selected_user_id = null;
    }
  });

  const remove_user_func = async () => {
    remove_user_popup = false;
    await $remove_user_mut.mutateAsync({
      user_id: user_info.id
    });
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
    <a
      class="text-xs text-slate-500 sm:text-sm dark:text-slate-400"
      href={`emailto:${user_info.email}`}>{user_info.email}</a
    >
  {/if}
  {#if !user_info.is_approved}
    {#if !admin_edit}
      <div class="text-warning-600 dark:text-warning-500">
        Your Account has not been approved yet. <span class="text-xs">Contact the admin</span>
      </div>
    {:else}
      <div class="mt-2 text-warning-600 dark:text-warning-500">
        This account has not been Approved.
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
            class="mt-1.5 btn gap-1 bg-primary-500 px-1.5 py-0 text-sm font-bold text-white dark:bg-primary-600"
          >
            <Icon src={BsCheckLg} class="text-xl" />
            Approve
          </span>
        </ConfirmPopover>
        <ConfirmPopover
          bind:popup_state={remove_user_popup}
          confirm_func={() => {
            remove_user_popup = false;
            remove_user_func();
          }}
          placement="right"
          description="Sure to Remove this User ?"
        >
          <button
            disabled={$remove_user_mut.isPending}
            class="mt-1.5 btn gap-1 bg-rose-500 px-1.5 py-0 text-sm font-bold text-white dark:bg-rose-600"
          >
            <Icon src={CgClose} class="text-xl" />
            Remove
          </button>
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
          <span class="label-text font-semibold">Project</span>
          <select bind:value={selected_project_id} class="select w-56 text-sm sm:w-60">
            {#each projects as project}
              <option value={project.project_id.toString()}
                >{get_project_from_id(project.project_id).name}</option
              >
            {/each}
          </select>
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
            <button
              disabled={$project_remove_mut.isPending}
              class="ml-2 hover:text-red-600 dark:hover:text-red-500"
            >
              <Icon src={CgClose} class="text-xl" />
            </button>
          </ConfirmPopover>
        {/if}
        {#if current_project_info}
          {@const url = `/${current_project_info.key}`}
          <a
            class="ml-1.5 btn p-0 hover:text-blue-600 dark:hover:text-blue-500"
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
          <div class="mt-2 text-sm text-slate-500 dark:text-slate-400">
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
            <div class="gap-2 text-sm text-slate-600 dark:text-slate-200">
              <span>Languages</span>
              <span class="inline-flex gap-2">
                {#each language_ids as lang_id}
                  <div class="rounded-md bg-zinc-200 px-2 py-1 text-xs dark:bg-slate-700">
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
  {/if}
{:else}
  <div class="h-40 placeholder w-full animate-pulse rounded-md"></div>
{/if}

{#snippet add_project(new_list = false)}
  {#if user_info.is_approved && $projects_info.data!.projects.length !== PROJECT_LIST.length}
    <Popover
      open={add_project_popup}
      onOpenChange={(e) => (add_project_popup = e.open)}
      positioning={{ placement: new_list ? 'right' : 'bottom' }}
      arrow={false}
      contentBase="card z-50 space-y-1 sm:space-y-1.5 rounded-lg px-2 py-1 shadow-xl bg-surface-100-900"
      triggerBase="ml-1"
    >
      {#snippet trigger()}
        <span
          class={cl_join(
            'btn gap-1 rounded-md bg-primary-500 px-1 py-0.5 font-semibold text-white dark:bg-primary-600',
            new_list && 'px-2'
          )}
        >
          <Icon src={BsPlusLg} class="text-xl" />
          {#if new_list}
            Add Project
          {/if}
        </span>
      {/snippet}
      {#snippet content()}
        {#each PROJECT_LIST as project}
          {#if user_info.is_approved && !$projects_info.data!.projects.find((p) => p.project_id === project.id)}
            <div class="block w-full">
              <ConfirmPopover
                popup_state={false}
                confirm_func={() => {
                  add_project_for_user(project.id);
                }}
                placement="bottom"
                description={`Are you sure you want this user to '${project.name}' project ?`}
                class="text-sm"
                triggerBase="btn block w-full gap-1 space-x-1 rounded-md px-1 py-0 text-center hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {project.name}
              </ConfirmPopover>
            </div>
          {/if}
        {/each}
      {/snippet}
    </Popover>
  {/if}
{/snippet}
{#snippet add_language(new_list = false)}
  <Popover
    open={langugae_select_popover}
    onOpenChange={(e) => (langugae_select_popover = e.open)}
    positioning={{ placement: new_list ? 'right' : 'bottom' }}
    arrow={false}
    contentBase="card z-50 sm:space-y-1.5 rounded-lg px-2 py-1 shadow-xl bg-surface-100-900"
    triggerBase="ml-1"
  >
    {#snippet trigger()}
      {#if admin_edit}
        {#if new_list}
          <button
            class="btn gap-1 rounded-md bg-primary-500 px-1.5 py-0.5 text-sm dark:bg-primary-600"
          >
            <Icon src={BsPlusLg} class="text-xl" />
            Add Language
          </button>
        {:else}
          <button class="ml-1.5 btn p-0">
            <Icon src={FiEdit3} class="text-xl" />
          </button>
        {/if}
      {/if}
    {/snippet}
    {#snippet content()}
      <select class="select px-2 py-1" multiple bind:value={selected_langs_ids}>
        {#each LANG_LIST as lang, i (i)}
          <option value={LANG_LIST_IDS[i]}>{lang}</option>
        {/each}
      </select>
      <button
        onclick={() => {
          langugae_select_popover = false;
          add_language_to_project(parseInt(selected_project_id), selected_langs_ids);
        }}
        class="mt-2 btn rounded-md bg-tertiary-500 px-2 py-1 text-white dark:bg-tertiary-600"
        >Update</button
      >
    {/snippet}
  </Popover>
{/snippet}
