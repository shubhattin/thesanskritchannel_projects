<script lang="ts">
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import { client } from '~/api/client';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Select from '$lib/components/ui/select';
  import * as Tabs from '$lib/components/ui/tabs';
  import {
    IMAGE_BATCH_STATUS_LABELS,
    IMAGE_BATCH_STATUS_VARIANTS
  } from '~/utils/ai_batch/batch_image_status';
  import {
    TRANSLATION_BATCH_STATUS_LABELS,
    TRANSLATION_BATCH_STATUS_VARIANTS
  } from '~/utils/ai_batch/batch_translation_status';
  import {
    invalidate_batch_ai_queries,
    invalidate_text_image_queries,
    invalidate_translation_content_queries
  } from '~/state/main_app/batch_query_helpers';
  import Icon from '~/tools/Icon.svelte';
  import { OiSync16, OiLinkExternal16 } from 'svelte-icons-pack/oi';

  type ImageGroup = Awaited<
    ReturnType<typeof client.batch_ai_image.get_batch_manager_groups.query>
  >[number];
  type ImageItem = ImageGroup['items'][number];
  type TranslationGroup = Awaited<
    ReturnType<typeof client.batch_ai_text.get_text_translation_batch_manager_groups.query>
  >[number];
  type TranslationItem = TranslationGroup['items'][number];

  let project_filter = $state<string>('all');
  let active_tab = $state<'images' | 'translations'>('images');
  let review_image_item = $state<ImageItem | null>(null);
  let discard_image_item = $state<ImageItem | null>(null);
  let discard_image_batch_id = $state<string | null>(null);
  let review_translation_item = $state<TranslationItem | null>(null);
  let discard_translation_item = $state<TranslationItem | null>(null);
  let discard_translation_batch_id = $state<string | null>(null);
  let retry_image_batch_id = $state<string | null>(null);
  let retry_translation_batch_id = $state<string | null>(null);
  let polling_image_batch_id = $state<string | null>(null);
  let polling_translation_batch_id = $state<string | null>(null);

  const image_groups_q = createQuery(() => ({
    queryKey: ['batch_manager_groups', project_filter],
    queryFn: () =>
      client.batch_ai_image.get_batch_manager_groups.query(
        project_filter === 'all' ? undefined : { project_id: Number(project_filter) }
      ),
    staleTime: 90_000,
    refetchOnWindowFocus: false
  }));

  const translation_groups_q = createQuery(() => ({
    queryKey: ['translation_batch_manager_groups', project_filter],
    queryFn: () =>
      client.batch_ai_text.get_text_translation_batch_manager_groups.query(
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

  const poll_image_mut = createMutation(() => ({
    mutationFn: (batch_id: string) => {
      polling_image_batch_id = batch_id;
      return client.batch_ai_image.poll_batch_shloka_image_gen.mutate({ batch_id });
    },
    onSuccess: async (data) => {
      await invalidate_batch_ai_queries();
      await image_groups_q.refetch();
      if (data.status === 'processed' || data.status === 'terminal_failure') {
        toast.success(data.message || 'Batch updated');
      } else {
        toast.success(data.message || 'Batch polled');
      }
    },
    onError: (err) => toast.error(err.message || 'Failed to poll batch'),
    onSettled: (_data, _err, batch_id) => {
      if (polling_image_batch_id === batch_id) polling_image_batch_id = null;
    }
  }));

  const poll_translation_mut = createMutation(() => ({
    mutationFn: (batch_id: string) => {
      polling_translation_batch_id = batch_id;
      return client.batch_ai_image.poll_batch_text_translation.mutate({ batch_id });
    },
    onSuccess: async (data) => {
      await invalidate_batch_ai_queries();
      await translation_groups_q.refetch();
      if (data.status === 'processed' || data.status === 'terminal_failure') {
        toast.success(data.message || 'Batch updated');
      } else {
        toast.success(data.message || 'Batch polled');
      }
    },
    onError: (err) => toast.error(err.message || 'Failed to poll batch'),
    onSettled: (_data, _err, batch_id) => {
      if (polling_translation_batch_id === batch_id) polling_translation_batch_id = null;
    }
  }));

  const approve_image_mut = createMutation(() => ({
    mutationFn: (item: ImageItem) =>
      client.batch_ai_image.approve_shloka_image.mutate({
        batch_id: item.batch_id,
        custom_id: item.custom_id
      }),
    onSuccess: async () => {
      await Promise.all([invalidate_batch_ai_queries(), invalidate_text_image_queries()]);
      toast.success('Image saved to project path');
      review_image_item = null;
    },
    onError: (err) => toast.error(err.message || 'Failed to approve image')
  }));

  const discard_image_mut = createMutation(() => ({
    mutationFn: (item: ImageItem) =>
      client.batch_ai_image.discard_shloka_image_batch_response.mutate({
        batch_id: item.batch_id,
        custom_id: item.custom_id
      }),
    onSuccess: async () => {
      await invalidate_batch_ai_queries();
      toast.success('Batch item discarded');
      discard_image_item = null;
      review_image_item = null;
    },
    onError: (err) => toast.error(err.message || 'Failed to discard item')
  }));

  const discard_image_batch_mut = createMutation(() => ({
    mutationFn: (batch_id: string) =>
      client.batch_ai_image.discard_shloka_image_batch.mutate({ batch_id }),
    onSuccess: async () => {
      await invalidate_batch_ai_queries();
      toast.success('Batch discarded');
      discard_image_batch_id = null;
      review_image_item = null;
      await image_groups_q.refetch();
    },
    onError: (err) => toast.error(err.message || 'Failed to discard batch')
  }));

  const approve_translation_mut = createMutation(() => ({
    mutationFn: (item: TranslationItem) =>
      client.batch_ai_image.approve_text_translation.mutate({
        batch_id: item.batch_id,
        custom_id: item.custom_id
      }),
    onSuccess: async (_data, item) => {
      await Promise.all([
        invalidate_batch_ai_queries(),
        invalidate_translation_content_queries({
          project_id: item.project_id,
          lang_id: item.lang_id
        })
      ]);
      toast.success('Translations saved');
      review_translation_item = null;
      await translation_groups_q.refetch();
    },
    onError: (err) => toast.error(err.message || 'Failed to approve translations')
  }));

  const discard_translation_mut = createMutation(() => ({
    mutationFn: (item: TranslationItem) =>
      client.batch_ai_image.discard_text_translation_batch_response.mutate({
        batch_id: item.batch_id,
        custom_id: item.custom_id
      }),
    onSuccess: async () => {
      await invalidate_batch_ai_queries();
      toast.success('Batch item discarded');
      discard_translation_item = null;
      review_translation_item = null;
      await translation_groups_q.refetch();
    },
    onError: (err) => toast.error(err.message || 'Failed to discard item')
  }));

  const discard_translation_batch_mut = createMutation(() => ({
    mutationFn: (batch_id: string) =>
      client.batch_ai_image.discard_text_translation_batch.mutate({ batch_id }),
    onSuccess: async () => {
      await invalidate_batch_ai_queries();
      toast.success('Batch discarded');
      discard_translation_batch_id = null;
      review_translation_item = null;
      await translation_groups_q.refetch();
    },
    onError: (err) => toast.error(err.message || 'Failed to discard batch')
  }));

  const retry_image_batch_mut = createMutation(() => ({
    mutationFn: (batch_id: string) =>
      client.batch_ai_image.retry_failed_shloka_image_batch.mutate({ batch_id }),
    onSuccess: async (data) => {
      await invalidate_batch_ai_queries();
      toast.success(
        `Retried ${data.item_count} item(s) as batch ${data.batch_id}${
          data.source_cleaned ? '' : ' (old batch cleanup failed — discard manually)'
        }`
      );
      retry_image_batch_id = null;
      await image_groups_q.refetch();
    },
    onError: (err) => toast.error(err.message || 'Failed to retry batch')
  }));

  const retry_translation_batch_mut = createMutation(() => ({
    mutationFn: (batch_id: string) =>
      client.batch_ai_image.retry_failed_text_translation_batch.mutate({ batch_id }),
    onSuccess: async (data) => {
      await invalidate_batch_ai_queries();
      toast.success(
        `Retried ${data.item_count} item(s) as batch ${data.batch_id}${
          data.source_cleaned ? '' : ' (old batch cleanup failed — discard manually)'
        }`
      );
      retry_translation_batch_id = null;
      await translation_groups_q.refetch();
    },
    onError: (err) => toast.error(err.message || 'Failed to retry batch')
  }));

  const can_discard_image = (item: ImageItem) =>
    item.status === 'processing' || item.status === 'ready_for_review' || item.status === 'failed';

  const can_discard_translation = (item: TranslationItem) =>
    item.status === 'processing' || item.status === 'ready_for_review' || item.status === 'failed';

  /** Same gate for discard-all and retry: resolved + only failed rows remain. */
  const can_retry_or_discard_failed_batch = (group: {
    output_resolved: boolean;
    counts: { failed: number; ready: number; pending: number };
  }) =>
    group.output_resolved &&
    group.counts.failed > 0 &&
    group.counts.ready === 0 &&
    group.counts.pending === 0;

  const can_discard_batch = can_retry_or_discard_failed_batch;
  const can_retry_batch = can_retry_or_discard_failed_batch;

  const is_discarding_image_item = (item: ImageItem | null) =>
    !!item &&
    discard_image_mut.isPending &&
    discard_image_mut.variables?.batch_id === item.batch_id &&
    discard_image_mut.variables?.custom_id === item.custom_id;

  const is_discarding_translation_item = (item: TranslationItem | null) =>
    !!item &&
    discard_translation_mut.isPending &&
    discard_translation_mut.variables?.batch_id === item.batch_id &&
    discard_translation_mut.variables?.custom_id === item.custom_id;

  const format_batch_error = (error: unknown): string | null => {
    if (error == null) return null;
    if (typeof error === 'string') return error;
    if (typeof error !== 'object') return String(error);
    const e = error as Record<string, unknown>;
    const parts = [e.reason, e.message, e.openai_status, e.code]
      .filter((v) => v != null && v !== '')
      .map(String);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const origin_href = (item: { project_key: string | null; path: string | null }) => {
    if (!item.project_key) return null;
    const path = item.path ? `/${item.path.split(':').join('/')}` : '';
    return `/${item.project_key}${path}`;
  };

  const image_groups = $derived(image_groups_q.data ?? []);
  const translation_groups = $derived(translation_groups_q.data ?? []);
  let open_image_batches = $state<string[]>([]);
  let open_translation_batches = $state<string[]>([]);
  let did_init_image_open = $state(false);
  let did_init_translation_open = $state(false);
  $effect(() => {
    if (did_init_image_open || image_groups.length === 0) return;
    open_image_batches = [image_groups[0]!.batch_id];
    did_init_image_open = true;
  });
  $effect(() => {
    if (did_init_translation_open || translation_groups.length === 0) return;
    open_translation_batches = [translation_groups[0]!.batch_id];
    did_init_translation_open = true;
  });

  const translated_by_index = $derived.by(() => {
    const map = new Map<number, string>();
    for (const row of review_translation_item?.translated_data ?? []) {
      map.set(row.index, row.text);
    }
    return map;
  });
</script>

<div class="mx-auto max-w-5xl space-y-4 px-3 py-6 sm:px-6">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold">Batch Manager</h1>
      <p class="text-sm text-muted-foreground">
        Inspect ongoing AI image and translation batches, poll locally, and review or discard staged
        results.
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
        disabled={image_groups_q.isFetching || translation_groups_q.isFetching}
        onclick={() => void Promise.all([image_groups_q.refetch(), translation_groups_q.refetch()])}
      >
        <Icon
          src={OiSync16}
          class={image_groups_q.isFetching || translation_groups_q.isFetching ? 'animate-spin' : ''}
        />
        Refresh
      </Button>
    </div>
  </div>

  <Tabs.Root bind:value={active_tab} class="space-y-4">
    <Tabs.List>
      <Tabs.Trigger value="images">Images ({image_groups.length})</Tabs.Trigger>
      <Tabs.Trigger value="translations">Translations ({translation_groups.length})</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="images" class="space-y-4">
      {#if image_groups_q.isLoading}
        <div class="flex flex-col gap-3">
          {#each Array(3) as _, i (i)}
            <Skeleton class="h-16 w-full rounded-xl" />
          {/each}
        </div>
      {:else if image_groups_q.isError}
        <div class="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <p class="font-medium text-destructive">Failed to load image batch jobs</p>
          <p class="mt-1 text-sm text-muted-foreground">{image_groups_q.error.message}</p>
          <Button class="mt-4" onclick={() => void image_groups_q.refetch()}>Try again</Button>
        </div>
      {:else if image_groups.length === 0}
        <div class="rounded-xl border border-dashed border-border p-8 text-center">
          <p class="font-medium">No active batch image jobs</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Queue background generation from the AI Image Generator.
          </p>
        </div>
      {:else}
        <Accordion.Root type="multiple" bind:value={open_image_batches} class="flex flex-col gap-3">
          {#each image_groups as group (group.batch_id)}
            <Accordion.Item value={group.batch_id} class="rounded-xl border border-border px-4">
              <Accordion.Trigger class="py-4 hover:no-underline">
                <div
                  class="flex w-full flex-col gap-2 pr-2 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="space-y-1">
                    <p class="font-semibold">Batch {group.batch_id}</p>
                    <p class="text-xs text-muted-foreground">
                      {group.items.length} item(s) · image
                    </p>
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
                  {#if can_retry_batch(group)}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={retry_image_batch_mut.isPending &&
                        retry_image_batch_mut.variables === group.batch_id}
                      onclick={() => (retry_image_batch_id = group.batch_id)}
                    >
                      Retry failed tasks
                    </Button>
                  {/if}
                  {#if can_discard_batch(group)}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={discard_image_batch_mut.isPending &&
                        discard_image_batch_mut.variables === group.batch_id}
                      onclick={() => (discard_image_batch_id = group.batch_id)}
                    >
                      Discard batch
                    </Button>
                  {/if}
                  <Button
                    size="sm"
                    variant="outline"
                    class="gap-2"
                    disabled={polling_image_batch_id === group.batch_id}
                    onclick={() => poll_image_mut.mutate(group.batch_id)}
                  >
                    <Icon
                      src={OiSync16}
                      class={polling_image_batch_id === group.batch_id ? 'animate-spin' : ''}
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
                          {#if item.status === 'failed' && format_batch_error(item.metadata.error)}
                            <p class="text-xs text-destructive">
                              {format_batch_error(item.metadata.error)}
                            </p>
                          {/if}
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
                          <Button size="sm" onclick={() => (review_image_item = item)}
                            >Review</Button
                          >
                        {/if}
                        {#if can_discard_image(item)}
                          <Button
                            size="sm"
                            variant="destructive"
                            onclick={() => (discard_image_item = item)}
                            disabled={is_discarding_image_item(item)}
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
    </Tabs.Content>

    <Tabs.Content value="translations" class="space-y-4">
      {#if translation_groups_q.isLoading}
        <div class="flex flex-col gap-3">
          {#each Array(3) as _, i (i)}
            <Skeleton class="h-16 w-full rounded-xl" />
          {/each}
        </div>
      {:else if translation_groups_q.isError}
        <div class="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <p class="font-medium text-destructive">Failed to load translation batch jobs</p>
          <p class="mt-1 text-sm text-muted-foreground">{translation_groups_q.error.message}</p>
          <Button class="mt-4" onclick={() => void translation_groups_q.refetch()}>Try again</Button
          >
        </div>
      {:else if translation_groups.length === 0}
        <div class="rounded-xl border border-dashed border-border p-8 text-center">
          <p class="font-medium">No active batch translation jobs</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Queue background translation from Translate with AI or Batch Translate.
          </p>
        </div>
      {:else}
        <Accordion.Root
          type="multiple"
          bind:value={open_translation_batches}
          class="flex flex-col gap-3"
        >
          {#each translation_groups as group (group.batch_id)}
            <Accordion.Item value={group.batch_id} class="rounded-xl border border-border px-4">
              <Accordion.Trigger class="py-4 hover:no-underline">
                <div
                  class="flex w-full flex-col gap-2 pr-2 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="space-y-1">
                    <p class="font-semibold">Batch {group.batch_id}</p>
                    <p class="text-xs text-muted-foreground">
                      {group.items.length} item(s) · translation
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Badge variant="secondary">Pending {group.counts.pending}</Badge>
                    <Badge>Ready {group.counts.ready}</Badge>
                    <Badge variant="destructive">Failed {group.counts.failed}</Badge>
                    {#if group.counts.auto_approved > 0}
                      <Badge variant="outline">Auto-save {group.counts.auto_approved}</Badge>
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
                  {#if can_retry_batch(group)}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={retry_translation_batch_mut.isPending &&
                        retry_translation_batch_mut.variables === group.batch_id}
                      onclick={() => (retry_translation_batch_id = group.batch_id)}
                    >
                      Retry failed tasks
                    </Button>
                  {/if}
                  {#if can_discard_batch(group)}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={discard_translation_batch_mut.isPending &&
                        discard_translation_batch_mut.variables === group.batch_id}
                      onclick={() => (discard_translation_batch_id = group.batch_id)}
                    >
                      Discard batch
                    </Button>
                  {/if}
                  <Button
                    size="sm"
                    variant="outline"
                    class="gap-2"
                    disabled={polling_translation_batch_id === group.batch_id}
                    onclick={() => poll_translation_mut.mutate(group.batch_id)}
                  >
                    <Icon
                      src={OiSync16}
                      class={polling_translation_batch_id === group.batch_id ? 'animate-spin' : ''}
                    />
                    Poll now
                  </Button>
                </div>

                <div class="flex flex-col gap-3">
                  {#each group.items as item (item.custom_id)}
                    <div
                      class="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <p class="truncate font-medium">
                            {item.project_name ?? `Project #${item.project_id}`}
                            · {item.lang_name ?? `lang ${item.lang_id}`}
                          </p>
                          <Badge variant={TRANSLATION_BATCH_STATUS_VARIANTS[item.status]}>
                            {TRANSLATION_BATCH_STATUS_LABELS[item.status]}
                          </Badge>
                          {#if item.auto_approved}
                            <Badge variant="outline">Auto-save</Badge>
                          {/if}
                        </div>
                        <p class="text-xs text-muted-foreground">{item.path}</p>
                        <p class="text-xs text-muted-foreground">
                          {item.metadata.source_indexes.length} line(s)
                        </p>
                        <p class="truncate text-xs text-muted-foreground">{item.custom_id}</p>
                        {#if item.status === 'failed' && format_batch_error(item.metadata.error)}
                          <p class="text-xs text-destructive">
                            {format_batch_error(item.metadata.error)}
                          </p>
                        {/if}
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
                      <div class="flex flex-wrap gap-2">
                        {#if item.status === 'ready_for_review'}
                          <Button size="sm" onclick={() => (review_translation_item = item)}
                            >Review</Button
                          >
                        {/if}
                        {#if can_discard_translation(item)}
                          <Button
                            size="sm"
                            variant="destructive"
                            onclick={() => (discard_translation_item = item)}
                            disabled={is_discarding_translation_item(item)}
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
    </Tabs.Content>
  </Tabs.Root>
</div>

<Dialog.Root
  open={!!review_image_item}
  onOpenChange={(v) => {
    if (!v) review_image_item = null;
  }}
>
  <Dialog.Content class="max-w-2xl">
    {#if review_image_item}
      <Dialog.Header>
        <Dialog.Title>Review generated image</Dialog.Title>
        <Dialog.Description>
          {review_image_item.project_name} · index {review_image_item.index ?? 'orphan'}
        </Dialog.Description>
      </Dialog.Header>
      {#if review_image_item.image_asset}
        <img
          src={review_image_item.image_asset.url}
          alt={review_image_item.metadata.image_prompt}
          class="mx-auto max-h-[50vh] rounded-md border object-contain"
        />
      {/if}
      <p class="text-sm text-muted-foreground">{review_image_item.metadata.image_prompt}</p>
      <Dialog.Footer class="gap-2">
        <Button
          variant="destructive"
          onclick={() => {
            discard_image_item = review_image_item;
          }}
          disabled={approve_image_mut.isPending || is_discarding_image_item(review_image_item)}
        >
          Discard
        </Button>
        <Button
          onclick={() => review_image_item && approve_image_mut.mutate(review_image_item)}
          disabled={approve_image_mut.isPending || !review_image_item.image_asset}
        >
          {approve_image_mut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root
  open={!!review_translation_item}
  onOpenChange={(v) => {
    if (!v) review_translation_item = null;
  }}
>
  <Dialog.Content class="flex max-h-[90vh] max-w-3xl flex-col gap-4">
    {#if review_translation_item}
      <Dialog.Header>
        <Dialog.Title>Review generated translations</Dialog.Title>
        <Dialog.Description>
          {review_translation_item.project_name} · {review_translation_item.lang_name} · {review_translation_item.path}
        </Dialog.Description>
      </Dialog.Header>
      <ScrollArea class="h-[min(60vh,32rem)] rounded-md border p-3">
        <div class="flex flex-col gap-4">
          {#each review_translation_item.source_texts as source (source.index)}
            <div class="space-y-1.5 rounded-md border border-border/70 p-3">
              <p class="text-xs font-medium text-muted-foreground">
                Index {source.index}{source.shloka_num != null
                  ? ` · Shloka ${source.shloka_num}`
                  : ''}
              </p>
              <p class="text-sm leading-relaxed whitespace-pre-wrap">{source.text}</p>
              <p class="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {translated_by_index.get(source.index) ?? '—'}
              </p>
            </div>
          {/each}
        </div>
      </ScrollArea>
      <Dialog.Footer class="gap-2">
        <Button
          variant="destructive"
          onclick={() => {
            discard_translation_item = review_translation_item;
          }}
          disabled={approve_translation_mut.isPending ||
            is_discarding_translation_item(review_translation_item)}
        >
          Discard
        </Button>
        <Button
          onclick={() =>
            review_translation_item && approve_translation_mut.mutate(review_translation_item)}
          disabled={approve_translation_mut.isPending ||
            !review_translation_item.translated_data?.length}
        >
          {approve_translation_mut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
  open={!!discard_image_item}
  onOpenChange={(v) => {
    if (!v) discard_image_item = null;
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
      <AlertDialog.Cancel disabled={discard_image_mut.isPending}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={discard_image_mut.isPending || !discard_image_item}
        onclick={() => discard_image_item && discard_image_mut.mutate(discard_image_item)}
      >
        {discard_image_mut.isPending ? 'Discarding…' : 'Discard'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
  open={!!discard_image_batch_id}
  onOpenChange={(v) => {
    if (!v) discard_image_batch_id = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Discard entire image batch?</AlertDialog.Title>
      <AlertDialog.Description>
        Removes all staging rows, deletes any uploaded image assets, and cleans up OpenAI
        input/output files.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={discard_image_batch_mut.isPending}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={discard_image_batch_mut.isPending || !discard_image_batch_id}
        onclick={() =>
          discard_image_batch_id && discard_image_batch_mut.mutate(discard_image_batch_id)}
      >
        {discard_image_batch_mut.isPending ? 'Discarding…' : 'Discard batch'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
  open={!!discard_translation_item}
  onOpenChange={(v) => {
    if (!v) discard_translation_item = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Discard translation batch item?</AlertDialog.Title>
      <AlertDialog.Description>
        This removes the staged translations without writing them to the project.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={discard_translation_mut.isPending}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={discard_translation_mut.isPending || !discard_translation_item}
        onclick={() =>
          discard_translation_item && discard_translation_mut.mutate(discard_translation_item)}
      >
        {discard_translation_mut.isPending ? 'Discarding…' : 'Discard'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
  open={!!discard_translation_batch_id}
  onOpenChange={(v) => {
    if (!v) discard_translation_batch_id = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Discard entire translation batch?</AlertDialog.Title>
      <AlertDialog.Description>
        Removes all staging rows for this batch and cleans up OpenAI input/output files.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={discard_translation_batch_mut.isPending}
        >Cancel</AlertDialog.Cancel
      >
      <AlertDialog.Action
        disabled={discard_translation_batch_mut.isPending || !discard_translation_batch_id}
        onclick={() =>
          discard_translation_batch_id &&
          discard_translation_batch_mut.mutate(discard_translation_batch_id)}
      >
        {discard_translation_batch_mut.isPending ? 'Discarding…' : 'Discard batch'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
  open={!!retry_image_batch_id}
  onOpenChange={(v) => {
    if (!v) retry_image_batch_id = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Retry failed image tasks?</AlertDialog.Title>
      <AlertDialog.Description>
        Creates a new OpenAI batch from these failed items using the current default image model,
        then deletes this failed batch and its OpenAI input/output files.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={retry_image_batch_mut.isPending}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={retry_image_batch_mut.isPending || !retry_image_batch_id}
        onclick={() => retry_image_batch_id && retry_image_batch_mut.mutate(retry_image_batch_id)}
      >
        {retry_image_batch_mut.isPending ? 'Retrying…' : 'Retry failed tasks'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
  open={!!retry_translation_batch_id}
  onOpenChange={(v) => {
    if (!v) retry_translation_batch_id = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Retry failed translation tasks?</AlertDialog.Title>
      <AlertDialog.Description>
        Creates a new OpenAI batch from these failed paths using the current default text model
        (prompts rebuilt from current source text), then deletes this failed batch and its OpenAI
        input/output files.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={retry_translation_batch_mut.isPending}
        >Cancel</AlertDialog.Cancel
      >
      <AlertDialog.Action
        disabled={retry_translation_batch_mut.isPending || !retry_translation_batch_id}
        onclick={() =>
          retry_translation_batch_id &&
          retry_translation_batch_mut.mutate(retry_translation_batch_id)}
      >
        {retry_translation_batch_mut.isPending ? 'Retrying…' : 'Retry failed tasks'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
