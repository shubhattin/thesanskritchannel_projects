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
    image_shloka_data
  } from './state';
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

  let total_count = $derived(
    $project_map_q.isSuccess ? get_total_count($image_selected_levels) : 0
  );

  let settings_tab: 'depend' | 'non-depend' = $state('non-depend');

  const reset_func = () => {
    $shloka_configs[$current_shloka_type] = copy_plain_object(
      DEFAULT_SHLOKA_CONFIG[$current_shloka_type]
    );
    $SPACE_ABOVE_REFERENCE_LINE = DEFAULT_SHLOKA_CONFIG_SHARED.SPACE_ABOVE_REFERENCE_LINE;
    $normal_text_font_config = copy_plain_object(get_image_font_info('Normal'));
    $main_text_font_configs = copy_plain_object(DEFAULT_MAIN_TEXT_FONT_CONFIGS);
    $trans_text_font_configs = copy_plain_object(DEFAULT_TRANS_TEXT_FONT_CONFIGS);
    $image_shloka_data = deepCopy($image_text_data_q.data![$image_shloka]);
  };

  let text_data = $state('');
  let textarea_disabled = $state(true);

  $effect(() => {
    if ($image_shloka_data) {
      text_data = $image_shloka_data.text;
      textarea_disabled = true;
    }
  });
</script>

