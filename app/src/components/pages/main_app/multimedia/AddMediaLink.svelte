<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { useTRPC } from '~/api/client';
  import { MEDIA_TYPE_LIST, type media_list_type } from './index';
  import { lang_list_obj } from '~/state/lang_list';
  import { z } from 'zod';
  import Icon from '~/tools/Icon.svelte';
  import { RiSystemAddLargeFill } from 'svelte-icons-pack/ri';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import MediaTypeIcon from './MediaTypeIcon.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { toast } from 'svelte-sonner';

  let { modal_open_state = $bindable() }: { modal_open_state: boolean } = $props();

  const quert_client = useQueryClient();
  const trpc = useTRPC();

  const add_media_link_mut = createMutation(() =>
    trpc.media.add_media_link.mutationOptions({
      onSuccess() {
        toast.success('Media link added');
        quert_client.invalidateQueries({
          queryKey: trpc.media.get_media_list.queryKey({
            project_id: $project_state!.project_id,
            selected_text_levels: $selected_text_levels
          }),
          exact: true
        });
        modal_open_state = false;
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to add media link');
      }
    })
  );

  const LANG_NONE = '';

  let media_type = $state<media_list_type>('video');
  let lang_id = $state<number | null>(1);
  let url = $state('');
  let name = $state('');

  const lang_label = (id: number | null) =>
    id === null
      ? '--'
      : (Object.entries(lang_list_obj).find(([, langId]) => langId === id)?.[0] ?? '--');

  const add_link_func = (e: Event) => {
    e.preventDefault();
    if (url === '' || !z.string().url().safeParse(url).success || name === '') return;
    add_media_link_mut.mutate({
      project_id: $project_state!.project_id,
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
      <Select.Root type="single" bind:value={media_type as any}>
        <Select.Trigger id="media-type" class="w-full text-sm">
          {MEDIA_TYPE_LIST[media_type] ?? 'Select Type'}
        </Select.Trigger>
        <Select.Content>
          {#each Object.entries(MEDIA_TYPE_LIST) as [key, value]}
            <Select.Item value={key}>{value}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <input type="hidden" name="type" value={media_type} />
    </div>
  </div>

  <div class="space-y-2">
    <Label for="language" class="font-semibold">Language</Label>
    <Select.Root
      type="single"
      value={lang_id === null ? LANG_NONE : lang_id.toString()}
      onValueChange={(v) => {
        lang_id = v === LANG_NONE ? null : parseInt(v);
      }}
    >
      <Select.Trigger id="language" class="w-full text-sm">
        {lang_label(lang_id)}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value={LANG_NONE}>--</Select.Item>
        {#each Object.entries(lang_list_obj) as [lang, id]}
          <Select.Item value={id.toString()}>{lang}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <input type="hidden" name="lang_id" value={lang_id} />
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

  <Button disabled={add_media_link_mut.isPending} type="submit" class="w-full">
    <Icon src={RiSystemAddLargeFill} class="-mt-1 text-xl" />
    Add Link
  </Button>
</form>
