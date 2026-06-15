<script lang="ts">
  import type { Writable } from 'svelte/store';
  import { BiEdit } from 'svelte-icons-pack/bi';
  import { Button } from '$lib/components/ui/button';
  import Label from '$lib/components/ui/label/label.svelte';
  import { Separator } from '$lib/components/ui/separator';
  import * as Popover from '$lib/components/ui/popover';
  import {
    BASE_SCRIPT,
    editing_mode,
    selected_translation_lang_ids
  } from '~/state/main_app/state.svelte';
  import { get_translation_slot_label } from '~/state/lang_list';
  import Icon from '~/tools/Icon.svelte';
  import { cn } from '$lib/utils';

  let {
    is_admin,
    can_edit_language,
    viewing_script_selection
  }: {
    is_admin: boolean;
    can_edit_language: (lang_id: number | null) => boolean;
    viewing_script_selection: Writable<string>;
  } = $props();

  let open = $state(false);

  const show_dual = $derived(
    is_admin && [0, 1].some((s) => $selected_translation_lang_ids[s] !== null)
  );
  const show_translation = $derived(
    [0, 1].some(
      (s) =>
        $selected_translation_lang_ids[s] !== null &&
        can_edit_language($selected_translation_lang_ids[s])
    )
  );
  // ponytail: admin always has "Edit text"; non-admin needs at least one allowed lang slot
  const visible = $derived(is_admin || show_translation);

  const menu_btn_class = cn(
    'h-auto w-full justify-start gap-2 rounded-md px-2.5 py-2 font-normal',
    'text-foreground/90 transition-colors duration-150',
    'hover:bg-accent hover:text-accent-foreground',
    'active:bg-accent/80',
    'focus-visible:bg-accent focus-visible:text-accent-foreground',
    '[&_svg]:text-muted-foreground [&_svg]:transition-colors',
    'hover:[&_svg]:text-accent-foreground focus-visible:[&_svg]:text-accent-foreground'
  );

  const pick = (action: () => void) => {
    action();
    open = false;
  };
</script>

{#if visible}
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline" size="sm">
          <Icon src={BiEdit} class="text-xl sm:text-2xl" />
          Edit
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="start" class="w-auto min-w-52 p-2">
      <div class="flex flex-col gap-2">
        {#if is_admin}
          <div class="space-y-1">
            <Label class="px-1 text-xs font-medium text-muted-foreground">Text</Label>
            <Button
              variant="ghost"
              class={menu_btn_class}
              onclick={() =>
                pick(() => {
                  $viewing_script_selection = BASE_SCRIPT;
                  $editing_mode = 'text';
                })}
            >
              <Icon src={BiEdit} class="text-base" />
              Edit text
            </Button>
          </div>
        {/if}

        {#if show_translation}
          {#if is_admin || show_dual}<Separator />{/if}
          <div class="space-y-1">
            <Label class="px-1 text-xs font-medium text-muted-foreground">Translation</Label>
            {#each [0, 1] as slot (slot)}
              {#if $selected_translation_lang_ids[slot] !== null && can_edit_language($selected_translation_lang_ids[slot])}
                <Button
                  variant="ghost"
                  class={menu_btn_class}
                  onclick={() =>
                    pick(() => {
                      $editing_mode = slot === 0 ? '1st_lang' : '2nd_lang';
                    })}
                >
                  <Icon src={BiEdit} class="text-base" />
                  Edit {get_translation_slot_label(slot as 0 | 1, $selected_translation_lang_ids)}
                </Button>
              {/if}
            {/each}
          </div>
        {/if}
        {#if show_dual}
          {#if is_admin}<Separator />{/if}
          <div class="space-y-1">
            <Label class="px-1 text-xs font-medium text-muted-foreground">Text + translation</Label>
            {#each [0, 1] as slot (slot)}
              {#if $selected_translation_lang_ids[slot] !== null}
                <Button
                  variant="ghost"
                  class={menu_btn_class}
                  onclick={() =>
                    pick(() => {
                      $viewing_script_selection = BASE_SCRIPT;
                      $editing_mode = slot === 0 ? 'text_1st_lang' : 'text_2nd_lang';
                    })}
                >
                  <Icon src={BiEdit} class="text-base" />
                  Edit text + {get_translation_slot_label(
                    slot as 0 | 1,
                    $selected_translation_lang_ids
                  )}
                </Button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </Popover.Content>
  </Popover.Root>
{/if}
