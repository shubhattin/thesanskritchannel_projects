<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { Badge } from '$lib/components/ui/badge';
  import { client } from '~/api/client';
  import {
    project_state,
    selected_text_levels,
    selected_translation_lang_ids,
    text_data_present
  } from '~/state/main_app/state.svelte';
  import {
    TRANSLATION_BATCH_STATUS_LABELS,
    TRANSLATION_BATCH_STATUS_VARIANTS,
    type TranslationBatchUiStatus
  } from '~/utils/ai_batch/batch_translation_status';
  import { get_lang_from_id } from '~/state/lang_list';
  import Icon from '~/tools/Icon.svelte';
  import { OiLinkExternal16 } from 'svelte-icons-pack/oi';

  const ACTIVE_STATUSES: ReadonlySet<TranslationBatchUiStatus> = new Set([
    'processing',
    'auto_applying',
    'ready_for_review'
  ]);

  const lang_ids = $derived([
    ...new Set($selected_translation_lang_ids.filter((id): id is number => id !== null))
  ]);

  const status_q = createQuery(() => ({
    queryKey: [
      'translation_batch_status_banner',
      $project_state?.project_id ?? null,
      lang_ids,
      $selected_text_levels
    ],
    queryFn: async () => {
      if (!$project_state || lang_ids.length === 0) return [];
      const results = await Promise.all(
        lang_ids.map(async (lang_id) => {
          const status = await client.batch_ai_image.get_text_translation_batch_status.query({
            project_id: $project_state!.project_id,
            lang_id,
            selected_text_levels: $selected_text_levels
          });
          return status ? { lang_id, status } : null;
        })
      );
      return results.filter((row): row is NonNullable<typeof row> => row !== null);
    },
    enabled: !!$project_state && $text_data_present && lang_ids.length > 0,
    staleTime: 20_000,
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      const has_running = rows.some(
        (row) => row.status.status === 'processing' || row.status.status === 'auto_applying'
      );
      return has_running ? 30_000 : false;
    }
  }));

  const visible_rows = $derived(
    (status_q.data ?? []).filter((row) => ACTIVE_STATUSES.has(row.status.status))
  );
</script>

{#if visible_rows.length > 0}
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    {#each visible_rows as row (row.status.custom_id)}
      <div class="flex flex-wrap items-center gap-1.5">
        <Badge variant={TRANSLATION_BATCH_STATUS_VARIANTS[row.status.status]}>
          {TRANSLATION_BATCH_STATUS_LABELS[row.status.status]}
          · {get_lang_from_id(row.lang_id)}
        </Badge>
      </div>
    {/each}
    <a
      class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      href="/batch-manager"
      target="_blank"
      rel="noopener noreferrer"
    >
      Batch Manager
      <Icon src={OiLinkExternal16} class="text-sm" />
    </a>
  </div>
{/if}
