<script lang="ts">
  import { Accordion, Switch } from '@skeletonlabs/skeleton-svelte';
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import { slide } from 'svelte/transition';
  import type { TransliterationOptions } from 'lipilekhika';
  import { BiInfoCircle } from 'svelte-icons-pack/bi';
  import Icon from '~/tools/Icon.svelte';

  let {
    availableOptions,
    options = $bindable({})
  }: {
    availableOptions: string[];
    options: TransliterationOptions;
  } = $props();

  type CustomOptionList = keyof TransliterationOptions;

  const CUSTOM_OPTION_DESCRIPTION: Record<CustomOptionList, [name: string, description: string]> = {
    'all_to_normal:preserve_specific_chars': [
      'Preserve Specific Characters',
      'Preserves script-specific characters when converting to Normal script. Can be useful for studying script specific characters.'
    ],
    'all_to_normal:remove_virAma_and_double_virAma': [
      'Remove Virāma and Double Virāma',
      'Removes virāma (।) and pūrṇa virāma (॥) punctuation from Normal/Romanized output.'
    ],
    'all_to_normal:replace_avagraha_with_a': [
      'Replace Avagraha with a',
      "Replaces avagraha (ऽ) with 'a' in Normal/Romanized output."
    ],
    'all_to_sinhala:use_conjunct_enabling_halant': [
      'Use Conjunct Enabling Halant',
      'Uses conjunct-enabling halant (්‍) for Sinhala output to properly form conjunct consonants.'
    ],
    'all_to_normal:replace_pancham_varga_varna_with_n': [
      'Replace Pancham Varga Varna with n',
      "Replaces ङ (G) and ञ (J) with 'n' for more natural output."
    ],
    'brahmic_to_brahmic:replace_pancham_varga_varna_with_anusvAra': [
      'Replace Pancham Varga Varna with Anusvāra',
      'Replaces 5th varga consonants (ङ्, ञ्, ण्, न्, म्) with anusvāra (ं) when followed by consonants of the same varga.'
    ],
    'normal_to_all:use_typing_chars': [
      'Use Typing Characters',
      'Enables typing mode characters including duplicate alternatives and script-specific characters. Equivalent to typing mode using `createTypingContext` function.'
    ]
  };
</script>

<!-- Options Section -->
<div class="mt-6">
  <Accordion collapsible>
    <Accordion.Item value="options">
      {#snippet lead()}
        <span class="text-sm font-medium tracking-wide text-foreground"
          >Custom Transliteration Options</span
        >
      {/snippet}
      {#snippet control()}{/snippet}
      {#snippet panel()}
        {#if availableOptions.length === 0}
          <p class="text-sm text-muted-foreground">No options available for this combination.</p>
        {:else}
          <div class="space-y-4" transition:slide>
            {#each availableOptions as option (option)}
              <div class="flex items-center justify-between gap-4">
                <label
                  class="flex cursor-pointer items-center gap-x-2 text-sm text-foreground sm:gap-x-4"
                >
                  <Switch
                    name={option}
                    checked={options[option as keyof TransliterationOptions] ?? false}
                    onCheckedChange={(e) =>
                      (options[option as keyof TransliterationOptions] = e.checked)}
                  />
                  <span class="block max-w-40 truncate text-xs sm:max-w-full" title={option}>
                    {CUSTOM_OPTION_DESCRIPTION[option as CustomOptionList]?.[0] ?? option}
                  </span>
                  <Popover
                    triggerBase="btn btn-sm btn-ghost"
                    contentBase="card p-4 rounded-lg shadow-xl dark:bg-surface-900 bg-zinc-100 max-w-xs"
                  >
                    {#snippet trigger()}
                      <Icon src={BiInfoCircle} class="text-lg" />
                    {/snippet}
                    {#snippet content()}
                      <p class="text-sm">
                        {CUSTOM_OPTION_DESCRIPTION[option as CustomOptionList]?.[1] ??
                          'No description available.'}
                      </p>
                    {/snippet}
                  </Popover>
                </label>
              </div>
            {/each}
          </div>
        {/if}
      {/snippet}
    </Accordion.Item>
  </Accordion>
</div>
