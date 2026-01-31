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
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

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
<form onsubmit={add_link_func} class="space-y-4">
  <div class="space-y-2">
    <Label for="media-type" class="font-semibold">Type</Label>
    <div class="flex items-center gap-2">
      <MediaTypeIcon {media_type} />
      <select
        id="media-type"
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
    <Label for="language" class="font-semibold">Language</Label>
    <select
      id="language"
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
    <Label for="name" class="font-semibold">Name</Label>
    <Input
      id="name"
      required
      minlength={4}
      bind:value={name}
      type="text"
      placeholder="Name"
      class="w-52"
    />
  </div>

  <div class="space-y-2">
    <Label for="url" class="font-semibold">URL</Label>
    <Input
      id="url"
      required
      minlength={10}
      bind:value={url}
      type="url"
      placeholder="URL"
      class="w-52"
    />
  </div>

  <Button disabled={$add_media_link_mut.isPending} type="submit" class="w-full">
    <Icon src={RiSystemAddLargeFill} class="-mt-1 text-xl" />
    Add Link
  </Button>
</form>
