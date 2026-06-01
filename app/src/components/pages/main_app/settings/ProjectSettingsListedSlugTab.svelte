<script lang="ts">
  import { client_q } from '~/api/client';
  import { invalidate_project_list_queries } from '~/state/main_app/data.svelte';
  import { project_state } from '~/state/main_app/state.svelte';
  import type { project_type } from '~/state/project_list';
  import { lekhaUrlSlugify } from '~/lib/carta_markdown/markdown';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { toast } from 'svelte-sonner';

  let {
    project,
    onSlugChanged
  }: {
    project: project_type;
    onSlugChanged?: (newKey: string) => void;
  } = $props();

  let slug_edit_unlocked = $state(false);
  let slug_draft = $state('');
  let unlock_dialog_open = $state(false);
  let save_confirm_open = $state(false);
  let unpublish_dialog_open = $state(false);

  $effect(() => {
    project.key;
    if (!slug_edit_unlocked) slug_draft = project.key;
  });

  const slug_mut = client_q.project.edit.edit_project_slug.mutation({
    onSuccess: async (_data, variables) => {
      const key = lekhaUrlSlugify(variables.key);
      await invalidate_project_list_queries();
      slug_edit_unlocked = false;
      save_confirm_open = false;
      $project_state = { ...$project_state, project_key: key };
      toast.success('Project slug updated');
      onSlugChanged?.(key);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update project slug');
    }
  });

  const listed_mut = client_q.project.edit.update_listed.mutation({
    onSuccess: async (_data, variables) => {
      await invalidate_project_list_queries();
      unpublish_dialog_open = false;
      $project_state = { ...$project_state, listed: variables.listed };
      toast.success(
        variables.listed ? 'Project is now listed on the public site' : 'Project unpublished'
      );
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update listed status');
    }
  });

  const cancel_slug_edit = () => {
    slug_draft = project.key;
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
    save_confirm_open = true;
  };

  const confirm_slug_save = () => {
    $slug_mut.mutate({
      project_id: project.id,
      key: slug_draft
    });
  };

  const list_project = () => {
    $listed_mut.mutate({ project_id: project.id, listed: true });
  };

  const unpublish_project = () => {
    $listed_mut.mutate({ project_id: project.id, listed: false });
  };
</script>

<div class="flex flex-col gap-8">
  <section class="space-y-3">
    <div class="space-y-1">
      <Label for="project-slug-input">Slug (URL key)</Label>
      <p class="text-xs text-muted-foreground">
        Used in project URLs, e.g. <span class="font-mono">/{project.key}</span>
      </p>
    </div>

    {#if !slug_edit_unlocked}
      <AlertDialog.Root bind:open={unlock_dialog_open}>
        <div class="flex flex-wrap items-end gap-2">
          <Input
            id="project-slug-input"
            value={project.key}
            disabled
            class="min-w-0 flex-1 font-mono text-sm"
          />
          <AlertDialog.Trigger>
            {#snippet child({ props })}
              <Button {...props} type="button" variant="outline" size="sm" class="shrink-0">
                Edit
              </Button>
            {/snippet}
          </AlertDialog.Trigger>
        </div>
        <AlertDialog.Content class="max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Title>Change project slug?</AlertDialog.Title>
            <AlertDialog.Description class="text-sm text-muted-foreground">
              Changing the slug updates this project&rsquo;s URL. Bookmarks, links, and navigation
              that use the old slug (such as <span class="font-mono">/{project.key}</span>) will
              stop working unless you set up redirects elsewhere.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              onclick={() => {
                slug_edit_unlocked = true;
                slug_draft = project.key;
                unlock_dialog_open = false;
              }}
            >
              Continue editing
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {:else}
      <div class="flex flex-wrap items-end gap-2">
        <Input
          id="project-slug-input"
          bind:value={slug_draft}
          class="min-w-0 flex-1 font-mono text-sm"
          autocomplete="off"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={$slug_mut.isPending}
          onclick={request_slug_save}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={$slug_mut.isPending}
          onclick={cancel_slug_edit}
        >
          Cancel
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">Lowercase letters, digits, and hyphens only.</p>
    {/if}

    <AlertDialog.Root bind:open={save_confirm_open}>
      <AlertDialog.Content class="max-w-md">
        <AlertDialog.Header>
          <AlertDialog.Title>Save new slug?</AlertDialog.Title>
          <AlertDialog.Description class="text-sm text-muted-foreground">
            The project URL will change from <span class="font-mono">/{project.key}</span> to
            <span class="font-mono">/{lekhaUrlSlugify(slug_draft) || '…'}</span>. Users with the old
            link may not reach this project.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action disabled={$slug_mut.isPending} onclick={confirm_slug_save}>
            {$slug_mut.isPending ? 'Saving…' : 'Save slug'}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  </section>

  <section class="space-y-3 border-t border-border/60 pt-6">
    <div class="space-y-1">
      <h3 class="text-sm font-semibold">Public listing</h3>
      <p class="text-xs text-muted-foreground">
        Listed projects can appear on the public site homepage. Unlisted projects stay hidden there.
      </p>
    </div>

    {#if $project_state.listed}
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
              disabled={$listed_mut.isPending}
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
            <AlertDialog.Action disabled={$listed_mut.isPending} onclick={unpublish_project}>
              {$listed_mut.isPending ? 'Updating…' : 'Unpublish'}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {:else}
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={$listed_mut.isPending}
        onclick={list_project}
      >
        {$listed_mut.isPending ? 'Updating…' : 'List on public site'}
      </Button>
    {/if}
  </section>
</div>
