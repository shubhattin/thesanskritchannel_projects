<script lang="ts">
  import { browser } from '$app/environment';
  import { createQuery, type CreateQueryResult } from '@tanstack/svelte-query';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Label } from '$lib/components/ui/label';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import * as Select from '$lib/components/ui/select';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import {
    active_langs_with_translations_q_options,
    get_last_level_name,
    project_map_q_options,
    text_data_q_options,
    trans_lang_data_q_options
  } from '~/state/main_app/data.svelte';
  import {
    BASE_SCRIPT,
    project_state,
    selected_text_levels,
    text_data_present
  } from '~/state/main_app/state.svelte';
  import { get_lang_from_id, SCRIPT_LIST, type script_list_type } from '~/state/lang_list';
  import { queryClient } from '~/state/queryClient';
  import { download_file_in_browser } from '~/tools/download_file_browser';
  import { transliterate_custom } from '~/tools/converter';
  import { derived, writable } from 'svelte/store';
  import {
    format_download_text,
    PREVIEW_SHLOKA_COUNT,
    should_show_normal_transliteration,
    transliterate_text_batch
  } from './download_text_format';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let text_script = $state<script_list_type>(BASE_SCRIPT);
  let include_normal = $state(true);
  let include_translation = $state(true);
  let selected_lang_id = writable<number | null>(null);
  const include_translation_store = writable(false);
  const dialog_open_store = writable(false);
  let preview_text = $state('');
  let preview_loading = $state(false);
  let downloading = $state(false);

  $effect(() => {
    include_translation_store.set(include_translation);
    dialog_open_store.set(open);
  });

  const show_normal_option = $derived(should_show_normal_transliteration(text_script));
  const effective_include_normal = $derived(show_normal_option && include_normal);

  const langs_with_translations_q = $derived(
    createQuery(
      active_langs_with_translations_q_options(
        $selected_text_levels,
        $project_state,
        $text_data_present
      )
    )
  );

  const project_map_q = $derived(createQuery(project_map_q_options($project_state)));

  const text_data_q = $derived(
    createQuery({
      ...text_data_q_options($selected_text_levels, $project_state),
      enabled: $text_data_present && $project_state !== null
    })
  );

  const available_lang_ids = $derived($langs_with_translations_q.data ?? []);

  const lang_options = $derived(
    available_lang_ids
      .map((lang_id) => ({
        id: lang_id,
        label: get_lang_from_id(lang_id)
      }))
      .filter((entry) => entry.label !== undefined)
      .sort((a, b) => a.label.localeCompare(b.label))
  );

  const translation_q: CreateQueryResult<Map<number, string>, Error> = derived(
    [
      project_state,
      selected_text_levels,
      selected_lang_id,
      include_translation_store,
      dialog_open_store
    ],
    ([project_state_, selected_text_levels_, lang_id, include_translation_, is_open], set) => {
      const query = createQuery(
        {
          ...trans_lang_data_q_options(lang_id ?? -1, selected_text_levels_, project_state_),
          enabled: browser && is_open && include_translation_ && lang_id !== null && lang_id !== 0
        },
        queryClient
      );
      const unsub = query.subscribe((state) => set(state));
      return () => unsub();
    }
  );

  const selected_lang_label = $derived(
    $selected_lang_id === null
      ? 'Select language'
      : (get_lang_from_id($selected_lang_id) ?? 'Language')
  );

  $effect(() => {
    if (!include_translation) {
      $selected_lang_id = null;
      return;
    }
    if ($selected_lang_id !== null && available_lang_ids.includes($selected_lang_id)) return;
    $selected_lang_id = lang_options[0]?.id ?? null;
  });

  const get_lowest_selected = (levels: (number | null)[]) =>
    levels.find((v): v is number => typeof v === 'number') ?? null;

  const build_download_filename = async () => {
    const name_first_line = get_last_level_name(
      $selected_text_levels,
      $project_map_q.data,
      $project_state?.levels ?? 0
    )
      .split('\n')[0]
      .trim();
    const sarga_name_normal = await transliterate_custom(name_first_line, BASE_SCRIPT, 'Normal');
    const sarga_name_script = await transliterate_custom(name_first_line, BASE_SCRIPT, text_script);
    const is_not_brahmic_script = ['Normal', 'Romanized'].includes(text_script);
    const lowest_selected = get_lowest_selected($selected_text_levels);
    return (
      (lowest_selected ? `${lowest_selected} ` : '') +
      `${sarga_name_script}${is_not_brahmic_script ? '' : ` (${sarga_name_normal})`}.txt`
    );
  };

  const build_text_content = async (rows: NonNullable<typeof $text_data_q.data>) => {
    const texts = rows.map((row) => row.text);
    const indices = rows.map((row) => row.index);
    const { scriptTexts, normalTexts } = await transliterate_text_batch(
      texts,
      text_script,
      effective_include_normal
    );
    const translationMap =
      include_translation && $translation_q.isSuccess
        ? ($translation_q.data as Map<number, string>)
        : null;

    return format_download_text(scriptTexts, normalTexts, indices, translationMap, {
      textScript: text_script,
      includeNormal: effective_include_normal,
      includeTranslation: include_translation
    });
  };

  $effect(() => {
    const script = text_script;
    const with_normal = effective_include_normal;
    const with_translation = include_translation;
    const translation_data = $translation_q.data;

    if (!open || !$text_data_q.isSuccess || !$text_data_q.data) {
      preview_text = '';
      preview_loading = false;
      return;
    }

    const rows = $text_data_q.data.slice(0, PREVIEW_SHLOKA_COUNT);
    const translationReady = !with_translation || $translation_q.isSuccess;
    if (!translationReady) {
      preview_loading = true;
      return;
    }

    let cancelled = false;
    preview_loading = true;

    void (async () => {
      try {
        const texts = rows.map((row) => row.text);
        const indices = rows.map((row) => row.index);
        const { scriptTexts, normalTexts } = await transliterate_text_batch(
          texts,
          script,
          with_normal
        );
        const translationMap =
          with_translation && translation_data ? (translation_data as Map<number, string>) : null;
        preview_text = format_download_text(scriptTexts, normalTexts, indices, translationMap, {
          textScript: script,
          includeNormal: with_normal,
          includeTranslation: with_translation
        });
      } finally {
        if (!cancelled) preview_loading = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  });

  const download_text_file = async () => {
    if (!browser || !$text_data_q.isSuccess || !$text_data_q.data) return;
    if (include_translation && !$translation_q.isSuccess) return;

    downloading = true;
    try {
      const text = await build_text_content($text_data_q.data);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      download_file_in_browser(url, await build_download_filename(), true);
      open = false;
    } finally {
      downloading = false;
    }
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <Dialog.Title>Download Text File</Dialog.Title>
      <Dialog.Description>
        Choose how the text should be transliterated and preview the first few shlokas.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="download-text-script">Text script</Label>
        <Select.Root type="single" bind:value={text_script as never}>
          <Select.Trigger id="download-text-script" class="w-full">
            {text_script}
          </Select.Trigger>
          <Select.Content>
            {#each SCRIPT_LIST as script (script)}
              <Select.Item value={script}>{script}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <div class="flex flex-col gap-3 rounded-lg border p-3">
        <div class="text-sm font-medium">Optional sections</div>

        {#if show_normal_option}
          <label class="flex items-center gap-2 text-sm">
            <Checkbox bind:checked={include_normal} />
            <span>Normal transliteration below main text</span>
          </label>
        {/if}

        <label class="flex items-center gap-2 text-sm">
          <Checkbox bind:checked={include_translation} />
          <span>Include translation</span>
        </label>

        {#if include_translation}
          <div class="flex flex-col gap-1.5 pl-6">
            <Label for="download-text-translation-lang">Translation language</Label>
            {#if $langs_with_translations_q.isLoading}
              <Skeleton class="h-10 w-full" />
            {:else if lang_options.length === 0}
              <p class="text-sm text-muted-foreground">
                No translations available for this section.
              </p>
            {:else}
              <Select.Root
                type="single"
                value={$selected_lang_id === null ? undefined : String($selected_lang_id)}
                onValueChange={(value) => {
                  $selected_lang_id = value ? Number(value) : null;
                }}
              >
                <Select.Trigger id="download-text-translation-lang" class="w-full">
                  {selected_lang_label}
                </Select.Trigger>
                <Select.Content>
                  {#each lang_options as option (option.id)}
                    <Select.Item value={String(option.id)}>{option.label}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex flex-col gap-1.5">
        <Label>Preview (first {PREVIEW_SHLOKA_COUNT} shlokas)</Label>
        <ScrollArea class="h-44 rounded-md border bg-muted/30 p-3">
          {#if !$text_data_q.isSuccess}
            <Skeleton class="h-32 w-full" />
          {:else if preview_loading || (include_translation && $translation_q.isLoading)}
            <div class="flex h-32 items-center justify-center">
              <Skeleton class="h-24 w-full" />
            </div>
          {:else if preview_text}
            <pre class="font-sans text-sm whitespace-pre-wrap">{preview_text}</pre>
          {:else}
            <p class="text-sm text-muted-foreground">No preview available.</p>
          {/if}
        </ScrollArea>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button
        disabled={downloading ||
          !$text_data_q.isSuccess ||
          (include_translation &&
            (lang_options.length === 0 || $translation_q.isLoading || !$translation_q.isSuccess))}
        onclick={download_text_file}
      >
        {downloading ? 'Downloading...' : 'Download'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
