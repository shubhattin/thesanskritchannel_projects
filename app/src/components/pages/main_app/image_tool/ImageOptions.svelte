<script lang="ts">
  import { get_total_count, project_map_q } from '~/state/main_app/data.svelte';
  import {
    DEFAULT_MAIN_TEXT_FONT_CONFIGS,
    DEFAULT_TRANS_TEXT_FONT_CONFIGS,
    image_lang,
    image_rendering_state,
    image_selected_levels,
    image_script,
    image_shloka,
    image_trans_data_q,
    main_text_font_configs,
    normal_text_font_config,
    shaded_background_image_status,
    show_image_on_top_right,
    trans_text_font_configs,
    image_text_data_q,
    image_shloka_data,
    image_trans_text,
    image_render_colors,
    DEFAULT_IMAGE_TEXT_RENDER_COLORS,
    set_image_text_color,
    translation_bounding_coords
  } from './image_state';
  import { LANG_LIST, LANG_LIST_IDS, type lang_list_type } from '~/state/lang_list';
  import Icon from '~/tools/Icon.svelte';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import { LanguageIcon } from '~/components/icons';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Accordion from '$lib/components/ui/accordion';
  import { Switch } from '$lib/components/ui/switch';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import ImageDownloader from './ImageDownloader.svelte';
  import { DEFAULT_SHLOKA_CONFIG_SHARED, get_image_font_info } from './settings';
  import { IoOptions } from 'svelte-icons-pack/io';
  import {
    current_shloka_type,
    shloka_configs,
    SPACE_ABOVE_REFERENCE_LINE,
    DEFAULT_SHLOKA_CONFIG,
    DEFAULT_TRANSLATION_BOUNDING_COORDS,
    SHLOKA_NUMBER_TYPES,
    type shloka_number_type
  } from './settings';
  import { copy_plain_object, deepCopy } from '~/tools/kry';
  import { FiEdit, FiSave } from 'svelte-icons-pack/fi';
  import { CgClose } from 'svelte-icons-pack/cg';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import ImageColorField from './ImageColorField.svelte';
  import type { Snippet } from 'svelte';
  import {
    clearTypingContextOnKeyDown,
    createTypingContext,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';

  let total_count = $derived(
    $project_map_q.isSuccess ? get_total_count($image_selected_levels) : 0
  );

  let settings_tab: 'spacing' | 'text' | 'colors' | 'bounding' = $state('spacing');
  let bounding_tab: string = $state('1');

  let text_data = $state('');
  let text_textarea_disabled = $state(true);
  let trans_text_data = $state('');
  let trans_textarea_disabled = $state(true);
  let trans_text_available = $state(false);

  const current_lang = $derived(LANG_LIST[LANG_LIST_IDS.indexOf($image_lang)] as lang_list_type);

  let shloka_typing_ctx = $derived(
    createTypingContext('Devanagari', {
      includeInherentVowel: true
    })
  );
  $effect(() => {
    shloka_typing_ctx.ready;
  });

  const reset_func = () => {
    $shloka_configs = copy_plain_object(DEFAULT_SHLOKA_CONFIG);
    $translation_bounding_coords = copy_plain_object(DEFAULT_TRANSLATION_BOUNDING_COORDS);
    $SPACE_ABOVE_REFERENCE_LINE = DEFAULT_SHLOKA_CONFIG_SHARED.SPACE_ABOVE_REFERENCE_LINE;
    $normal_text_font_config = copy_plain_object(get_image_font_info('Normal'));
    $main_text_font_configs = copy_plain_object(DEFAULT_MAIN_TEXT_FONT_CONFIGS);
    $trans_text_font_configs = copy_plain_object(DEFAULT_TRANS_TEXT_FONT_CONFIGS);
    $image_render_colors = copy_plain_object(DEFAULT_IMAGE_TEXT_RENDER_COLORS);
    $image_shloka_data = deepCopy($image_text_data_q.data![$image_shloka]);
    if ($image_trans_data_q.data?.has($image_shloka)) {
      const translation = $image_trans_data_q.data.get($image_shloka)!;
      trans_text_data = translation;
      $image_trans_text = translation;
    } else {
      trans_text_data = '';
      $image_trans_text = '';
    }
    trans_textarea_disabled = true;
  };

  $effect(() => {
    if ($image_shloka_data) {
      text_data = $image_shloka_data.text;
      text_textarea_disabled = true;
    }
  });

  $effect(() => {
    $image_shloka;
    $image_lang;
    if ($image_trans_data_q.isSuccess && $image_trans_data_q.data) {
      const translation = $image_trans_data_q.data.get($image_shloka) ?? '';
      trans_text_data = translation;
      $image_trans_text = translation;
      trans_text_available = $image_trans_data_q.data.has($image_shloka);
      trans_textarea_disabled = true;
    }
  });
</script>

{#snippet option_panel(title: string, description: string | undefined, content: Snippet)}
  <section class="rounded-lg border border-border bg-muted/30 p-4">
    <div class="mb-3">
      <h3 class="text-sm font-semibold">{title}</h3>
      {#if description}
        <p class="mt-0.5 text-xs text-muted-foreground">{description}</p>
      {/if}
    </div>
    {@render content()}
  </section>
{/snippet}

{#snippet bounding_cross_shloka(type: shloka_number_type)}
  <div class="space-y-2">
    <p class="text-center text-xs font-medium text-muted-foreground">Shloka area</p>
    <div
      class="mx-auto grid w-fit grid-cols-[4.5rem_4.5rem_4.5rem] grid-rows-[auto_auto_auto] gap-1.5"
    >
      <div></div>
      <Input
        type="number"
        class="h-8 px-2 text-center text-sm tabular-nums"
        bind:value={$shloka_configs[type].bounding_coords.top}
        min={0}
        max={1080}
        aria-label="Shloka top"
      />
      <div></div>
      <Input
        type="number"
        class="h-8 px-2 text-center text-sm tabular-nums"
        bind:value={$shloka_configs[type].bounding_coords.left}
        min={0}
        max={1920}
        aria-label="Shloka left"
      />
      <div
        class="flex items-center justify-center rounded-md border border-dashed border-border bg-background/60 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
      >
        box
      </div>
      <Input
        type="number"
        class="h-8 px-2 text-center text-sm tabular-nums"
        bind:value={$shloka_configs[type].bounding_coords.right}
        min={0}
        max={1920}
        aria-label="Shloka right"
      />
      <div></div>
      <Input
        type="number"
        class="h-8 px-2 text-center text-sm tabular-nums"
        bind:value={$shloka_configs[type].bounding_coords.bottom}
        min={0}
        max={1080}
        aria-label="Shloka bottom"
      />
      <div></div>
    </div>
  </div>
{/snippet}

{#snippet bounding_cross_translation()}
  <div class="space-y-2">
    <p class="text-center text-xs font-medium text-muted-foreground">Translation area</p>
    <div
      class="mx-auto grid w-fit grid-cols-[4.5rem_4.5rem_4.5rem] grid-rows-[auto_auto_auto] gap-1.5"
    >
      <div></div>
      <Input
        type="number"
        class="h-8 px-2 text-center text-sm tabular-nums"
        bind:value={$translation_bounding_coords.top}
        min={0}
        max={1080}
        aria-label="Translation top"
      />
      <div></div>
      <Input
        type="number"
        class="h-8 px-2 text-center text-sm tabular-nums"
        bind:value={$translation_bounding_coords.left}
        min={0}
        max={1920}
        aria-label="Translation left"
      />
      <div
        class="flex items-center justify-center rounded-md border border-dashed border-border bg-background/60 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
      >
        box
      </div>
      <Input
        type="number"
        class="h-8 px-2 text-center text-sm tabular-nums"
        bind:value={$translation_bounding_coords.right}
        min={0}
        max={1920}
        aria-label="Translation right"
      />
      <div></div>
      <Input
        type="number"
        class="h-8 px-2 text-center text-sm tabular-nums"
        bind:value={$translation_bounding_coords.bottom}
        min={0}
        max={1080}
        aria-label="Translation bottom"
      />
      <div></div>
    </div>
  </div>
{/snippet}

{#snippet shloka_config_fields(type: shloka_number_type)}
  <div class="grid gap-4 pt-3 lg:grid-cols-3">
    {#snippet font_sizes_content()}
      <div class="space-y-2">
        <label class="flex items-center justify-between gap-4 text-sm">
          <span class="text-muted-foreground">Main text</span>
          <Input
            type="number"
            class="h-8 w-24 shrink-0 px-2 text-sm tabular-nums"
            bind:value={$shloka_configs[type].main_text_font_size}
            min={10}
          />
        </label>
        <label class="flex items-center justify-between gap-4 text-sm">
          <span class="text-muted-foreground">Normal text</span>
          <Input
            type="number"
            class="h-8 w-24 shrink-0 px-2 text-sm tabular-nums"
            bind:value={$shloka_configs[type].norm_text_font_size}
            min={10}
          />
        </label>
        <label class="flex items-center justify-between gap-4 text-sm">
          <span class="text-muted-foreground">Translation text</span>
          <Input
            type="number"
            class="h-8 w-24 shrink-0 px-2 text-sm tabular-nums"
            bind:value={$shloka_configs[type].trans_text_font_size}
            min={10}
          />
        </label>
      </div>
    {/snippet}
    {@render option_panel(
      'Font sizes',
      `Base font sizes for ${type}-line shlokas`,
      font_sizes_content
    )}

    {#snippet boundaries_content()}
      {@render bounding_cross_shloka(type)}
    {/snippet}
    {@render option_panel(
      'Shloka boundaries',
      'Canvas coordinates (1920 × 1080)',
      boundaries_content
    )}

    {#snippet reference_lines_content()}
      <div class="space-y-2">
        <label class="flex items-center justify-between gap-4 text-sm">
          <span class="text-muted-foreground">Top start</span>
          <Input
            type="number"
            class="h-8 w-24 shrink-0 px-2 text-sm tabular-nums"
            bind:value={$shloka_configs[type].reference_lines.top}
            min={10}
          />
        </label>
        <label class="flex items-center justify-between gap-4 text-sm">
          <span class="text-muted-foreground">Line spacing</span>
          <Input
            type="number"
            class="h-8 w-24 shrink-0 px-2 text-sm tabular-nums"
            bind:value={$shloka_configs[type].reference_lines.spacing}
            min={10}
          />
        </label>
      </div>
    {/snippet}
    {@render option_panel(
      'Reference lines',
      'Horizontal guide lines for text alignment',
      reference_lines_content
    )}
  </div>
{/snippet}

<div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
  <div class="inline-flex items-center gap-1">
    <Button
      variant="ghost"
      size="icon-sm"
      class="h-7 w-7 p-0"
      disabled={$image_shloka === 0 || $image_rendering_state}
      onclick={() => {
        $image_shloka--;
      }}
    >
      <Icon src={TiArrowBackOutline} class="-mt-1 text-lg" />
    </Button>
    <Select.Root
      type="single"
      value={$image_shloka.toString()}
      onValueChange={(v) => {
        $image_shloka = parseInt(v) || 0;
      }}
      disabled={$image_rendering_state}
    >
      <Select.Trigger class="inline-flex w-20 p-1 text-sm">
        {$image_shloka}{$image_text_data_q.data?.[$image_shloka]?.shloka_num &&
          ` - ${$image_text_data_q.data![$image_shloka].shloka_num}`}
      </Select.Trigger>
      <Select.Content>
        {#if $image_text_data_q.isSuccess && !$image_text_data_q.isFetching}
          {#each Array(total_count) as _, index (index)}
            <Select.Item value={index.toString()}>
              {index}{$image_text_data_q.data![index]?.shloka_num &&
                ` - ${$image_text_data_q.data![index].shloka_num}`}
            </Select.Item>
          {/each}
        {/if}
      </Select.Content>
    </Select.Root>
    <Button
      variant="ghost"
      size="icon-sm"
      class="h-7 w-7 p-0"
      onclick={() => {
        $image_shloka++;
      }}
      disabled={$image_shloka === total_count - 1 || $image_rendering_state}
    >
      <Icon src={TiArrowForwardOutline} class="-mt-1 text-lg" />
    </Button>
  </div>

  <label class="inline-flex items-center gap-1">
    <Icon src={LanguageIcon} class="text-xl" />
    <Select.Root
      type="single"
      value={$image_lang.toString()}
      onValueChange={(v) => {
        $image_lang = parseInt(v) || 0;
      }}
      disabled={$image_trans_data_q.isFetching || !$image_trans_data_q.isSuccess}
    >
      <Select.Trigger class="inline-flex w-24 p-1 text-sm">
        {current_lang ?? 'English'}
      </Select.Trigger>
      <Select.Content>
        {#each LANG_LIST as lang, i (lang)}
          <Select.Item value={LANG_LIST_IDS[i].toString()}>{lang}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </label>

  <ImageDownloader />

  <div class="inline-flex items-center gap-1.5">
    <Switch id="use-template-image" bind:checked={$shaded_background_image_status} />
    <Label for="use-template-image" class="cursor-pointer text-xs font-medium">
      Use template image
    </Label>
  </div>

  <Button onclick={reset_func} variant="outline" size="sm" class="h-7 px-2 text-xs font-semibold">
    Reset defaults
  </Button>
</div>

<Accordion.Root type="single" class="max-w-full">
  <Accordion.Item value="options">
    <Accordion.Trigger class="flex items-center justify-start gap-2 text-start">
      <Icon src={IoOptions} class="-mt-1 text-2xl" />
      <span class="text-sm font-bold">Image options</span>
    </Accordion.Trigger>
    <Accordion.Content>
      <Tabs.Root bind:value={settings_tab} class="space-y-3">
        <Tabs.List class="flex h-auto w-full flex-wrap gap-1">
          <Tabs.Trigger value="spacing" class="text-xs sm:text-sm"
            >Spacing &amp; scaling</Tabs.Trigger
          >
          <Tabs.Trigger value="text" class="text-xs sm:text-sm">Edit text</Tabs.Trigger>
          <Tabs.Trigger value="colors" class="text-xs sm:text-sm">Colours</Tabs.Trigger>
          <Tabs.Trigger value="bounding" class="text-xs sm:text-sm">Bounding boxes</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="spacing" class="space-y-4 pt-1">
          <div class="grid gap-4 md:grid-cols-2">
            {#snippet spacing_fields()}
              <div class="space-y-2">
                <label class="flex items-center justify-between gap-4 text-sm">
                  <span class="text-muted-foreground">Above reference line</span>
                  <Input
                    type="number"
                    class="h-8 w-24 shrink-0 px-2 text-sm tabular-nums"
                    bind:value={$SPACE_ABOVE_REFERENCE_LINE}
                    min={0}
                    max={40}
                  />
                </label>
                <label class="flex items-center justify-between gap-4 text-sm">
                  <span class="text-muted-foreground">Main ↔ normal</span>
                  <Input
                    type="number"
                    class="h-8 w-24 shrink-0 px-2 text-sm tabular-nums"
                    bind:value={
                      $main_text_font_configs[$image_script].space_between_main_and_normal
                    }
                    min={0}
                    max={20}
                  />
                </label>
              </div>
              <div class="mt-4 flex items-center gap-2 border-t border-border pt-3">
                <Switch id="show-shloka-number" bind:checked={$show_image_on_top_right} />
                <Label for="show-shloka-number" class="cursor-pointer text-sm font-medium">
                  Show shloka number (top right)
                </Label>
              </div>
            {/snippet}
            {@render option_panel(
              'Spacing',
              'Gaps between text elements on the canvas',
              spacing_fields
            )}

            {#snippet scaling_fields()}
              <div class="grid grid-cols-2 gap-3">
                <label class="space-y-1 text-sm">
                  <span class="text-muted-foreground">Main</span>
                  <Input
                    type="number"
                    class="h-8 w-full px-2 text-sm tabular-nums"
                    bind:value={$main_text_font_configs[$image_script].size}
                    min={0}
                    max={10}
                    step={0.05}
                  />
                </label>
                <label class="space-y-1 text-sm">
                  <span class="text-muted-foreground">Normal</span>
                  <Input
                    type="number"
                    class="h-8 w-full px-2 text-sm tabular-nums"
                    bind:value={$normal_text_font_config.size}
                    min={0}
                    max={10}
                    step={0.05}
                  />
                </label>
                <label class="space-y-1 text-sm">
                  <span class="text-muted-foreground">Translation</span>
                  <Input
                    type="number"
                    class="h-8 w-full px-2 text-sm tabular-nums"
                    bind:value={$trans_text_font_configs[current_lang].size}
                    min={0}
                    max={10}
                    step={0.05}
                  />
                </label>
                <label class="space-y-1 text-sm">
                  <span class="text-muted-foreground">Line spacing</span>
                  <Input
                    type="number"
                    class="h-8 w-full px-2 text-sm tabular-nums"
                    bind:value={$trans_text_font_configs[current_lang].new_line_spacing}
                    min={0}
                    max={10}
                    step={0.05}
                  />
                </label>
              </div>
            {/snippet}
            {@render option_panel(
              'Text scaling',
              `Relative scale for ${$image_script} script`,
              scaling_fields
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="text" class="space-y-4 pt-1">
          <p
            class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
          >
            Text edits apply to the <strong>current image preview only</strong>. They are not
            included in zip downloads.
          </p>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-lg border border-border bg-muted/30 p-4">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Shloka text</h3>
                {#if text_textarea_disabled}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onclick={() => (text_textarea_disabled = false)}
                  >
                    <Icon src={FiEdit} class="size-4" />
                  </Button>
                {:else}
                  <div class="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={$image_rendering_state}
                      onclick={() => {
                        $image_shloka_data.text = text_data;
                        $image_shloka_data = $image_shloka_data;
                        text_textarea_disabled = true;
                      }}
                    >
                      <Icon src={FiSave} class="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onclick={() => {
                        text_data = $image_shloka_data.text;
                        text_textarea_disabled = true;
                      }}
                    >
                      <Icon src={CgClose} class="size-4" />
                    </Button>
                  </div>
                {/if}
              </div>
              <Textarea
                class="indic-font field-sizing-fixed h-36 w-full resize-none overflow-y-auto rounded-md border border-input bg-background p-3 text-sm"
                bind:value={text_data}
                disabled={text_textarea_disabled}
                onbeforeinput={(e) =>
                  handleTypingBeforeInputEvent(
                    shloka_typing_ctx,
                    e,
                    (newValue) => {
                      text_data = newValue;
                    },
                    !text_textarea_disabled
                  )}
                onblur={() => shloka_typing_ctx.clearContext()}
                onkeydown={(e) => clearTypingContextOnKeyDown(e, shloka_typing_ctx)}
              />
            </div>

            <div class="rounded-lg border border-border bg-muted/30 p-4">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Translation</h3>
                {#if trans_textarea_disabled}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!trans_text_available}
                    onclick={() => (trans_textarea_disabled = false)}
                  >
                    <Icon src={FiEdit} class="size-4" />
                  </Button>
                {:else}
                  <div class="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={$image_rendering_state}
                      onclick={() => {
                        $image_trans_text = trans_text_data;
                        trans_textarea_disabled = true;
                      }}
                    >
                      <Icon src={FiSave} class="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onclick={() => {
                        trans_text_data = $image_trans_text;
                        trans_textarea_disabled = true;
                      }}
                    >
                      <Icon src={CgClose} class="size-4" />
                    </Button>
                  </div>
                {/if}
              </div>
              <Textarea
                class="field-sizing-fixed h-36 w-full resize-none overflow-y-auto rounded-md border border-input bg-background p-3 text-sm"
                bind:value={trans_text_data}
                disabled={trans_textarea_disabled || !trans_text_available}
                placeholder={trans_text_available ? '' : 'No translation for this shloka'}
              />
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="colors" class="pt-1">
          <section class="rounded-lg border border-border bg-muted/30 p-4">
            <div class="mb-3">
              <h3 class="text-sm font-semibold">Text colours</h3>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Fill colours used when rendering text on the canvas
              </p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <ImageColorField
                label="Main"
                value={$image_render_colors.main}
                onValueChange={(v) => set_image_text_color('main', v)}
              />
              <ImageColorField
                label="Normal"
                value={$image_render_colors.normal}
                onValueChange={(v) => set_image_text_color('normal', v)}
              />
              <ImageColorField
                label="Number"
                value={$image_render_colors.number}
                onValueChange={(v) => set_image_text_color('number', v)}
              />
              <ImageColorField
                label="Translation"
                value={$image_render_colors.translation}
                onValueChange={(v) => set_image_text_color('translation', v)}
              />
            </div>
          </section>
        </Tabs.Content>

        <Tabs.Content value="bounding" class="space-y-4 pt-1">
          <div class="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
            {#if $current_shloka_type}
              <p class="text-sm text-muted-foreground">
                Detected shloka type:
                <span class="font-semibold text-foreground">
                  {$current_shloka_type} line{$current_shloka_type === 1 ? '' : 's'}
                </span>
              </p>
            {:else}
              <p class="text-sm text-muted-foreground">Detecting shloka type…</p>
            {/if}
          </div>

          <Tabs.Root bind:value={bounding_tab}>
            <Tabs.List class="flex h-auto flex-wrap gap-1">
              {#each SHLOKA_NUMBER_TYPES as type (type)}
                <Tabs.Trigger value={type.toString()} class="text-xs sm:text-sm">
                  {type} line{type === 1 ? '' : 's'}
                </Tabs.Trigger>
              {/each}
              <Tabs.Trigger value="translation" class="text-xs sm:text-sm">Translation</Tabs.Trigger
              >
            </Tabs.List>

            {#each SHLOKA_NUMBER_TYPES as type (type)}
              <Tabs.Content value={type.toString()}>
                {@render shloka_config_fields(type)}
              </Tabs.Content>
            {/each}

            <Tabs.Content value="translation">
              <div class="pt-3">
                {#snippet translation_boundaries()}
                  {@render bounding_cross_translation()}
                {/snippet}
                {@render option_panel(
                  'Translation boundaries',
                  'Area where translation text is laid out on the canvas',
                  translation_boundaries
                )}
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </Tabs.Content>
      </Tabs.Root>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
