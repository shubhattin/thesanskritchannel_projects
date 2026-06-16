<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { AiOutlineDelete } from 'svelte-icons-pack/ai';
  import { BsGripVertical } from 'svelte-icons-pack/bs';
  import { lang_list_obj } from '~/state/lang_list';
  import Icon from '~/tools/Icon.svelte';
  import { MEDIA_TYPE_LIST, type media_list_type } from './index';
  import type { DraftMediaItem } from './multimedia_lib';

  let {
    item,
    index,
    drag_index = null,
    drop_index = null,
    on_change,
    on_select_change,
    on_text_focus,
    on_text_blur,
    on_delete,
    on_drag_start,
    on_drag_end,
    on_drag_over,
    on_drag_leave,
    on_drop
  }: {
    item: DraftMediaItem;
    index: number;
    drag_index?: number | null;
    drop_index?: number | null;
    on_change: (patch: Partial<DraftMediaItem>) => void;
    on_select_change: (patch: Partial<DraftMediaItem>) => void;
    on_text_focus: () => void;
    on_text_blur: () => void;
    on_delete: () => void;
    on_drag_start: (index: number, event: DragEvent) => void;
    on_drag_end: () => void;
    on_drag_over: (index: number, event: DragEvent) => void;
    on_drag_leave: (index: number, event: DragEvent) => void;
    on_drop: (index: number, event: DragEvent) => void;
  } = $props();

  const LANG_NONE = '';

  const lang_label = (id: number | null) =>
    id === null
      ? '--'
      : (Object.entries(lang_list_obj).find(([, langId]) => langId === id)?.[0] ?? '--');

  const link_invalid = $derived(item.link !== '' && !URL.canParse(item.link));
  const name_invalid = $derived(item.name.trim().length === 0);
</script>

<div
  role="listitem"
  data-media-edit-card
  class="rounded-lg border bg-card px-1.5 py-1 transition-colors {drag_index === index
    ? 'opacity-60'
    : ''} {drop_index === index && drag_index !== null && drag_index !== index
    ? 'border-primary ring-1 ring-primary/30'
    : 'border-border'}"
  ondragover={(event) => on_drag_over(index, event)}
  ondragleave={(event) => on_drag_leave(index, event)}
  ondrop={(event) => on_drop(index, event)}
>
  <div class="flex min-w-0 items-center gap-1.5 overflow-x-auto">
    <button
      type="button"
      aria-label="Drag to reorder"
      class="shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      draggable="true"
      ondragstart={(event) => on_drag_start(index, event)}
      ondragend={on_drag_end}
    >
      <Icon src={BsGripVertical} class="text-base" />
    </button>

    <span
      class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
      title="Order"
    >
      #{index + 1}
    </span>

    <Select.Root
      type="single"
      value={item.media_type}
      onValueChange={(value) => {
        if (!value) return;
        on_select_change({ media_type: value as media_list_type });
      }}
    >
      <Select.Trigger class="h-8 w-22 shrink-0 px-2 text-xs">
        {MEDIA_TYPE_LIST[item.media_type]}
      </Select.Trigger>
      <Select.Content>
        {#each Object.entries(MEDIA_TYPE_LIST) as [key, value] (key)}
          <Select.Item value={key}>{value}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <Select.Root
      type="single"
      value={item.lang_id === null ? LANG_NONE : item.lang_id.toString()}
      onValueChange={(value) => {
        on_select_change({ lang_id: value === LANG_NONE ? null : Number(value) });
      }}
    >
      <Select.Trigger class="h-8 w-26 shrink-0 px-2 text-xs">
        <span class="truncate">{lang_label(item.lang_id)}</span>
      </Select.Trigger>
      <Select.Content>
        <Select.Item value={LANG_NONE}>--</Select.Item>
        {#each Object.entries(lang_list_obj) as [lang, id] (id)}
          <Select.Item value={id.toString()}>{lang}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <Input
      value={item.name}
      onfocus={on_text_focus}
      onblur={on_text_blur}
      oninput={(event) => on_change({ name: event.currentTarget.value })}
      class="h-8 min-w-0 flex-1 px-2 text-xs {name_invalid ? 'border-destructive' : ''}"
      placeholder="Name"
      title={name_invalid ? 'Name is required' : undefined}
      aria-invalid={name_invalid}
    />

    <Input
      value={item.link}
      onfocus={on_text_focus}
      onblur={on_text_blur}
      oninput={(event) => on_change({ link: event.currentTarget.value })}
      class="h-8 min-w-0 flex-[1.4] px-2 text-xs {link_invalid ? 'border-destructive' : ''}"
      type="url"
      placeholder="https://"
      title={link_invalid ? 'Enter a valid URL' : undefined}
      aria-invalid={link_invalid}
    />

    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="size-7 shrink-0 text-destructive hover:text-destructive"
      onclick={on_delete}
      aria-label="Delete link"
    >
      <Icon src={AiOutlineDelete} class="text-base" />
    </Button>
  </div>
</div>
