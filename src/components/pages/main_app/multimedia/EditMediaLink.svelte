<script lang="ts">
  import { client_q, client } from '~/api/client';
  import { MEDIA_TYPE_LIST, type media_list_type } from './index';
  import { lang_list_obj } from '~/state/lang_list';
  import { z } from 'zod';
  import Icon from '~/tools/Icon.svelte';
  import { useQueryClient } from '@tanstack/svelte-query';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import MediaTypeIcon from './MediaTypeIcon.svelte';
  import { AiOutlineDelete } from 'svelte-icons-pack/ai';
  import ConfirmPopover from '~/components/PopoverModals/ConfirmPopover.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  type link_info_type = Awaited<ReturnType<typeof client.media.get_media_list.query>>[0];

  let {
    modal_open_state = $bindable(),
    link_info
  }: {
    modal_open_state: boolean;
    link_info: link_info_type;
  } = $props();

  const quert_client = useQueryClient();

  const del_media_link_mut = client_q.media.delete_media_link.mutation({
    onSuccess() {
      quert_client.invalidateQueries({
        queryKey: [
          ['media', 'get_media_list'],
          {
            input: {
              project_id: $project_state.project_id!,
              selected_text_levels: $selected_text_levels
            },
            type: 'query'
          }
        ],
        exact: true
      });
      modal_open_state = false;
    }
  });

  const update_media_link_mut = client_q.media.update_media_link.mutation({
    onSuccess() {
      quert_client.invalidateQueries({
        queryKey: [
          ['media', 'get_media_list'],
          {
            input: {
              project_id: $project_state.project_id!,
              selected_text_levels: $selected_text_levels
            },
            type: 'query'
          }
        ],
        exact: true
      });
      modal_open_state = false;
    }
  });

  let media_type = $state<media_list_type>(link_info.media_type as media_list_type);
  let lang_id = $state(link_info.lang_id);
  let url = $state(link_info.link);
  let name = $state(link_info.name);

  $effect(() => {
    media_type = link_info.media_type as media_list_type;
    lang_id = link_info.lang_id;
    url = link_info.link;
    name = link_info.name;
  });

  const del_link_func = () => {
    $del_media_link_mut.mutate({
      project_id: $project_state.project_id!,
      selected_text_levels: $selected_text_levels,
      link_id: link_info.id
    });
  };

  const update_link_func = (e: Event) => {
    e.preventDefault();
    if (url === '' || !z.string().url().safeParse(url).success || name === '' || lang_id === 0)
      return;
    $update_media_link_mut.mutate({
      project_id: $project_state.project_id!,
      selected_text_levels: $selected_text_levels,
      media_type,
      lang_id,
      link: url,
      name,
      id: link_info.id
    });
  };
</script>

<div class="dark:text-warning-500 text-center text-lg font-bold text-amber-700">
  Edit Media Link
</div>
<form onsubmit={update_link_func} class="space-y-4">
  <div>
    <ConfirmPopover
      description="Are you sure to delete this link?"
      popup_state={false}
      placement="bottom"
      close_on_confirm={true}
      confirm_func={del_link_func}
      z_index={999}
    >
      <Button
        type="button"
        disabled={$del_media_link_mut.isPending}
        variant="destructive"
        size="sm"
      >
        <Icon src={AiOutlineDelete} class="text-xl" />
        <span>Delete Link</span>
      </Button>
    </ConfirmPopover>
  </div>

  <div class="space-y-2">
    <Label for="edit-media-type" class="font-semibold">Type</Label>
    <div class="flex items-center gap-2">
      <MediaTypeIcon {media_type} />
      <select
        id="edit-media-type"
        required
        bind:value={media_type}
        class="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {#each Object.entries(MEDIA_TYPE_LIST) as [key, value]}
          <option value={key}>{value}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="space-y-2">
    <Label for="edit-language" class="font-semibold">Language</Label>
    <select
      id="edit-language"
      required
      bind:value={lang_id}
      class="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
    >
      {#each Object.entries(lang_list_obj) as [lang, id]}
        <option value={id}>{lang}</option>
      {/each}
    </select>
  </div>

  <div class="space-y-2">
    <Label for="edit-name" class="font-semibold">Name</Label>
    <Input
      id="edit-name"
      required
      minlength={4}
      bind:value={name}
      type="text"
      placeholder="Name"
      class="w-52"
    />
  </div>

  <div class="space-y-2">
    <Label for="edit-url" class="font-semibold">URL</Label>
    <Input
      id="edit-url"
      required
      minlength={10}
      bind:value={url}
      type="url"
      placeholder="URL"
      class="w-52"
    />
  </div>

  <Button disabled={$update_media_link_mut.isPending} type="submit" class="w-full">
    Update Link
  </Button>
</form>
