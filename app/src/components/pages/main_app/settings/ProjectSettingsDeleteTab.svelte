<script lang="ts">
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { useTRPC } from '~/api/client';
  import { invalidate_project_registry_queries } from '~/state/main_app/data.svelte';
  import type { project_type } from '~/state/project_list';
  import { Button } from '$lib/components/ui/button';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { toast } from 'svelte-sonner';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  let {
    project,
    onDeleted
  }: {
    project: project_type;
    onDeleted?: () => void;
  } = $props();
  const trpc = useTRPC();

  let delete_dialog_open = $state(false);

  const counts_q = createQuery(() =>
    trpc.project.edit.get_delete_resource_counts.queryOptions({
      project_id: project.id
    })
  );

  const delete_mut = createMutation(() =>
    trpc.project.edit.delete_project.mutationOptions({
      onSuccess: async () => {
        await invalidate_project_registry_queries(project.id);
        delete_dialog_open = false;
        toast.success('Project deleted');
        onDeleted?.();
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete project');
      }
    })
  );

  const resource_lines = $derived(
    counts_q.data
      ? [
          { label: 'Text rows', count: counts_q.data.texts },
          { label: 'Translations', count: counts_q.data.translations },
          { label: 'Media attachments', count: counts_q.data.media_attachment },
          { label: 'User project assignments', count: counts_q.data.user_project_join },
          {
            label: 'User language assignments',
            count: counts_q.data.user_project_language_join
          }
        ].filter((row) => row.count > 0)
      : []
  );
</script>

{#if counts_q.isPending}
  <div class="space-y-3" aria-busy="true" aria-label="Loading deletion status">
    <Skeleton class="h-4 w-full" />
    <Skeleton class="h-4 w-4/5" />
    <Skeleton class="h-20 w-full rounded-lg" />
  </div>
{:else if counts_q.isError}
  <p class="text-sm text-destructive" role="alert">
    {counts_q.error.message || 'Could not load deletion status.'}
  </p>
{:else if counts_q.data}
  {#if counts_q.data.total === 0}
    <div
      class="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-4"
      role="status"
    >
      <div class="flex gap-2">
        <TriangleAlert class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div class="space-y-2 text-sm">
          <p class="font-medium text-foreground">Delete this project permanently?</p>
          <p class="text-muted-foreground">
            <strong>{project.name}</strong> has no connected texts, translations, media, or user assignments.
            You may delete it, but this action cannot be undone.
          </p>
        </div>
      </div>

      <AlertDialog.Root bind:open={delete_dialog_open}>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button {...props} type="button" variant="destructive" size="sm">Delete project</Button>
          {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content class="max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Title>Delete {project.name}?</AlertDialog.Title>
            <AlertDialog.Description class="text-sm text-muted-foreground">
              This permanently removes the project and its map from the database. This cannot be
              reversed.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer class="flex flex-wrap gap-2 sm:justify-end">
            <AlertDialog.Cancel disabled={delete_mut.isPending}>Cancel</AlertDialog.Cancel>
            <Button
              class="bg-destructive text-white hover:bg-destructive/90"
              disabled={delete_mut.isPending}
              onclick={() => delete_mut.mutate({ project_id: project.id })}
            >
              {delete_mut.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  {:else}
    <div
      class="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm"
      role="alert"
    >
      <div class="flex gap-2">
        <TriangleAlert class="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <p class="font-medium text-amber-900 dark:text-amber-100">This project cannot be deleted</p>
      </div>
      <p class="text-muted-foreground">
        <strong>{project.name}</strong> still has connected data ({resource_lines.length} type{resource_lines.length ===
        1
          ? ''
          : 's'}, {counts_q.data.total} record{counts_q.data.total === 1 ? '' : 's'} in total):
      </p>
      <ul class="list-inside list-disc space-y-1 text-muted-foreground">
        {#each resource_lines as row (row.label)}
          <li>{row.label}: {row.count}</li>
        {/each}
      </ul>
      <p class="text-muted-foreground">
        Remove or reassign these records before deletion. If you need help, contact the developer
        for assistance.
      </p>
    </div>
  {/if}
{/if}
