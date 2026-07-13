<script lang="ts">
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import { client } from '~/api/client';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Select from '$lib/components/ui/select';
  import {
    IMAGE_BATCH_STATUS_LABELS,
    IMAGE_BATCH_STATUS_VARIANTS
  } from '~/utils/ai_batch/batch_image_status';
  import {
    invalidate_batch_ai_queries,
    invalidate_text_image_queries
  } from '~/state/main_app/batch_query_helpers';
  import Icon from '~/tools/Icon.svelte';
  import { OiSync16, OiLinkExternal16 } from 'svelte-icons-pack/oi';

  type Group = Awaited<ReturnType<typeof client.batch_ai.get_batch_manager_groups.query>>[number];
  type Item = Group['items'][number];

  let project_filter = $state<string>('all');
  let review_item = $state<Item | null>(null);
  let discard_item = $state<Item | null>(null);
  let polling_batch_id = $state<string | null>(null);

  const groups_q = createQuery(() => ({
    queryKey: ['batch_manager_groups', project_filter],
    queryFn: () =>
      client.batch_ai.get_batch_manager_groups.query(
        project_filter === 'all' ? undefined : { project_id: Number(project_filter) }
      ),
    staleTime: 90_000,
    refetchOnWindowFocus: false
  }));

  const project_list_q = createQuery(() => ({
    queryKey: ['project_list_for_batch_manager'],
    queryFn: async () => (await client.project.get_project_list.query({ all: true })).list,
    staleTime: 12 * 60 * 60 * 1000
  }));

  const poll_mut = createMutation(() => ({
    mutationFn: (batch_id: string) => {
      polling_batch_id = batch_id;
      return client.batch_ai.poll_batch_shloka_image_gen.mutate({ batch_id });
    },
    onSuccess: async (data) => {
      await invalidate_batch_ai_queries();
      // Custom query key is not covered by tRPC filters — same as Refresh.
      await groups_q.refetch();
      if (data.status === 'processed' || data.status === 'terminal_failure') {
        toast.success(data.message || 'Batch updated');
      } else {
        toast.success(data.message || 'Batch polled');
      }
    },
    onError: (err) => toast.error(err.message || 'Failed to poll batch'),
    onSettled: () => {
      polling_batch_id = null;
    }
  }));

  const approve_mut = createMutation(() => ({
    mutationFn: (item: Item) =>
      client.batch_ai.approve_shloka_image.mutate({
        batch_id: item.batch_id,
        custom_id: item.custom_id
      }),
    onSuccess: async () => {
      await Promise.all([invalidate_batch_ai_queries(), invalidate_text_image_queries()]);
      toast.success('Image saved to project path');
      review_item = null;
    },
    onError: (err) => toast.error(err.message || 'Failed to approve image')
  }));

  const discard_mut = createMutation(() => ({
    mutationFn: (item: Item) =>
      client.batch_ai.discard_shloka_image_batch_response.mutate({
        batch_id: item.batch_id,
        custom_id: item.custom_id
      }),
    onSuccess: async () => {
      await invalidate_batch_ai_queries();
      toast.success('Batch item discarded');
      discard_item = null;
      review_item = null;
    },
    onError: (err) => toast.error(err.message || 'Failed to discard item')
  }));

  const can_discard = (item: Item) =>
    item.status === 'processing' || item.status === 'ready_for_review' || item.status === 'failed';

  const origin_href = (item: Item) => {
    if (!item.project_key) return null;
    const path = item.path ? `/${item.path.split(':').join('/')}` : '';
    return `/${item.project_key}${path}`;
  };

  const groups = $derived(groups_q.data ?? []);
  let open_batch = $state<string | undefined>(undefined);
  $effect(() => {
    if (!open_batch && groups[0]) open_batch = groups[0].batch_id;
  });
</script>