<div class="flex space-x-2 text-sm">
  <div class="inline-block space-x-1">
    <button
      class="p-0"
      disabled={$image_shloka === 0 || $image_rendering_state}
      onclick={() => {
        $image_shloka--;
      }}
    >
      <Icon src={TiArrowBackOutline} class="-mt-1 text-lg" />
    </button>
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
    <button
      class="p-0"
      onclick={() => {
        $image_shloka++;
      }}
      disabled={$image_shloka === total_count - 1 || $image_rendering_state}
    >
      <Icon src={TiArrowForwardOutline} class="-mt-1 text-lg" />
    </button>
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
    <button
      onclick={reset_func}
      class="rounded-md bg-muted px-1.5 py-1 text-xs font-bold hover:bg-muted/80">Reset</button
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
          <Tabs.Content value="non-depend">
            <div class="flex justify-center space-x-16">
              <div class="flex flex-col justify-center space-y-1">
                <div class="text-center text-sm font-semibold">Spaces</div>
                <div class="space-y-1 text-center">
                  <label class="block space-x-1">
                    <span class="text-sm">Above Reference Line</span>
                    <input
                      type="number"
                      class="inline-block w-12 rounded-md border border-input bg-background px-1 py-0 text-sm"
                      bind:value={$SPACE_ABOVE_REFERENCE_LINE}
                      min={0}
                      max={40}
                    />
                  </label>
                  <label class="block space-x-1">
                    <span class="text-sm">Between Main and Normal</span>
                    <input
                      type="number"
                      class="inline-block w-12 rounded-md border border-input bg-background px-1 py-0 text-sm"
                      bind:value={
                        $main_text_font_configs[$image_script].space_between_main_and_normal
                      }
                      min={0}
                      max={20}
                    />
                  </label>
                </div>
              </div>
              <div class="flex flex-col justify-center space-y-1">
                <div class="text-center text-sm font-semibold">Text Scaling factors</div>
                <div class="flex justify-center space-x-3 text-center">
                  <div class="flex flex-col justify-center space-y-1">
                    <label class="block space-x-1">
                      <span class="text-sm">Main</span>
                      <input
                        type="number"
                        class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
                        bind:value={$main_text_font_configs[$image_script].size}
                        min={0}
                        max={10}
                        step={0.05}
                      />
                    </label>
                    <label class="block space-x-1">
                      <span class="text-sm">Normal</span>
                      <input
                        type="number"
                        class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
                        bind:value={$normal_text_font_config.size}
                        min={0}
                        max={10}
                        step={0.05}
                      />
                    </label>
                  </div>
                  <div class="flex flex-col justify-center space-y-1">
                    <label class="space-x-1">
                      <span class="text-sm">Translation</span>
                      <input
                        type="number"
                        class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
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
                    <label class="space-x-1">
                      <span class="text-sm">Line Spacing</span>
                      <input
                        type="number"
                        class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
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
                </div>
              </div>
            </div>
          </Tabs.Content>
          <Tabs.Content value="depend">
            {#if $current_shloka_type && $shloka_configs[$current_shloka_type]}
              <div class="flex items-center justify-center space-x-4 text-sm">
                <span class="text-base font-bold">
                  Current Shloka Type : {$current_shloka_type}
                </span>
              </div>
              <div class="flex justify-center space-x-16">
                <div class="flex flex-col justify-center space-y-1">
                  <label class="space-x-1">
                    <span class="text-sm">Main Text</span>
                    <input
                      type="number"
                      class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].main_text_font_size}
                      min={10}
                    />
                  </label>
                  <label class="space-x-1">
                    <span class="text-sm">Normal Text</span>
                    <input
                      type="number"
                      class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].norm_text_font_size}
                      min={10}
                    />
                  </label>
                  <label class="space-x-1">
                    <span class="text-sm">Translation Text</span>
                    <input
                      type="number"
                      class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].trans_text_font_size}
                      min={10}
                    />
                  </label>
                </div>
                <div class="flex flex-col items-center justify-center space-y-2">
                  <div class="text-sm font-semibold">Boundaries</div>
                  <input
                    type="number"
                    class="block w-14 rounded border border-input bg-background px-1 py-0 text-sm"
                    bind:value={$shloka_configs[$current_shloka_type].bounding_coords.top}
                    min={0}
                    max={1080}
                  />
                  <div class="space-x-6">
                    <input
                      type="number"
                      class="inline-block w-16 rounded border border-input bg-background px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].bounding_coords.left}
                      min={0}
                      max={1920}
                    />
                    <input
                      type="number"
                      class="inline-block w-16 rounded border border-input bg-background px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].bounding_coords.right}
                      min={0}
                      max={1920}
                    />
                  </div>
                  <input
                    type="number"
                    class="inline-block w-16 rounded border border-input bg-background px-1 py-0 text-sm"
                    bind:value={$shloka_configs[$current_shloka_type].bounding_coords.bottom}
                    min={0}
                    max={1080}
                  />
                </div>
                <div class="flex flex-col items-center justify-center space-y-1">
                  <div class="font-semibold">Reference Lines</div>
                  <label class="inline-block space-x-1">
                    <span class="text-sm">Top Start</span>
                    <input
                      type="number"
                      class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
                      bind:value={$shloka_configs[$current_shloka_type].reference_lines.top}
                      min={10}
                    />
                  </label>
                  <label class="inline-block space-x-1">
                    <span class="text-sm">Spacing</span>
                    <input
                      type="number"
                      class="inline-block w-16 rounded-md border border-input bg-background px-1 py-0 text-sm"
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
        <div class="space-x-2.5">
          <span class="text-sm font-semibold">Text</span>
          {#if textarea_disabled}
            <button class="px-1 py-0.5" onclick={() => (textarea_disabled = false)}
              ><Icon src={FiEdit} class="text-base" /></button
            >
          {:else}
            <span class="space-x-0.5">
              <button
                class="inline-block px-0 py-0.5"
                disabled={$image_rendering_state}
                onclick={() => {
                  $image_shloka_data.text = text_data;
                  $image_shloka_data = $image_shloka_data;
                  $image_rendering_state = true;
                  render_all_texts(null, $image_script, $image_lang).then(() => {
                    $image_rendering_state = false;
                    textarea_disabled = true;
                  });
                }}><Icon src={FiSave} class="text-base" /></button
              >
              <button
                class="inline-block px-0 py-0.5"
                onclick={() => {
                  text_data = $image_shloka_data.text;
                  textarea_disabled = true;
                }}><Icon src={CgClose} class="text-base" /></button
              >
            </span>
          {/if}
        </div>
        <textarea
          class="indic-font mt-1 h-24 w-2/3 rounded-md border-2 border-input bg-background p-2 text-sm"
          bind:value={text_data}
          disabled={textarea_disabled}
        ></textarea>
      </div>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
