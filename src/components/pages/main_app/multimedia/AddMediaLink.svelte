<script lang="ts">
  import { client_q } from '~/api/client';
  import { MEDIA_TYPE_LIST, type media_list_type } from './index';
  import { lang_list_obj } from '~/state/lang_list';
  import { z } from 'zod';
  import Icon from '~/tools/Icon.svelte';
  import { RiSystemAddLargeFill } from 'svelte-icons-pack/ri';
  import { useQueryClient } from '@tanstack/svelte-query';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import MediaTypeIcon from './MediaTypeIcon.svelte';

  let { modal_open_state = $bindable() }: { modal_open_state: boolean } = $props();

  const quert_client = useQueryClient();

  const add_media_link_mut = client_q.media.add_media_link.mutation({
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

  let media_type = $state<media_list_type>('video');
  let lang_id = $state(1);
  let url = $state('');
  let name = $state('');

  const add_link_func = (e: Event) => {
    e.preventDefault();
    if (url === '' || !z.string().url().safeParse(url).success || name === '' || lang_id === 0)
      return;
    $add_media_link_mut.mutate({
      project_id: $project_state.project_id!,
      selected_text_levels: $selected_text_levels,
      media_type,
      lang_id,
      link: url,
      name
    });
  };
</script>

<div class="dark:text-warning-500 text-center text-lg font-bold text-amber-700">
  Add Media Links
</div>
<form onsubmit={add_link_func} class="space-y-2">
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
      class="input w-52 ring-2"
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
    disabled={$add_media_link_mut.isPending}
    type="submit"
    class="btn bg-primary-500 block px-2 py-1 font-bold text-white"
  >
    <Icon src={RiSystemAddLargeFill} class="-mt-1 text-xl" />
    Add Link
  </button>
</form>
