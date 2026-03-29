<script lang="ts">
  import * as Select from '~/lib/components/ui/select';
  import * as Avatar from '~/lib/components/ui/avatar';
  import { getScriptAvatar } from '$components/utils/script_avatar';
  import { type script_list_type } from '$app/state/lang_list';

  let {
    script = $bindable(),
    on_script_change
  }: {
    script: script_list_type;
    on_script_change?: (script: script_list_type) => void;
  } = $props();

  const CATEGORIES = {
    modern: 'Modern Indian Scripts',
    romanized: 'Romanization Scripts',
    ancient: 'Ancient Scripts'
  } as const;

  /**
   * This script is used both for categorization and custom ordering of scripts.
   */
  const scripts: Record<script_list_type, keyof typeof CATEGORIES> = {
    Devanagari: 'modern',
    Telugu: 'modern',
    Tamil: 'modern',
    Bengali: 'modern',
    Kannada: 'modern',
    Gujarati: 'modern',
    Malayalam: 'modern',
    Odia: 'modern',
    Gurumukhi: 'modern',
    Assamese: 'modern',
    Sinhala: 'modern',
    'Tamil-Extended': 'modern',
    // romanized
    Normal: 'romanized',
    Romanized: 'romanized',
    // ancient
    Brahmi: 'ancient',
    Sharada: 'ancient',
    Granth: 'ancient',
    Modi: 'ancient',
    Siddham: 'ancient'
    // 'Purna-Devanagari' clipped/removed as instructed
  };
</script>

<Select.Root
  type="single"
  bind:value={script}
  onValueChange={(v) => {
    if (v === undefined || v === null || v === '') return;
    on_script_change?.(v as script_list_type);
  }}
>
  <Select.Trigger class="h-8 w-48 gap-x-0 space-x-0 border-border/50 bg-background/50 text-sm">
    <Avatar.Root>
      <Avatar.Fallback>{getScriptAvatar(script)}</Avatar.Fallback>
    </Avatar.Root>
    {script}
  </Select.Trigger>
  <Select.Content class="max-h-96">
    {#each Object.entries(CATEGORIES) as [category, name]}
      <Select.Group>
        <Select.Label>{name}</Select.Label>
        {#each Object.entries(scripts).filter(([, cat]) => cat === category) as [script_]}
          <Select.Item value={script_} label={script_} aria-label={script_}>
            <Avatar.Root>
              <Avatar.Fallback>{getScriptAvatar(script_ as script_list_type)}</Avatar.Fallback>
            </Avatar.Root>
            {script_}
          </Select.Item>
        {/each}
      </Select.Group>
    {/each}
  </Select.Content>
</Select.Root>
