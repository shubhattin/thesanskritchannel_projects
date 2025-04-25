<script lang="ts">
  import { client_q } from '~/api/client';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
  import { get_path_params } from '~/state/project_list';
  import { selected_text_levels, project_state } from '~/state/main_app/state.svelte';
  import { get_argument_names } from '~/tools/kry';
  import { writable } from 'svelte/store';

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

  let selected_cache_name: keyof typeof REDIS_CACHE_KEYS_CLIENT = $state('text_data');
  let cache_arguments = writable<(string | null)[]>([]);

  $effect(() => {
    selected_cache_name;
    $cache_arguments = Array.from(
      { length: get_argument_names(REDIS_CACHE_KEYS_CLIENT[selected_cache_name]).length },
      () => null
    );
  });

  const get_cache_key = (cache_name: typeof selected_cache_name) => {
    // @ts-ignore
    return REDIS_CACHE_KEYS_CLIENT[cache_name](...$cache_arguments);
  };
</script>

<div class="text-center text-lg font-bold text-amber-700 dark:text-warning-500">
  Cache Invalidation Tool
</div>
<button
  class="btn bg-surface-600 px-2 py-0.5 text-sm font-semibold text-white dark:bg-surface-600"
  onclick={() => {
    invalidate_cache_confirm_modal_state = true;
  }}>Invalidate Text Cache (Current)</button
>
<div class="space-y-2">
  <div class="mt-4 space-y-0.5">
    <span class="label-text font-semibold">Cache Name</span>
    <select class="select w-44 px-1 py-0.5 text-sm" bind:value={selected_cache_name}>
      {#each Object.entries(REDIS_CACHE_KEYS_CLIENT) as [cache_name]}
        <option value={cache_name}>{cache_name}</option>
      {/each}
    </select>
  </div>
  {@render cache_tool(selected_cache_name)}
</div>

<ConfirmModal
  bind:popup_state={invalidate_cache_confirm_modal_state}
  close_on_confirm={true}
  title="Sure to Invalidate Cache ?"
  body_text={() => {
    return `This will invalidate the text data cache for "${current_cache_key}" `;
  }}
  confirm_func={async () => {
    await $current_text_cache_invalidate_mut.mutateAsync({
      cache_keys: [current_cache_key]
    });
  }}
>
  {#snippet body()}
    This will invalidate the text data cache for <code class="font-semibold"
      >{current_cache_key}</code
    >
  {/snippet}
</ConfirmModal>

{#snippet cache_tool(cache_name: typeof selected_cache_name)}
  {@const function_args = get_argument_names(REDIS_CACHE_KEYS_CLIENT[cache_name])}
  <div class="space-y-1">
    {#each function_args as arg, i}
      <div class="flex items-center space-x-2">
        <span class="label-text font-semibold">{arg}</span>
        <input
          type="text"
          class="input w-16 px-1.5 py-0.5 text-sm ring-2"
          oninput={({ currentTarget: { value } }) => {
            $cache_arguments[i] = value;
            cache_arguments = cache_arguments;
          }}
          value={$cache_arguments[i] ?? ''}
        />
      </div>
    {/each}
  </div>
  {#if $cache_arguments.length > 0 && $cache_arguments.every((arg) => arg !== null && arg.trim() !== '')}
    {@const cache_key = get_cache_key(cache_name)}
    <div class="mt-2">
      <span class="text-sm">
        Key: <code class="font-semibold">{cache_key}</code>
      </span>
    </div>
  {/if}
{/snippet}
