<script lang="ts">
  import { client_q } from '~/api/client';
  import { MEDIA_TYPE_LIST, type media_list_type } from './index';
  import { lang_list_obj } from '~/state/lang_list';
  import { object, z } from 'zod';
  import Icon from '~/tools/Icon.svelte';
  import { CgAdd } from 'svelte-icons-pack/cg';

  let { modal_open_state = $bindable() }: { modal_open_state: boolean } = $props();

  const add_media_link_mut = client_q.media.add_media_link.mutation({
    onSuccess() {
      // invalidate list
    }
  });

  let type = $state<media_list_type>('video');
  let lang_id = $state(1);
  let url = $state('');
  let name = $state('');

  const add_link_func = (e: Event) => {
    e.preventDefault();
    if (url === '' || !z.string().url().safeParse(url).success || name === '' || lang_id === 0)
      return;
    //
  };
</script>

<div class="text-center text-lg font-bold text-amber-700 dark:text-warning-500">
  Add Medaia Links
</div>
<form onsubmit={add_link_func} class="space-y-1 text-sm">
  <label class="block">
    <span class="label-text block font-semibold">Type</span>
    <select required bind:value={type} class="select w-24 text-sm ring-2">
      {#each Object.entries(MEDIA_TYPE_LIST) as [key, value]}
        <option value={key}>{value}</option>
      {/each}
    </select>
  </label>
  <label class="block">
    <span class="label-text block font-semibold">Language</span>
    <select required bind:value={lang_id} class="select w-32 text-sm ring-2">
      {#each Object.entries(lang_list_obj) as [lang, id]}
        <option value={id}>{lang}</option>
      {/each}
    </select>
  </label>
  <label for="block">
    <span class="label-text block font-semibold">Name</span>
    <input
      required
      bind:value={name}
      type="text"
      placeholder="Name"
      class="input w-full text-sm ring-2"
    />
  </label>
  <label for="block">
    <span class="label-text block font-semibold">URL</span>
    <input
      required
      bind:value={url}
      type="url"
      placeholder="URL"
      class="input w-52 text-sm ring-2"
    />
  </label>
  <button type="submit" class="btn block p-0">
    <Icon src={CgAdd} class="text-xl" />
    Add Link
  </button>
</form>
