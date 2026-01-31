<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Popover from '$lib/components/ui/popover';
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

<Popover.Root bind:open={multimedia_popover_state}>
  <Popover.Trigger class="p-0 outline-none select-none">
    <Icon src={MultimediaIcon} class="text-2xl text-orange-600 sm:text-3xl dark:text-amber-200" />
  </Popover.Trigger>
  <Popover.Content side="bottom" class="w-auto space-y-1 p-1.5">
    {#if $media_list_q.isFetching}
      <div class="h-15 w-30 animate-pulse rounded bg-muted"></div>
    {:else if !$media_list_q.isFetching && $media_list_q.isSuccess}
      {@const media_list = $media_list_q.data}
      {#if media_list.length === 0}
        <div class="text-amber-600 dark:text-amber-500">No multimedia links found</div>
      {:else}
        <div class="space-y-0">
          {#each media_list as media (media.id)}
            <span class="group block space-x-1 rounded-md p-1 hover:bg-muted">
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
                  class="inline-block p-0"
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
          class="block rounded-md p-1 hover:bg-muted"
        >
          <Icon src={CgAdd} class="text-xl" />
          Add Links
        </button>
      {/if}
    {/if}
  </Popover.Content>
</Popover.Root>

<Dialog.Root bind:open={link_add_modal_opened}>
  <Dialog.Content class="max-w-md">
    <AddMediaLinks bind:modal_open_state={link_add_modal_opened} />
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={link_edit_modal_opened}>
  <Dialog.Content class="max-w-md">
    <EditMediaLink bind:modal_open_state={link_edit_modal_opened} link_info={selected_edit_item!} />
  </Dialog.Content>
</Dialog.Root>
