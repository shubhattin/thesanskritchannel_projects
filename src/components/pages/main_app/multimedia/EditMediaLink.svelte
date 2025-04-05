<script lang="ts">
  import { client_q, client } from '~/api/client';
  import { MEDIA_TYPE_LIST, type media_list_type } from './index';
  import { lang_list_obj } from '~/state/lang_list';
  import { z } from 'zod';
  import Icon from '~/tools/Icon.svelte';
  import { useQueryClient } from '@tanstack/svelte-query';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import MediaTypeIcon from './MediaTypeIcon.svelte';

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

  const del_link_func = (e: Event) => {
    e.preventDefault();
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

<div class="text-center text-lg font-bold text-amber-700 dark:text-warning-500">
  Add Media Links
</div>
<form onsubmit={update_link_func} class="space-y-1.5">
  <label class="block">
    <span class="label-text block font-semibold">Type</span>
    <div class="space-x-1">
      <MediaTypeIcon {media_type} />
      <select required bind:value={media_type} class="select inline-block w-28 ring-2">
        {#each Object.entries(MEDIA_TYPE_LIST) as [key, value]}
          <option value={key}>{value}</option>
        {/each}
      </select>
    </div>
  </label>
  <label class="block">
    <span class="label-text font-semibold">Language</span>
    <select required bind:value={lang_id} class="select w-36 ring-2">
      {#each Object.entries(lang_list_obj) as [lang, id]}
        <option value={id}>{lang}</option>
      {/each}
    </select>
  </label>
  <label class="block">
    <span class="label-text font-semibold">Name</span>
    <input
      required
      minlength={4}
      bind:value={name}
      type="text"
      placeholder="Name"
      class="input w-full ring-2"
    />
  </label>
  <label class="block">
    <span class="label-text font-semibold">URL</span>
    <input
      required
      minlength={10}
      bind:value={url}
      type="url"
      placeholder="URL"
      class="input w-52 ring-2"
    />
  </label>
  <button
    disabled={$update_media_link_mut.isPending}
    type="submit"
    class="btn block bg-primary-500 px-2 py-1 font-bold text-white"
  >
    Update Link
  </button>
</form>
