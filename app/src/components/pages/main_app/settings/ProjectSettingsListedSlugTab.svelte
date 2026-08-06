<script lang="ts">
  import { browser } from '$app/environment';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { Debounced } from 'runed';
  import { useTRPC } from '~/api/client';
  import { invalidate_project_list_queries } from '~/state/main_app/data.svelte';
  import { project_state } from '~/state/main_app/state.svelte';
  import type { project_type } from '~/state/project_list';
  import { lekhaUrlSlugify } from '~/lib/carta_markdown/markdown';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Popover from '$lib/components/ui/popover';
  import { toast } from 'svelte-sonner';
  import Icon from '~/tools/Icon.svelte';
  import { BsThreeDots, BsTrash } from 'svelte-icons-pack/bs';

  let {
    project,
    onSlugChanged
  }: {
    project: project_type;
    onSlugChanged?: (newKey: string) => void;
  } = $props();
  const trpc = useTRPC();

  let slug_edit_unlocked = $state(false);
  let slug_draft = $state('');
  let redirect_old_url = $state(true);
  let save_confirm_open = $state(false);
  let unpublish_dialog_open = $state(false);
  let open_redirect_menu_id = $state<number | null>(null);

  $effect(() => {
    project.key;
    if (!slug_edit_unlocked) {
      slug_draft = project.key;
      redirect_old_url = true;
    }
  });

  const slug_effective = $derived(lekhaUrlSlugify(slug_draft));
  const debounced_slug = new Debounced(() => slug_effective, 400);
  let slug_check_slug = $state('');
  let slug_debounce_pending = $state(false);

  $effect(() => {
    slug_check_slug = debounced_slug.current;
    slug_debounce_pending = debounced_slug.pending;
  });

  const slug_in_sync = $derived(
    slug_effective.length > 0 && !slug_debounce_pending && slug_check_slug === slug_effective
  );

  const slug_changed = $derived(slug_effective.length > 0 && slug_effective !== project.key);

  const slug_check_q = createQuery(() =>
    trpc.project.edit.check_project_slug.queryOptions(
      { slug: slug_check_slug, exclude_project_id: project.id },
      { enabled: browser && slug_edit_unlocked && slug_check_slug.length > 0 && slug_changed }
    )
  );

  const slug_unavailable = $derived(
    slug_changed &&
      slug_in_sync &&
      !slug_check_q.isPending &&
      !slug_check_q.isFetching &&
      slug_check_q.data?.available === false
  );

  const replaces_redirect = $derived(
    slug_changed &&
      slug_in_sync &&
      !slug_check_q.isPending &&
      !slug_check_q.isFetching &&
      slug_check_q.data?.replaces_redirect === true
  );

  const redirects_q = createQuery(() => ({
    ...trpc.project.edit.list_project_redirects.queryOptions({
      project_id: project.id
    }),
    staleTime: 0,
    refetchOnMount: 'always'
  }));

  const slug_mut = createMutation(() =>
    trpc.project.edit.edit_project_slug.mutationOptions({
      onSuccess: async (_data, variables) => {
        const key = lekhaUrlSlugify(variables.key);
        await invalidate_project_list_queries();
        await redirects_q.refetch();
        slug_edit_unlocked = false;
        save_confirm_open = false;
        if ($project_state) $project_state = { ...$project_state, project_key: key };
        toast.success('Project slug updated');
        onSlugChanged?.(key);
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to update project slug');
      }
    })
  );

  const delete_redirect_mut = createMutation(() =>
    trpc.project.edit.delete_project_redirect.mutationOptions({
      onSuccess: async () => {
        open_redirect_menu_id = null;
        await redirects_q.refetch();
        toast.success('Redirect rule deleted');
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete redirect rule');
      }
    })
  );

  const listed_mut = createMutation(() =>
    trpc.project.edit.update_listed.mutationOptions({
      onSuccess: async (_data, variables) => {
        await invalidate_project_list_queries();
        unpublish_dialog_open = false;
        if ($project_state) $project_state = { ...$project_state, listed: variables.listed };
        toast.success(
          variables.listed ? 'Project is now listed on the public site' : 'Project unpublished'
        );
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to update listed status');
      }
    })
  );

  const start_slug_edit = () => {
    slug_draft = project.key;
    redirect_old_url = true;
    slug_edit_unlocked = true;
  };

  const cancel_slug_edit = () => {
    slug_draft = project.key;
    redirect_old_url = true;
    slug_edit_unlocked = false;
  };

  const request_slug_save = () => {
    const key = lekhaUrlSlugify(slug_draft);
    if (!key) {
      toast.error('Enter a valid slug (letters, digits, and hyphens)');
      return;
    }
    if (key === project.key) {
      slug_edit_unlocked = false;
      return;
    }
    if (slug_unavailable) {
      toast.error('This slug is already used by another project. You cannot use it.');
      return;
    }
    save_confirm_open = true;
  };

  const confirm_slug_save = () => {
    slug_mut.mutate({
      project_id: project.id,
      key: slug_draft,
      redirect_old_url
    });
  };

  const list_project = () => {
    listed_mut.mutate({ project_id: project.id, listed: true });
  };

  const unpublish_project = () => {
    listed_mut.mutate({ project_id: project.id, listed: false });
  };
</script>

