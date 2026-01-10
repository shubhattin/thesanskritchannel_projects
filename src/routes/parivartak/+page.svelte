<script lang="ts">
  import Icon from '~/tools/Icon.svelte';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { SCRIPT_LIST, type script_list_type } from '~/state/lang_list';
  import { transliterate_custom } from '~/tools/converter';
  import { preloadScriptData, type ScriptLangType } from 'lipilekhika';
  import {
    createTypingContext,
    clearTypingContextOnKeyDown,
    handleTypingBeforeInputEvent
  } from 'lipilekhika/typing';
  import { FaCircleUp, FaCircleDown } from 'svelte-icons-pack/fa';
  import { writable } from 'svelte/store';
  import type { Writable } from 'svelte/store';
  import { BsKeyboard } from 'svelte-icons-pack/bs';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import { OiCopy16 } from 'svelte-icons-pack/oi';
  import { BiHelpCircle } from 'svelte-icons-pack/bi';
  import TypingAssistance from '~/components/TypingAssistance.svelte';
  import { get_font_family_and_size } from '~/tools/font_tools';
  import { PAGE_TITLES } from '~/state/page_titles';

  let from_lang = writable<script_list_type>('Devanagari');
  let to_lang = writable<script_list_type>('Telugu');

  let from_text = writable('');
  let to_text = writable('');

  let from_text_type_enabled = $state(true);
  let to_text_type_enabled = $state(true);

  $effect(() => {
    preloadScriptData($from_lang);
    preloadScriptData($to_lang);
  });

  async function convert_text(
    source_text: string,
    target: Writable<string>,
    source_lang: string,
    target_lang: string
  ) {
    target.set(
      await transliterate_custom(
        source_text,
        source_lang as ScriptLangType,
        target_lang as ScriptLangType
      )
    );
  }
  const copy_text_to_clipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const { title } = PAGE_TITLES['/parivartak'];
  const PAGE_INFO = {
    title: title,
    description: 'A Indian Script Transliteration Utility'
  };

  let typing_assistance_modal_opened = writable(false);

  let from_text_font_info = $derived(get_font_family_and_size($from_lang));
  let to_text_font_info = $derived(get_font_family_and_size($to_lang));

  const detect_shortcut_pressed = (event: KeyboardEvent, callback: (() => void) | null = null) => {
    event.preventDefault();
    if (event.altKey && event.key.toLowerCase() === 'x') callback && callback();
  };

  let from_ctx = $derived(createTypingContext($from_lang));
  let to_ctx = $derived(createTypingContext($to_lang));

  $effect(() => {
    from_ctx.ready;
    to_ctx.ready;
  });
</script>

<MetaTags
  title={PAGE_INFO.title}
  description={PAGE_INFO.description}
  share_image_info={{
    url: 'https://cdn.jsdelivr.net/gh/shubhattin/old_lipi_lekhika_archive@refs/heads/main/jAla/dist/i/bhasha.jpg',
    width: 913,
    height: 443
  }}
/>

<div class="mt-4">
  <div class="space-y-2">
    <div class="flex space-x-4">
      <select class="select w-40 ring-2" bind:value={$from_lang}>
        {#each SCRIPT_LIST as lang (lang)}
          <option value={lang}>{lang}</option>
        {/each}
      </select>
      <button
        title="Copy Text"
        class="btn p-0 outline-hidden select-none dark:hover:text-gray-400"
        onclick={() => copy_text_to_clipboard($from_text)}
      >
        <Icon src={OiCopy16} class="text-xl" />
      </button>
      <Switch
        name="from_text_type"
        checked={from_text_type_enabled}
        onCheckedChange={(e) => (from_text_type_enabled = e.checked)}
      >
        <Icon src={BsKeyboard} class="text-4xl" />
      </Switch>
      <span
        class="mt-3 hidden text-center text-sm text-stone-500 sm:inline-block dark:text-stone-400"
        >Use <span class="font-semibold">Alt+x</span> to toggle</span
      >
    </div>
    <textarea
      class="textarea h-56 ring-2"
      placeholder={`Enter text in ${$from_lang}`}
      style:font-size={`${from_text_font_info.size}rem`}
      style:font-family={from_text_font_info.family}
      bind:value={$from_text}
      onbeforeinput={(e) =>
        handleTypingBeforeInputEvent(
          from_ctx,
          e,
          (newValue) => ($from_text = newValue),
          from_text_type_enabled
        )}
      onblur={() => from_ctx.clearContext()}
      onkeydown={(e) => clearTypingContextOnKeyDown(e, from_ctx)}
    ></textarea>
  </div>
  <div class="my-3 flex justify-center space-x-3">
    <button
      class="btn p-0 outline-hidden"
      onclick={() => convert_text($to_text, from_text, $to_lang, $from_lang)}
      ><Icon
        src={FaCircleUp}
        class="text-3xl hover:text-gray-500 dark:hover:text-gray-400"
      /></button
    >
    <button
      class="btn p-0 outline-hidden"
      onclick={() => convert_text($from_text, to_text, $from_lang, $to_lang)}
      ><Icon
        src={FaCircleDown}
        class="text-3xl hover:text-gray-500 dark:hover:text-gray-400"
      /></button
    >
    <button
      class="btn rounded-md p-0 text-sm outline-hidden"
      title={'Language Typing Assistance'}
      onclick={() => ($typing_assistance_modal_opened = true)}
    >
      <Icon src={BiHelpCircle} class="text-4xl text-sky-500 dark:text-sky-400" />
    </button>
  </div>
  <div class="space-y-2">
    <div class="flex space-x-4">
      <select class="select w-40 ring-2" bind:value={$to_lang}>
        {#each SCRIPT_LIST as lang (lang)}
          <option value={lang}>{lang}</option>
        {/each}
      </select>
      <button
        title="Copy Text"
        class="btn p-0 outline-hidden select-none dark:hover:text-gray-400"
        onclick={() => copy_text_to_clipboard($to_text)}
      >
        <Icon src={OiCopy16} class="text-xl" />
      </button>
      <Switch
        name="to_text_type"
        checked={to_text_type_enabled}
        onCheckedChange={(e) => (to_text_type_enabled = e.checked)}
      >
        <Icon src={BsKeyboard} class="text-4xl" />
      </Switch>
    </div>
    <textarea
      class="textarea h-56 ring-2"
      style:font-size={`${to_text_font_info.size}rem`}
      style:font-family={to_text_font_info.family}
      placeholder={`Enter text in ${$to_lang}`}
      bind:value={$to_text}
      onbeforeinput={(e) =>
        handleTypingBeforeInputEvent(
          to_ctx,
          e,
          (newValue) => ($to_text = newValue),
          to_text_type_enabled
        )}
      onblur={() => to_ctx.clearContext()}
      onkeydown={(e) => clearTypingContextOnKeyDown(e, to_ctx)}
    ></textarea>
  </div>
</div>
<div class="mt-4 mb-2 text-sm text-stone-500 dark:text-stone-400">
  You should also refer
  <a
    href="https://app-lipilekhika.pages.dev/parivartak"
    target="_blank"
    class="text-blue-500 underline dark:text-blue-400">Lipi Lekhika (Lipi Parivartak)</a
  > for more functionality and wider language support.
</div>
<TypingAssistance
  bind:modal_opened={$typing_assistance_modal_opened}
  sync_lang_script={$from_lang}
/>
