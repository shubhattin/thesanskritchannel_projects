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
    trans_text_font_configs,
    image_text_data_q,
    image_shloka_data,
    image_trans_text,
    image_render_colors,
    DEFAULT_IMAGE_TEXT_RENDER_COLORS,
    set_image_text_color
  } from './image_state';
  import { LANG_LIST, LANG_LIST_IDS, type lang_list_type } from '~/state/lang_list';
  import Icon from '~/tools/Icon.svelte';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import { LanguageIcon } from '~/components/icons';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Accordion from '$lib/components/ui/accordion';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import ImageDownloader from './ImageDownloader.svelte';
  import { DEFAULT_SHLOKA_CONFIG_SHARED, get_image_font_info } from './settings';
  import { IoOptions } from 'svelte-icons-pack/io';
  import {
    current_shloka_type,
    shloka_configs,
    SPACE_ABOVE_REFERENCE_LINE,
    DEFAULT_SHLOKA_CONFIG
  } from './settings';
  import { copy_plain_object, deepCopy } from '~/tools/kry';
  import { FiEdit, FiSave } from 'svelte-icons-pack/fi';
  import { CgClose } from 'svelte-icons-pack/cg';
  import { render_all_texts } from './render_text';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import ImageColorField from './ImageColorField.svelte';

  let total_count = $derived(
    $project_map_q.isSuccess ? get_total_count($image_selected_levels) : 0
  );

  let settings_tab: 'depend' | 'non-depend' = $state('non-depend');

  let text_data = $state('');
  let text_textarea_disabled = $state(true);
  let trans_text_data = $state('');
  let trans_textarea_disabled = $state(true);
  let trans_text_available = $state(false);

  const reset_func = () => {
    $shloka_configs[$current_shloka_type] = copy_plain_object(
      DEFAULT_SHLOKA_CONFIG[$current_shloka_type]
    );
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

<div class="flex items-center space-x-2 text-sm">
  <div class="inline-block space-x-1">
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
          {#each Array(total_count) as _, index}
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
  <label class="inline-block space-x-1">
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
        {LANG_LIST[LANG_LIST_IDS.indexOf($image_lang)] ?? 'English'}
      </Select.Trigger>
      <Select.Content>
        {#each LANG_LIST as lang, i (lang)}
          <Select.Item value={LANG_LIST_IDS[i].toString()}>{lang}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </label>
  <ImageDownloader />
  <Switch bind:checked={$shaded_background_image_status} />
  <span class="flex flex-col items-center justify-center">
    <Button
      onclick={reset_func}
      variant="outline"
      class="rounded-md bg-muted px-1.5 py-1 text-xs font-bold hover:bg-muted/80">Reset</Button
    >
  </span>
</div>

<Accordion.Root type="single" class="max-w-full">
  <Accordion.Item value="options">
    <Accordion.Trigger class="flex items-center justify-start gap-2 text-start">
      <Icon src={IoOptions} class="-mt-1 text-2xl" />
      <span class="text-sm font-bold">Change Default Options</span>
    </Accordion.Trigger>
    <Accordion.Content>
      <div class="space-y-2">
        <Tabs.Root bind:value={settings_tab}>
          <Tabs.List>
            <Tabs.Trigger value="non-depend"
              ><span class="text-sm">Shloka Type Independent</span></Tabs.Trigger
            >
            <Tabs.Trigger value="depend"
              ><span class="text-sm">Shloka Type Dependent</span></Tabs.Trigger
            >
          </Tabs.List>
          <Tabs.Content value="non-depend" class="pt-2">
            <div class="grid gap-5 xl:grid-cols-2">
              <div class="grid gap-4 sm:grid-cols-2">
                <section class="space-y-2">
                  <h3 class="text-sm font-semibold">Spaces</h3>
                  <div class="space-y-2">
                    <label class="flex items-center justify-between gap-3 text-sm">
                      <span class="text-muted-foreground">Above ref. line</span>
                      <Input
                        type="number"
                        class="h-7 w-16 shrink-0 px-1 py-0 text-sm"
                        bind:value={$SPACE_ABOVE_REFERENCE_LINE}
                        min={0}
                        max={40}
                      />
                    </label>
                    <label class="flex items-center justify-between gap-3 text-sm">
                      <span class="text-muted-foreground">Main ↔ normal</span>
                      <Input
                        type="number"
                        class="h-7 w-16 shrink-0 px-1 py-0 text-sm"
                        bind:value={
                          $main_text_font_configs[$image_script].space_between_main_and_normal
                        }
                        min={0}
                        max={20}
                      />
                    </label>
                  </div>
                </section>
                <section class="space-y-2">
                  <h3 class="text-sm font-semibold">Text scaling</h3>
                  <div class="grid grid-cols-2 gap-2">
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="text-muted-foreground">Main</span>
                      <Input
                        type="number"
                        class="h-7 w-full px-1 py-0 text-sm"
                        bind:value={$main_text_font_configs[$image_script].size}
                        min={0}
                        max={10}
                        step={0.05}
                      />
                    </label>
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="text-muted-foreground">Normal</span>
                      <Input
                        type="number"
                        class="h-7 w-full px-1 py-0 text-sm"
                        bind:value={$normal_text_font_config.size}
                        min={0}
                        max={10}
                        step={0.05}
                      />
                    </label>
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="text-muted-foreground">Translation</span>
                      <Input
                        type="number"
                        class="h-7 w-full px-1 py-0 text-sm"
                        bind:value={
                          $trans_text_font_configs[
                            LANG_LIST[LANG_LIST_IDS.indexOf($image_lang)] as lang_list_type
                          ].size
                        }
                        min={0}
                        max={10}
                        step={0.05}
                      />
                    </label>
                    <label class="flex flex-col gap-1 text-sm">
                      <span class="text-muted-foreground">Line spacing</span>
                      <Input
                        type="number"
                        class="h-7 w-full px-1 py-0 text-sm"
                        bind:value={
                          $trans_text_font_configs[
                            LANG_LIST[LANG_LIST_IDS.indexOf($image_lang)] as lang_list_type
                          ].new_line_spacing
                        }
                        min={0}
                        max={10}
                        step={0.05}
                      />
                    </label>
                  </div>
                </section>
              </div>
              <section class="min-w-0 space-y-2">
                <h3 class="text-sm font-semibold">Text colors</h3>
                <div class="grid gap-2">
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
            </div>
          </Tabs.Content>
          <Tabs.Content value="depend">
            {#if $current_shloka_type && $shloka_configs[$current_shloka_type]}
              <div class="flex items-center justify-center space-x-4 text-sm">
                <span class="text-base font-bold">
                  Current Shloka Type : {$current_shloka_type}
                </span>
              </div>
              <div class="flex flex-wrap justify-center gap-x-16 gap-y-4">
                <div class="flex flex-col justify-center space-y-1">
                  <label class="space-x-1">
                    <span class="text-sm">Main Text</span>
                    <Input
                      type="number"
                      class="inline-block h-7 w-20 px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].main_text_font_size}
                      min={10}
                    />
                  </label>
                  <label class="space-x-1">
                    <span class="text-sm">Normal Text</span>
                    <Input
                      type="number"
                      class="inline-block h-7 w-20 px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].norm_text_font_size}
                      min={10}
                    />
                  </label>
                  <label class="space-x-1">
                    <span class="text-sm">Translation Text</span>
                    <Input
                      type="number"
                      class="inline-block h-7 w-20 px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].trans_text_font_size}
                      min={10}
                    />
                  </label>
                </div>
                <div class="flex flex-col items-center justify-center space-y-2">
                  <div class="text-sm font-semibold">Boundaries</div>
                  <Input
                    type="number"
                    class="block h-7 w-16 px-1 py-0 text-sm"
                    bind:value={$shloka_configs[$current_shloka_type].bounding_coords.top}
                    min={0}
                    max={1080}
                  />
                  <div class="space-x-6">
                    <Input
                      type="number"
                      class="inline-block h-7 w-20 px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].bounding_coords.left}
                      min={0}
                      max={1920}
                    />
                    <Input
                      type="number"
                      class="inline-block h-7 w-20 px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].bounding_coords.right}
                      min={0}
                      max={1920}
                    />
                  </div>
                  <Input
                    type="number"
                    class="inline-block h-7 w-20 px-1 py-0 text-sm"
                    bind:value={$shloka_configs[$current_shloka_type].bounding_coords.bottom}
                    min={0}
                    max={1080}
                  />
                </div>
                <div class="flex flex-col items-center justify-center space-y-1">
                  <div class="font-semibold">Reference Lines</div>
                  <label class="inline-block space-x-1">
                    <span class="text-sm">Top Start</span>
                    <Input
                      type="number"
                      class="inline-block h-7 w-20 px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].reference_lines.top}
                      min={10}
                    />
                  </label>
                  <label class="inline-block space-x-1">
                    <span class="text-sm">Spacing</span>
                    <Input
                      type="number"
                      class="inline-block h-7 w-20 px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].reference_lines.spacing}
                      min={10}
                    />
                  </label>
                </div>
              </div>
            {:else}
              <div class="flex items-center justify-center p-4 text-sm text-muted-foreground">
                Loading shloka configuration...
              </div>
            {/if}
          </Tabs.Content>
        </Tabs.Root>
      </div>
      <div class="mt-2 block">
        <div class="flex items-center space-x-2">
          <span class="mt-1 text-base font-semibold">Text</span>
          {#if text_textarea_disabled}
            <Button variant="ghost" size="icon-sm" onclick={() => (text_textarea_disabled = false)}
              ><Icon src={FiEdit} class="size-4" /></Button
            >
          {:else}
            <div class="flex items-center space-x-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={$image_rendering_state}
                onclick={() => {
                  $image_shloka_data.text = text_data;
                  $image_shloka_data = $image_shloka_data;
                  $image_rendering_state = true;
                  render_all_texts(null, $image_script, $image_lang).then(() => {
                    $image_rendering_state = false;
                    text_textarea_disabled = true;
                  });
                }}><Icon src={FiSave} class="size-4" /></Button
              >
              <Button
                variant="ghost"
                size="icon-sm"
                onclick={() => {
                  text_data = $image_shloka_data.text;
                  text_textarea_disabled = true;
                }}><Icon src={CgClose} class="size-4" /></Button
              >
            </div>
          {/if}
        </div>
        <Textarea
          class="indic-font mt-1 h-24 w-2/3 rounded-md border-2 border-input bg-background p-2 text-sm"
          bind:value={text_data}
          disabled={text_textarea_disabled}
        ></Textarea>
        <div class="mt-4">
          <div class="flex items-center space-x-2">
            <span class="mt-1 text-base font-semibold">Translation</span>
            {#if trans_textarea_disabled}
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!trans_text_available}
                onclick={() => (trans_textarea_disabled = false)}
                ><Icon src={FiEdit} class="size-4" /></Button
              >
            {:else}
              <div class="flex items-center space-x-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={$image_rendering_state}
                  onclick={() => {
                    $image_trans_text = trans_text_data;
                    $image_rendering_state = true;
                    render_all_texts(null, $image_script, $image_lang).then(() => {
                      $image_rendering_state = false;
                      trans_textarea_disabled = true;
                    });
                  }}><Icon src={FiSave} class="size-4" /></Button
                >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onclick={() => {
                    trans_text_data = $image_trans_text;
                    trans_textarea_disabled = true;
                  }}><Icon src={CgClose} class="size-4" /></Button
                >
              </div>
            {/if}
          </div>
          <Textarea
            class="mt-1 h-24 w-2/3 rounded-md border-2 border-input bg-background p-2 text-sm"
            bind:value={trans_text_data}
            disabled={trans_textarea_disabled || !trans_text_available}
            placeholder={trans_text_available ? '' : 'No translation for this shloka'}
          ></Textarea>
        </div>
      </div>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
