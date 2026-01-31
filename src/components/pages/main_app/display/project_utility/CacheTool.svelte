<script lang="ts">
  import { client_q } from '~/api/client';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { REDIS_CACHE_KEYS_CLIENT, REDIS_CACHES_ARGUMENTS_LIST } from '~/db/redis_shared';
  import { get_path_params } from '~/state/project_list';
  import { selected_text_levels, project_state } from '~/state/main_app/state.svelte';
  import { writable } from 'svelte/store';
  import Icon from '~/tools/Icon.svelte';
  import { BiSearchAlt } from 'svelte-icons-pack/bi';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';

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
      { length: REDIS_CACHES_ARGUMENTS_LIST[selected_cache_name].length },
      () => null
    );
  });

  const get_cache_key = (cache_name: typeof selected_cache_name) => {
    // @ts-ignore
    return REDIS_CACHE_KEYS_CLIENT[cache_name](...$cache_arguments);
  };

  let cache_arguments_valid_status = $derived(
    $cache_arguments.length > 0 &&
      $cache_arguments.every((arg) => arg !== null && arg.trim() !== '')
  );

  const list_cache_q = $derived(
    client_q.cache.list_cache_keys.query(
      {
        pattern: cache_arguments_valid_status ? get_cache_key(selected_cache_name) : ''
      },
      {
        enabled: false
      }
    )
  );

  const selected_cache_keys = writable<string[]>([]);
  $effect(() => {
    selected_cache_name;
    if (!$list_cache_q.isFetching && $list_cache_q.isSuccess) {
      $selected_cache_keys = [];
    }
  });

  const invalidate_cache_mut = client_q.cache.invalidate_cache.mutation({
    onSuccess() {
      $list_cache_q.refetch();
    }
  });
</script>

<div class="dark:text-warning-500 text-center text-lg font-bold text-amber-700">
  Cache Invalidation Tool
</div>
<Button
  variant="secondary"
  size="sm"
  onclick={() => {
    invalidate_cache_confirm_modal_state = true;
  }}
>
  Invalidate Text Cache (Current)
</Button>

<div class="space-y-2">
  <div class="mt-4 space-y-1">
    <Label for="cache-name" class="font-semibold">Cache Name</Label>
    <select
      id="cache-name"
      class="flex h-9 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      bind:value={selected_cache_name}
    >
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
  {@const function_args = REDIS_CACHES_ARGUMENTS_LIST[cache_name]}
  <div class="space-y-2">
    {#each function_args as arg, i}
      <div class="flex items-center space-x-2">
        <Label class="font-semibold">{arg}</Label>
        <Input
          type="text"
          class="w-20"
          oninput={({ currentTarget: { value } }) => {
            $cache_arguments[i] = value;
            cache_arguments = cache_arguments;
          }}
          value={$cache_arguments[i] ?? ''}
        />
      </div>
    {/each}
  </div>
  {#if cache_arguments_valid_status}
    {@const cache_key = get_cache_key(cache_name)}
    <div class="mt-2">
      <div>
        <div class="text-sm">
          Key: <code class="font-semibold">{cache_key}</code>
          <Button
            variant="ghost"
            size="sm"
            disabled={$list_cache_q.isFetching}
            onclick={() => {
              $list_cache_q.refetch();
            }}
          >
            <Icon src={BiSearchAlt} /> Search
          </Button>
        </div>
      </div>
    </div>
  {/if}
  <div class="mt-2">
    {#if $list_cache_q.isFetching}
      <div class="h-36 w-full animate-pulse rounded bg-muted"></div>
    {:else if $list_cache_q.isSuccess}
      {@const cache_list = $list_cache_q.data.sort()}
      {#if cache_list.length > 0}
        <div class="max-h-[60%] space-y-1 overflow-scroll px-0.5 text-sm">
          {#each cache_list as cache_key (cache_key)}
            <label class="flex items-center space-x-2">
              <Checkbox
                checked={$selected_cache_keys.includes(cache_key)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    $selected_cache_keys = [...$selected_cache_keys, cache_key];
                  } else {
                    $selected_cache_keys = $selected_cache_keys.filter((k) => k !== cache_key);
                  }
                }}
              />
              <span>{cache_key}</span>
            </label>
          {/each}
          <Button
            ondblclick={() => {
              $invalidate_cache_mut.mutate({
                cache_keys: $selected_cache_keys
              });
            }}
            disabled={$selected_cache_keys.length === 0 || $invalidate_cache_mut.isPending}
            class="mt-1.5"
            size="sm"
          >
            Invalidate Selected Cache
          </Button>
        </div>
      {:else}
        <div class="text-sm text-gray-500 dark:text-gray-400">No Cache Found</div>
      {/if}
    {/if}
  </div>
{/snippet}
