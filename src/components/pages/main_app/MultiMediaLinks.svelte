<script lang="ts">
  import { CgAdd } from 'svelte-icons-pack/cg';
  import { client_q } from '~/api/client';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import { user_info } from '~/state/user.svelte';
  import Icon from '~/tools/Icon.svelte';

  let { multimedia_popover_state = $bindable() }: { multimedia_popover_state: boolean } = $props();

  const media_list_q = client_q.media.get_media_list.query({
    project_id: $project_state.project_id!,
    selected_text_levels: $selected_text_levels
  });
</script>

<div class="space-y-1">
  {#if $media_list_q.isFetching}
    <div class="h-15 placeholder w-30 animate-pulse"></div>
  {:else if !$media_list_q.isFetching && $media_list_q.isSuccess}
    {@const media_list = $media_list_q.data}
    {#if media_list.length === 0}
      <div class="text-sm text-yellow-600 dark:text-amber-500">No multimedia links found</div>
    {/if}
    {#if $user_info && $user_info.role === 'admin'}
      <button
        onclick={() => {
          multimedia_popover_state = false;
        }}
        class="m-0 btn block rounded-md p-1 text-sm"
      >
        <Icon src={CgAdd} class="text-xl " />
        Add Links
      </button>
    {/if}
  {/if}
</div>
