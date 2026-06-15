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
  import { LANG_LIST, LANG_LIST_IDS } from '~/state/lang_list';
  import Icon from '~/tools/Icon.svelte';

  let {
    disabled = false,
    is_admin,
    can_edit_language,
    viewing_script_selection
  }: {
    disabled?: boolean;
    is_admin: boolean;
    can_edit_language: (lang_id: number | null) => boolean;
    viewing_script_selection: Writable<string>;
  } = $props();

  let open = $state(false);

  const get_lang_slot_label = (slot: 0 | 1) => {
    const lang_id = $selected_translation_lang_ids[slot];
    return lang_id === null ? `Lang ${slot + 1}` : LANG_LIST[LANG_LIST_IDS.indexOf(lang_id)]!;
  };

  const show_text = $derived(is_admin);
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
  const has_any_option = $derived(show_text || show_dual || show_translation);

  const menu_btn_class = 'h-auto w-full justify-start gap-2 px-2.5 py-1.5 font-normal';

  const pick = (action: () => void) => {
    action();
    open = false;
  };
</script>

{#if has_any_option}
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline" size="sm" {disabled}>
          <Icon src={BiEdit} class="text-xl sm:text-2xl" />
          Edit
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="start" class="w-auto min-w-52 p-2">
      <div class="flex flex-col gap-2">
        {#if show_text}
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

        {#if show_dual}
          {#if show_text}<Separator />{/if}
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
                  Edit text + {get_lang_slot_label(slot as 0 | 1)}
                </Button>
              {/if}
            {/each}
          </div>
        {/if}

        {#if show_translation}
          {#if show_text || show_dual}<Separator />{/if}
          <div class="space-y-1">
            <Label class="px-1 text-xs font-medium text-muted-foreground">Translation</Label>
            {#each [0, 1] as slot (slot)}
              {#if $selected_translation_lang_ids[slot] !== null &&
                can_edit_language($selected_translation_lang_ids[slot])}
                <Button
                  variant="ghost"
                  class={menu_btn_class}
                  onclick={() =>
                    pick(() => {
                      $editing_mode = slot === 0 ? '1st_lang' : '2nd_lang';
                    })}
                >
                  <Icon src={BiEdit} class="text-base" />
                  Edit {get_lang_slot_label(slot as 0 | 1)}
                </Button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </Popover.Content>
  </Popover.Root>
{/if}