<div class="flex flex-col gap-8">
  <section class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <Label for="project-slug-input">Slug (URL key)</Label>
      <p class="text-xs text-muted-foreground">
        Used in project URLs, e.g. <span class="font-mono">/{project.key}</span>
      </p>
    </div>

    {#if !slug_edit_unlocked}
      <div class="flex flex-wrap items-end gap-2">
        <Input
          id="project-slug-input"
          value={project.key}
          disabled
          class="min-w-0 flex-1 font-mono text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="shrink-0"
          onclick={start_slug_edit}
        >
          Edit
        </Button>
      </div>
    {:else}
      <div class="flex flex-wrap items-end gap-2">
        <Input
          id="project-slug-input"
          bind:value={slug_draft}
          class="min-w-0 flex-1 font-mono text-sm"
          autocomplete="off"
          aria-invalid={slug_unavailable}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={slug_mut.isPending || slug_unavailable || (slug_changed && !slug_in_sync)}
          onclick={request_slug_save}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={slug_mut.isPending}
          onclick={cancel_slug_edit}
        >
          Cancel
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">Lowercase letters, digits, and hyphens only.</p>

      {#if slug_changed}
        <label class="flex items-start gap-2 text-sm">
          <Checkbox bind:checked={redirect_old_url} class="mt-0.5" />
          <span>
            Redirect old project URL
            <span class="font-mono text-xs text-muted-foreground">/{project.key}</span>
            to the new slug (including nested paths)
          </span>
        </label>
      {/if}

      {#if slug_unavailable}
        <p class="text-sm text-destructive" role="alert">
          This slug is already used by another project. You cannot use it.
        </p>
      {:else if replaces_redirect}
        <p class="text-sm text-amber-700 dark:text-amber-300" role="status">
          This slug is currently used by an existing redirect rule. Saving will replace that
          redirect rule.
        </p>
      {/if}
    {/if}

    <AlertDialog.Root bind:open={save_confirm_open}>
      <AlertDialog.Content class="max-w-md">
        <AlertDialog.Header>
          <AlertDialog.Title>Save new slug?</AlertDialog.Title>
          <AlertDialog.Description class="flex flex-col gap-2 text-sm text-muted-foreground">
            <span>
              The project URL will change from <span class="font-mono">/{project.key}</span> to
              <span class="font-mono">/{lekhaUrlSlugify(slug_draft) || '…'}</span>.
            </span>
            {#if redirect_old_url}
              <span> Old links (including nested paths) will redirect to the new slug. </span>
            {:else}
              <span> The old slug will stop working. No redirect will be created. </span>
            {/if}
            {#if replaces_redirect}
              <span class="text-amber-700 dark:text-amber-300">
                An existing redirect rule for this slug will be replaced.
              </span>
            {/if}
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action disabled={slug_mut.isPending} onclick={confirm_slug_save}>
            {slug_mut.isPending ? 'Saving…' : 'Save slug'}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  </section>

  {#if (redirects_q.data?.length ?? 0) > 0}
    <section class="flex flex-col gap-3 border-t border-border/60 pt-6">
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold">Redirect rules</h3>
        <p class="text-xs text-muted-foreground">
          Old project keys that redirect to this project&rsquo;s current slug.
        </p>
      </div>

      <ul class="flex flex-col gap-1.5">
        {#each redirects_q.data ?? [] as rule (rule.id)}
          <li
            class="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
          >
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="truncate font-mono text-sm">/{rule.key}</span>
              <span class="text-xs text-muted-foreground">
                → /{project.key} (and nested paths)
              </span>
            </div>
            <Popover.Root
              open={open_redirect_menu_id === rule.id}
              onOpenChange={(open) => {
                open_redirect_menu_id = open ? rule.id : null;
              }}
            >
              <Popover.Trigger
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
                aria-label="Redirect actions"
              >
                <Icon src={BsThreeDots} class="text-base" />
              </Popover.Trigger>
              <Popover.Content class="w-36 p-1" align="end" sideOffset={6}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-8 w-full justify-start gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={delete_redirect_mut.isPending}
                  onclick={() => {
                    delete_redirect_mut.mutate({
                      project_id: project.id,
                      redirect_id: rule.id
                    });
                  }}
                >
                  <Icon src={BsTrash} class="text-sm" />
                  {delete_redirect_mut.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </Popover.Content>
            </Popover.Root>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="flex flex-col gap-3 border-t border-border/60 pt-6">
    <div class="flex flex-col gap-1">
      <h3 class="text-sm font-semibold">Public listing</h3>
      <p class="text-xs text-muted-foreground">
        Listed projects can appear on the public site homepage. Unlisted projects stay hidden there.
      </p>
    </div>

    {#if $project_state?.listed}
      <p class="text-sm text-amber-700 dark:text-amber-300">
        Unpublishing removes this project from the public site. Existing direct links may still work
        for users who know the URL.
      </p>
      <AlertDialog.Root bind:open={unpublish_dialog_open}>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              variant="destructive"
              size="sm"
              disabled={listed_mut.isPending}
            >
              Unpublish project
            </Button>
          {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content class="max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Title>Unpublish this project?</AlertDialog.Title>
            <AlertDialog.Description class="text-sm text-muted-foreground">
              The project will be marked unlisted and hidden from the public site listing. Confirm
              only if you intend to take it off the homepage.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action disabled={listed_mut.isPending} onclick={unpublish_project}>
              {listed_mut.isPending ? 'Updating…' : 'Unpublish'}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {:else}
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={listed_mut.isPending}
        onclick={list_project}
      >
        {listed_mut.isPending ? 'Updating…' : 'List on public site'}
      </Button>
    {/if}
  </section>
</div>