<div class="mx-auto max-w-5xl space-y-4 px-3 py-6 sm:px-6">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold">Batch Manager</h1>
      <p class="text-sm text-muted-foreground">
        Inspect ongoing AI image batches, poll locally, and review or discard staged results.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Select.Root
        type="single"
        value={project_filter}
        onValueChange={(v) => {
          project_filter = v || 'all';
        }}
      >
        <Select.Trigger class="w-48">
          {project_filter === 'all'
            ? 'All projects'
            : (project_list_q.data?.find((p) => String(p.id) === project_filter)?.name ??
              'Project')}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="all">All projects</Select.Item>
          {#each project_list_q.data ?? [] as project (project.id)}
            <Select.Item value={String(project.id)}>{project.name}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Button
        variant="outline"
        class="gap-2"
        disabled={groups_q.isFetching}
        onclick={() => void groups_q.refetch()}
      >
        <Icon src={OiSync16} class={groups_q.isFetching ? 'animate-spin' : ''} />
        Refresh
      </Button>
    </div>
  </div>

  {#if groups_q.isLoading}
    <div class="flex flex-col gap-3">
      {#each Array(3) as _}
        <Skeleton class="h-16 w-full rounded-xl" />
      {/each}
    </div>
  {:else if groups_q.isError}
    <div class="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
      <p class="font-medium text-destructive">Failed to load batch jobs</p>
      <p class="mt-1 text-sm text-muted-foreground">{groups_q.error.message}</p>
      <Button class="mt-4" onclick={() => void groups_q.refetch()}>Try again</Button>
    </div>
  {:else if groups.length === 0}
    <div class="rounded-xl border border-dashed border-border p-8 text-center">
      <p class="font-medium">No active batch image jobs</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Queue background generation from the AI Image Generator.
      </p>
    </div>
  {:else}
    <Accordion.Root type="single" bind:value={open_batch} class="flex flex-col gap-3">
      {#each groups as group (group.batch_id)}
        <Accordion.Item value={group.batch_id} class="rounded-xl border border-border px-4">
          <Accordion.Trigger class="py-4 hover:no-underline">
            <div
              class="flex w-full flex-col gap-2 pr-2 text-left sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="space-y-1">
                <p class="font-semibold">Batch {group.batch_id}</p>
                <p class="text-xs text-muted-foreground">{group.items.length} item(s)</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Badge variant="secondary">Pending {group.counts.pending}</Badge>
                <Badge>Ready {group.counts.ready}</Badge>
                <Badge variant="destructive">Failed {group.counts.failed}</Badge>
                {#if group.counts.auto_approved > 0}
                  <Badge variant="outline">Auto-apply {group.counts.auto_approved}</Badge>
                {/if}
              </div>
            </div>
          </Accordion.Trigger>
          <Accordion.Content class="space-y-4 pb-4">
            <div class="flex flex-wrap justify-end gap-2">
              <a
                class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                href={group.openai_batch_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenAI batch
                <Icon src={OiLinkExternal16} class="text-sm" />
              </a>
              <Button
                size="sm"
                variant="outline"
                class="gap-2"
                disabled={polling_batch_id !== null}
                onclick={() => poll_mut.mutate(group.batch_id)}
              >
                <Icon
                  src={OiSync16}
                  class={polling_batch_id === group.batch_id ? 'animate-spin' : ''}
                />
                Poll now
              </Button>
            </div>

            <div class="flex flex-col gap-3">
              {#each group.items as item (item.custom_id)}
                <div
                  class="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="flex min-w-0 flex-1 items-start gap-3">
                    {#if item.image_asset}
                      <img
                        src={item.image_asset.url}
                        alt={item.metadata.image_prompt}
                        class="size-16 shrink-0 rounded-md border border-border object-cover"
                      />
                    {:else}
                      <div
                        class="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
                      >
                        {item.status === 'processing' ? '…' : 'N/A'}
                      </div>
                    {/if}
                    <div class="min-w-0 space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="truncate font-medium">
                          {item.project_name ?? `Project #${item.project_id}`}
                          · index {item.index ?? 'orphan'}{item.shloka_num != null
                            ? `:${item.shloka_num}`
                            : ''}
                        </p>
                        <Badge variant={IMAGE_BATCH_STATUS_VARIANTS[item.status]}>
                          {IMAGE_BATCH_STATUS_LABELS[item.status]}
                        </Badge>
                        {#if item.auto_approved}
                          <Badge variant="outline">Auto-apply</Badge>
                        {/if}
                      </div>
                      <p class="text-xs text-muted-foreground">{item.path}</p>
                      <p class="truncate text-xs text-muted-foreground">{item.custom_id}</p>
                      {#if origin_href(item)}
                        <a
                          href={origin_href(item)!}
                          class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Open in app
                          <Icon src={OiLinkExternal16} class="text-sm" />
                        </a>
                      {/if}
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    {#if item.status === 'ready_for_review'}
                      <Button size="sm" onclick={() => (review_item = item)}>Review</Button>
                    {/if}
                    {#if can_discard(item)}
                      <Button
                        size="sm"
                        variant="destructive"
                        onclick={() => (discard_item = item)}
                        disabled={discard_mut.isPending}
                      >
                        Discard
                      </Button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      {/each}
    </Accordion.Root>
  {/if}
</div>

<Dialog.Root
  open={!!review_item}
  onOpenChange={(v) => {
    if (!v) review_item = null;
  }}
>
  <Dialog.Content class="max-w-2xl">
    {#if review_item}
      <Dialog.Header>
        <Dialog.Title>Review generated image</Dialog.Title>
        <Dialog.Description>
          {review_item.project_name} · index {review_item.index ?? 'orphan'}
        </Dialog.Description>
      </Dialog.Header>
      {#if review_item.image_asset}
        <img
          src={review_item.image_asset.url}
          alt={review_item.metadata.image_prompt}
          class="mx-auto max-h-[50vh] rounded-md border object-contain"
        />
      {/if}
      <p class="text-sm text-muted-foreground">{review_item.metadata.image_prompt}</p>
      <Dialog.Footer class="gap-2">
        <Button
          variant="destructive"
          onclick={() => {
            discard_item = review_item;
          }}
          disabled={approve_mut.isPending || discard_mut.isPending}
        >
          Discard
        </Button>
        <Button
          onclick={() => review_item && approve_mut.mutate(review_item)}
          disabled={approve_mut.isPending || !review_item.image_asset}
        >
          {approve_mut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
  open={!!discard_item}
  onOpenChange={(v) => {
    if (!v) discard_item = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Discard batch item?</AlertDialog.Title>
      <AlertDialog.Description>
        This removes the staging row and deletes any uploaded image asset.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={discard_mut.isPending}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={discard_mut.isPending || !discard_item}
        onclick={() => discard_item && discard_mut.mutate(discard_item)}
      >
        {discard_mut.isPending ? 'Discarding…' : 'Discard'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
