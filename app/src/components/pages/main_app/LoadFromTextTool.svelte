<script lang="ts">
  import { createMutation } from '@tanstack/svelte-query';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Label } from '$lib/components/ui/label';
  import * as RadioGroup from '$lib/components/ui/radio-group';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import * as Select from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Tabs from '$lib/components/ui/tabs';
  import { client } from '~/api/client';
  import {
    invalidate_project_content_queries,
    invalidate_project_map_queries,
    text_data_q
  } from '~/state/main_app/data.svelte';
  import { project_state, selected_text_levels } from '~/state/main_app/state.svelte';
  import { LANG_LIST, LANG_LIST_IDS, lang_list_obj } from '~/state/lang_list';
  import { parse_import_text } from './display/project_utility/download_text_format';
  import {
    apply_normalizations_to_texts,
    DEFAULT_ENABLED_NORMALIZATIONS,
    get_normalization_options
  } from '~/tools/text_normalizations';

  type SaveMode = 'use-existing' | 'overwrite';
  type ReviewedState = 'no' | 'yes';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let import_text = $state('');
  let include_normal = $state(true);
  let include_translation = $state(true);
  let selected_lang_id = $state(lang_list_obj.English);
  let active_tab = $state('text');
  let save_mode = $state<SaveMode>('overwrite');
  let reviewed_output = $state<ReviewedState>('no');
  let selected_normalization_keys = $state<string[]>([...DEFAULT_ENABLED_NORMALIZATIONS]);
  const normalization_options = get_normalization_options();
  const enabled_normalizations = $derived(
    normalization_options
      .map((option) => option.key)
      .filter((key) => selected_normalization_keys.includes(key))
  );
  const transformations_label = $derived(
    selected_normalization_keys.length === 0
      ? 'Select transformations'
      : selected_normalization_keys.length === normalization_options.length
        ? 'All transformations'
        : `${selected_normalization_keys.length} selected`
  );

  const existing_rows = $derived($text_data_q.data ?? []);
  const existing_text_exists = $derived(existing_rows.length > 0);
  const parsed_result = $derived(
    parse_import_text(import_text, {
      includesNormal: include_normal,
      includesTranslation: include_translation
    })
  );
  const parsed_rows = $derived(parsed_result.rows);
  const transformed_rows = $derived.by(() => {
    if (parsed_rows.length === 0) return [];
    const texts = parsed_rows.map((row) => row.text);
    const indices = parsed_rows.map((_, index) => index);
    const transformed_texts = apply_normalizations_to_texts(texts, indices, enabled_normalizations);
    return parsed_rows.map((row, index) => ({
      ...row,
      text: transformed_texts[index] ?? row.text
    }));
  });
  const target_text_count = $derived(
    save_mode === 'use-existing' ? existing_rows.length : parsed_rows.length
  );
  const translation_count_invalid = $derived(
    include_translation && parsed_rows.length > target_text_count
  );
  const selected_lang_label = $derived(
    LANG_LIST[LANG_LIST_IDS.indexOf(selected_lang_id)] ?? 'English'
  );

  $effect(() => {
    if (!open) return;
    if (!existing_text_exists || !include_translation) save_mode = 'overwrite';
  });

  $effect(() => {
    import_text;
    include_normal;
    include_translation;
    selected_lang_id;
    save_mode;
    selected_normalization_keys;
    reviewed_output = 'no';
  });

  const get_output_text_for_row = (index: number) => {
    if (save_mode === 'use-existing') return existing_rows[index]?.text ?? '';
    return transformed_rows[index]?.text ?? '';
  };

  const get_output_translation_for_row = (index: number) => {
    if (!include_translation) return null;
    const parsed = parsed_rows[index];
    if (!parsed) return null;
    return parsed.translation ?? null;
  };

  const get_preview_indexes = () => {
    const count =
      save_mode === 'use-existing'
        ? Math.max(existing_rows.length, parsed_rows.length)
        : transformed_rows.length;
    return Array.from({ length: count }, (_, i) => i);
  };

  const save_import_mut = createMutation({
    mutationKey: ['text', 'load_from_text'],
    mutationFn: async () => {
      if (!$project_state.project_id) throw new Error('Project is not selected');
      if (parsed_rows.length === 0) throw new Error('No valid rows parsed');
      if (translation_count_invalid) {
        throw new Error('Translation row count cannot be greater than the target text row count');
      }

      if (save_mode === 'overwrite') {
        await client.text.save_text_rows.mutate({
          project_id: $project_state.project_id,
          selected_text_levels: $selected_text_levels,
          rows: transformed_rows.map((row) => ({
            source_index: null,
            text: row.text,
            shloka_type: false
          }))
        });
      }

      if (include_translation) {
        const target_indexes =
          save_mode === 'use-existing'
            ? existing_rows.slice(0, parsed_rows.length).map((row) => row.index)
            : parsed_rows.map((_, index) => index);
        await client.translation.edit_translation.mutate({
          project_id: $project_state.project_id,
          lang_id: selected_lang_id,
          selected_text_levels: $selected_text_levels,
          indexes: target_indexes,
          data: parsed_rows.map((row) => row.translation ?? null)
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        invalidate_project_content_queries($project_state.project_id ?? undefined),
        invalidate_project_map_queries($project_state.project_id ?? undefined)
      ]);
      toast.success('Text imported');
      open = false;
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to import text');
    }
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="flex h-[95vh] max-h-[95vh] w-[80vw] max-w-5xl flex-col gap-4 overflow-hidden p-4 sm:w-[90vw] sm:max-w-6xl md:w-[86vw] lg:w-[65vw]"
  >
    <Dialog.Header>
      <Dialog.Title>Load from Text</Dialog.Title>
      <Dialog.Description>
        Paste generated text, review the parsed output, then save it into text and translation data.
      </Dialog.Description>
    </Dialog.Header>

    <Tabs.Root bind:value={active_tab} class="min-h-0 flex-1">
      <Tabs.List>
        <Tabs.Trigger value="text">Text</Tabs.Trigger>
        <Tabs.Trigger value="output">Output</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="text" class="min-h-0 flex-1">
        <div class="flex h-full min-h-0 flex-col gap-4">
          <div class="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
            <div class="flex flex-col gap-3">
              <label class="flex items-center gap-2 text-sm">
                <Checkbox bind:checked={include_normal} />
                <span>Input includes Normal transliteration</span>
              </label>
              <label class="flex items-center gap-2 text-sm">
                <Checkbox bind:checked={include_translation} />
                <span>Input includes Translation</span>
              </label>

              {#if include_translation}
                <div class="flex flex-col gap-1.5">
                  <Label for="load-from-text-lang">Translation language</Label>
                  <Select.Root
                    type="single"
                    value={String(selected_lang_id)}
                    onValueChange={(value) => {
                      if (value) selected_lang_id = Number(value);
                    }}
                  >
                    <Select.Trigger id="load-from-text-lang" class="w-full">
                      {selected_lang_label}
                    </Select.Trigger>
                    <Select.Content>
                      {#each LANG_LIST as lang, i (lang)}
                        <Select.Item value={String(LANG_LIST_IDS[i])}>{lang}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
              {/if}
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="load-from-text-transformations">Transformations</Label>
              <Select.Root type="multiple" bind:value={selected_normalization_keys}>
                <Select.Trigger
                  id="load-from-text-transformations"
                  class="h-auto min-h-9 w-full py-2"
                >
                  <span class="line-clamp-2 text-left text-sm">{transformations_label}</span>
                </Select.Trigger>
                <Select.Content class="max-h-64">
                  {#each normalization_options as option (option.key)}
                    <Select.Item value={option.key} label={option.description}>
                      {option.description}
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>

          <div class="flex min-h-0 flex-1 flex-col gap-1.5">
            <Label for="load-from-text-input">Input text</Label>
            <Textarea
              id="load-from-text-input"
              bind:value={import_text}
              placeholder="Paste text in the exported format..."
              spellcheck={false}
              class="min-h-0 flex-1 resize-none font-mono text-sm"
            />
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content value="output" class="min-h-0 flex-1">
        <div class="flex h-full min-h-0 flex-col gap-3">
          <div class="grid gap-3 rounded-lg border p-3 lg:grid-cols-[1fr_auto]">
            <div class="flex flex-col gap-2 text-sm">
              <div>
                Parsed <span class="font-semibold">{parsed_rows.length}</span> valid block{parsed_rows.length ===
                1
                  ? ''
                  : 's'}.
                {#if parsed_result.ignoredBlockCount > 0}
                  <span class="text-destructive">
                    Ignored {parsed_result.ignoredBlockCount} incomplete or malformed block{parsed_result.ignoredBlockCount ===
                    1
                      ? ''
                      : 's'}.
                  </span>
                {/if}
              </div>
              <div class="text-muted-foreground">
                Existing text rows: {existing_rows.length}. New text rows: {transformed_rows.length}.
                Imported rows are saved as regular text rows; after adding, use Edit Text to mark
                individual rows as shlokas.
              </div>
              {#if translation_count_invalid}
                <div class="text-destructive">
                  Translation rows must be less than or equal to the target text rows.
                </div>
              {/if}
            </div>

            {#if existing_text_exists && include_translation}
              <RadioGroup.Root bind:value={save_mode} class="min-w-52 gap-2">
                <label class="flex items-center gap-2 text-sm">
                  <RadioGroup.Item value="use-existing" />
                  <span>Use existing text data</span>
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <RadioGroup.Item value="overwrite" />
                  <span>Overwrite with new text</span>
                </label>
              </RadioGroup.Root>
            {/if}
          </div>

          {#if save_mode === 'overwrite' && existing_text_exists}
            <div
              class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              Existing text will be overwritten. Old rows: {existing_rows.length}; new rows:
              {transformed_rows.length}.
            </div>
          {/if}

          <ScrollArea class="min-h-0 flex-1 rounded-lg border p-3">
            {#if transformed_rows.length === 0}
              <p class="text-sm text-muted-foreground">
                Paste text in the Text tab to preview output.
              </p>
            {:else}
              <div class="flex flex-col gap-4">
                {#each get_preview_indexes() as index (index)}
                  {@const text = get_output_text_for_row(index)}
                  {@const translation = get_output_translation_for_row(index)}
                  <div class="rounded-md border bg-card p-3">
                    <div class="text-sm whitespace-pre-wrap">
                      <span class="font-semibold">{index + 1}.</span>
                      {#if text}
                        <span> {text}</span>
                      {:else}
                        <span class="text-destructive"> Missing text row</span>
                      {/if}
                    </div>
                    {#if include_translation}
                      <div class="mt-2 pl-6 text-sm whitespace-pre-wrap text-muted-foreground">
                        {translation ?? '----'}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </ScrollArea>
        </div>
      </Tabs.Content>
    </Tabs.Root>

    <Dialog.Footer class="items-center gap-3 sm:justify-between">
      <RadioGroup.Root bind:value={reviewed_output} class="flex items-center gap-3">
        <span class="text-sm text-muted-foreground">Reviewed Output?</span>
        <label class="flex items-center gap-1.5 text-sm">
          <RadioGroup.Item value="no" />
          <span>No</span>
        </label>
        <label class="flex items-center gap-1.5 text-sm">
          <RadioGroup.Item value="yes" />
          <span>Yes</span>
        </label>
      </RadioGroup.Root>

      <div class="flex gap-2">
        <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
        <Button
          disabled={$save_import_mut.isPending ||
            reviewed_output !== 'yes' ||
            parsed_rows.length === 0 ||
            translation_count_invalid}
          onclick={() => $save_import_mut.mutate()}
        >
          {$save_import_mut.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
