<script lang="ts">
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import { CgAdd } from 'svelte-icons-pack/cg';
  import { client_q } from '~/api/client';
  import { MultimediaIcon } from '~/components/icons';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import { user_info } from '~/state/user.svelte';
  import Icon from '~/tools/Icon.svelte';

  const media_list_q = client_q.media.get_media_list.query({
    project_id: $project_state.project_id!,
    selected_text_levels: $selected_text_levels
  });

  let multimedia_popover_state = $state(false);
</script>

<Popover
  open={multimedia_popover_state}
  onOpenChange={(e) => (multimedia_popover_state = e.open)}
  positioning={{ placement: 'bottom' }}
  arrow={false}
  contentBase={'card z-70 space-y-1 p-1.5 rounded-lg shadow-xl dark:bg-surface-900 bg-zinc-100 text-sm'}
>
  {#snippet trigger()}
    <span class="m-0 btn p-0 outline-none select-none">
      <Icon src={MultimediaIcon} class="text-2xl text-orange-500 sm:text-3xl dark:text-amber-200" />
    </span>
  {/snippet}
  {#snippet content()}
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
          class="m-0 btn block rounded-md p-1 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Icon src={CgAdd} class="text-xl " />
          Add Links
        </button>
      {/if}
    {/if}
  {/snippet}
</Popover>
