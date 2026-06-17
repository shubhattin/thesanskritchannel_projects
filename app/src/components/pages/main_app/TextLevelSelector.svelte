<script lang="ts">
  import { browser } from '$app/environment';
  import { untrack } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Select from '$lib/components/ui/select';
  import { BASE_SCRIPT, selected_text_levels, viewing_script } from '~/state/main_app/state.svelte';
  import { transliterate_custom } from '~/tools/converter';
  import { get_text_font_class } from '~/tools/font_tools';
  import type { script_list_type } from '~/state/lang_list';
  import Icon from '~/tools/Icon.svelte';
  import { AiOutlineStop } from 'svelte-icons-pack/ai';
  import { BiEdit } from 'svelte-icons-pack/bi';

  export type selector_option_type = { text?: string; value?: number; empty_child?: boolean };

  let {
    name,
    initial_option,
    options = false,
    text_level_state_index,
    is_admin = false,
    controls_disabled = false,
    show_name_dev_edit = false,
    on_edit_list_name,
    on_edit_name_dev
  }: {
    name: string;
    initial_option: selector_option_type;
    options?: false | selector_option_type[];
    text_level_state_index: number;
    is_admin?: boolean;
    controls_disabled?: boolean;
    show_name_dev_edit?: boolean;
    on_edit_list_name?: () => void;
    on_edit_name_dev?: () => void;
  } = $props();

  // Memoized transliterated label — avoids creating a new promise on every render
  let label_text = $state('Select');
  $effect(() => {
    const selected_value = $selected_text_levels[text_level_state_index];
    const script = $viewing_script;
    const opts = options;
    const initial = initial_option;

    untrack(() => {
      (async () => {
        if (!selected_value) {
          label_text = 'Select';
          return;
        }
        const selected_text = opts
          ? (opts.find((o) => o.value === selected_value)?.text ?? '')
          : (initial.text ?? '');
        if (!selected_text) {
          label_text = `${selected_value}.`;
          return;
        }
        if (!browser || script === BASE_SCRIPT) {
          label_text = `${selected_value}. ${selected_text}`;
          return;
        }
        const text_tr = await transliterate_custom(selected_text, BASE_SCRIPT, script);
        label_text = `${selected_value}. ${text_tr}`;
      })();
    });
  });

  // Memoized transliterated options — avoids creating a new promise on every render
  let options_transliterated = $state<selector_option_type[] | null>(null);
  $effect(() => {
    const opts = options;
    const script = $viewing_script;

    untrack(() => {
      if (!opts || !browser) {
        options_transliterated = opts || null;
        return;
      }
      (async () => {
        const transliterate_texts = await transliterate_custom(
          opts.map((v) => v.text!),
          BASE_SCRIPT,
          script
        );
        options_transliterated = opts.map((v, i) => ({ ...v, text: transliterate_texts[i] }));
      })();
    });
  });
</script>

<div class="block space-x-2 sm:space-x-3">
  <span class="inline-flex items-center gap-0.5">
    <span class="text-sm font-bold sm:text-base">Select {name}</span>
    {#if is_admin}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="inline-flex size-8 shrink-0 align-middle"
        title="Edit level label"
        disabled={controls_disabled}
        onclick={() => on_edit_list_name?.()}
      >
        <Icon src={BiEdit} class="text-lg" />
      </Button>
    {/if}
  </span>
  <Select.Root
    type="single"
    value={$selected_text_levels[text_level_state_index]?.toString() ?? ''}
    onValueChange={(v) => {
      const next_value = v ? parseInt(v) : null;
      $selected_text_levels[text_level_state_index] = next_value;
      for (let i = 0; i < text_level_state_index; i++) {
        $selected_text_levels[i] = null;
      }
    }}
    disabled={controls_disabled}
  >
    <Select.Trigger
      class={`${get_text_font_class($viewing_script)} inline-flex h-10 w-44 px-2 py-1 sm:h-12 sm:w-52`}
    >
      {label_text}
    </Select.Trigger>
    <Select.Content>
      <Select.Item value="">Select</Select.Item>
      {#if !options}
        {#if initial_option.value}
          <Select.Item value={initial_option.value.toString()}>
            <span class="flex w-full items-center justify-between gap-2">
              <span>{initial_option.value}. {initial_option.text}</span>
              {#if initial_option.empty_child}
                <Icon class="text-base opacity-70" src={AiOutlineStop} />
              {/if}
            </span>
          </Select.Item>
        {/if}
      {:else}
        {#each options_transliterated ?? options as option}
          <Select.Item value={option.value!.toString()}>
            <span class="flex w-full items-center justify-between gap-2">
              <span>{option.value}. {option.text}</span>
              {#if option.empty_child}
                <Icon class="size-4 opacity-70" src={AiOutlineStop} />
              {/if}
            </span>
          </Select.Item>
        {/each}
      {/if}
    </Select.Content>
  </Select.Root>
  {#if is_admin && show_name_dev_edit}
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="inline-flex size-8 shrink-0 align-middle"
      title="Edit name (देवनागरी)"
      disabled={controls_disabled}
      onclick={() => on_edit_name_dev?.()}
    >
      <Icon src={BiEdit} class="text-lg" />
    </Button>
  {/if}
</div>
