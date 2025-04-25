<script lang="ts">
  import { client_q } from '~/api/client';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
  import { get_path_params } from '~/state/project_list';
  import { selected_text_levels, project_state } from '~/state/main_app/state.svelte';

  const current_text_cache_invalidate_mut = client_q.cache.invalidate_cache.mutation({
    onSuccess() {
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  });

  let invalidate_cache_confirm_modal_state = $state(false);

  let current_cache_key = $derived(
    REDIS_CACHE_KEYS_CLIENT.text_data(
      $project_state.project_id!,
      get_path_params($selected_text_levels, $project_state.levels)
    )
  );
</script>

<div class="text-center text-lg font-bold text-amber-700 dark:text-warning-500">
  Cache Invalidation Tool
</div>
<div class="space-y-2">
  <button
    class="btn bg-surface-600 px-2 py-0.5 text-sm font-semibold text-white dark:bg-surface-600"
    onclick={() => {
      invalidate_cache_confirm_modal_state = true;
    }}>Invalidate Text Cache (Current)</button
  >
</div>
<ConfirmModal
  bind:popup_state={invalidate_cache_confirm_modal_state}
  close_on_confirm={true}
  title="Sure to Invalidate Cache ?"
  body_text={() => {
    const path_params = get_path_params($selected_text_levels, $project_state.levels).join('.');
    return `This will invalidate the text data cache for "${current_cache_key}" `;
  }}
  confirm_func={async () => {
    await $current_text_cache_invalidate_mut.mutateAsync({
      cache_keys: [current_cache_key]
    });
  }}
></ConfirmModal>
