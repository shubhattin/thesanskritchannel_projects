<script lang="ts">
  import { Modal, Popover } from '@skeletonlabs/skeleton-svelte';
  import { CgAdd } from 'svelte-icons-pack/cg';
  import { client_q } from '~/api/client';
  import { MultimediaIcon } from '~/components/icons';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import { user_info } from '~/state/user.svelte';
  import Icon from '~/tools/Icon.svelte';
  import AddMediaLinks from './AddMediaLink.svelte';
  import { type media_list_type } from './index';
  import MediaTypeIcon from './MediaTypeIcon.svelte';
  import { FiEdit2 } from 'svelte-icons-pack/fi';
  import EditMediaLink from './EditMediaLink.svelte';

  const media_list_q = $derived(
    client_q.media.get_media_list.query({
      project_id: $project_state.project_id!,
      selected_text_levels: $selected_text_levels
    })
  );

  let multimedia_popover_state = $state(false);

  let link_add_modal_opened = $state(false);
  let link_edit_modal_opened = $state(false);
  let selected_edit_item = $state<NonNullable<typeof $media_list_q.data>[0] | null>(null!);
</script>

<Popover
  open={multimedia_popover_state}
  onOpenChange={(e) => (multimedia_popover_state = e.open)}
  positioning={{ placement: 'bottom' }}
  arrow={false}
  contentBase={'card z-70 space-y-1 p-1.5 rounded-lg shadow-xl dark:bg-surface-900 bg-zinc-100 '}
>
  {#snippet trigger()}
    <span class="btn p-0 outline-none select-none">
      <Icon src={MultimediaIcon} class="text-2xl text-orange-600 sm:text-3xl dark:text-amber-200" />
    </span>
  {/snippet}
  {#snippet content()}
    {#if $media_list_q.isFetching}
      <div class="h-15 placeholder w-30 animate-pulse"></div>
    {:else if !$media_list_q.isFetching && $media_list_q.isSuccess}
      {@const media_list = $media_list_q.data}
      {#if media_list.length === 0}
        <div class=" text-yellow-700 dark:text-amber-500">No multimedia links found</div>
      {:else}
        <div class="space-y-0">
          {#each media_list as media (media.id)}
            <span
              class="group block space-x-1 rounded-md p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <a href={media.link} target="_blank" rel="noopener noreferrer" class="space-x-2">
                <MediaTypeIcon media_type={media.media_type as media_list_type} />
                <span>{media.name}</span>
              </a>
              {#if $user_info && $user_info.role === 'admin'}
                <button
                  onclick={() => {
                    multimedia_popover_state = false;
                    selected_edit_item = media;
                    link_edit_modal_opened = true;
                  }}
                  class="btn inline-block p-0"
                >
                  <Icon src={FiEdit2} class="text-xs" />
                </button>
              {/if}
            </span>
          {/each}
        </div>
      {/if}
      {#if $user_info && $user_info.role === 'admin'}
        <button
          onclick={() => {
            multimedia_popover_state = false;
            link_add_modal_opened = true;
          }}
          class="btn block rounded-md p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Icon src={CgAdd} class="text-xl " />
          Add Links
        </button>
      {/if}
    {/if}
  {/snippet}
</Popover>

<Modal
  contentBase="card z-40 space-y-2 rounded-lg px-4 py-3 shadow-xl dark:bg-surface-900 bg-stone-100"
  triggerBase="btn p-0 outline-hidden select-none"
  backdropBackground="backdrop-blur-sm"
  open={link_add_modal_opened}
  onOpenChange={(e) => (link_add_modal_opened = e.open)}
>
  {#snippet content()}
    <AddMediaLinks bind:modal_open_state={link_add_modal_opened} />
  {/snippet}
</Modal>

<Modal
  contentBase="card z-40 space-y-2 rounded-lg px-4 py-3 shadow-xl dark:bg-surface-900 bg-stone-100"
  triggerBase="btn p-0 outline-hidden select-none"
  backdropBackground="backdrop-blur-md"
  open={link_edit_modal_opened}
  onOpenChange={(e) => (link_edit_modal_opened = e.open)}
>
  {#snippet content()}
    <EditMediaLink bind:modal_open_state={link_edit_modal_opened} link_info={selected_edit_item!} />
  {/snippet}
</Modal>
