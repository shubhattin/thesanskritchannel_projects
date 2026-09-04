<script lang="ts">
  import Cookies from 'js-cookie';
  import {
    LANG_LIST,
    LANG_LIST_IDS,
    get_script_for_lang_id,
    get_script_id
  } from '@app/state/lang_list';
  import { NONE_LANG_ID, LANG_ID_COOKIE_NAME, SCRIPT_ID_COOKIE_NAME } from '~/lib/cookies';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';
  import * as Select from '$lib/components/ui/select';
  import LanguagesIcon from '@lucide/svelte/icons/languages';
  import { z } from 'zod/mini';

  const schema = z.object({
    translation: z.nullable(z.record(z.number(), z.string()))
  });
  const SchemaCompiled = z.compile(schema);

  type Props = {
    available_lang_ids: number[];
    project_id: number;
    path_params: number[];
    on_translation_change?: (translation: Record<number, string> | null) => void;
  };

  let { available_lang_ids, project_id, path_params, on_translation_change }: Props = $props();

  const available_lang_id_set = $derived(new Set(available_lang_ids));

  let value = $derived(
    available_lang_id_set.has(site_prefs.lang_id) ? site_prefs.lang_id : NONE_LANG_ID
  );
  $effect(() => {
    console.log('value changed', site_prefs.lang_id);
  });
  let loading = $state(false);

  const options = $derived([
    {
      id: NONE_LANG_ID,
      label: '-- Select --'
    },
    ...LANG_LIST.map((lang, index) => ({
      id: LANG_LIST_IDS[index]!,
      label: lang
    })).filter((option) => available_lang_id_set.has(option.id))
  ]);

  async function handleValueChange(nextValue: string) {
    const nextLang = parseInt(nextValue, 10);
    value = nextLang;
    Cookies.set(LANG_ID_COOKIE_NAME, nextValue, {
      sameSite: 'lax',
      expires: 365
    });
    site_prefs.set_lang_id(nextLang);

    const mappedScript = get_script_for_lang_id(nextLang);
    const mappedScriptId = mappedScript ? get_script_id(mappedScript) : null;
    if (mappedScriptId !== null && mappedScriptId !== site_prefs.script_id) {
      Cookies.set(SCRIPT_ID_COOKIE_NAME, String(mappedScriptId), {
        sameSite: 'lax',
        expires: 365
      });
      site_prefs.set_script_id(mappedScriptId);
    }

    if (nextLang === NONE_LANG_ID) {
      on_translation_change?.(null);
      return;
    }

    loading = true;
    try {
      const params = new URLSearchParams({
        project_id: String(project_id),
        lang_id: String(nextLang),
        path_params: path_params.join(',')
      });
      const res = await fetch(`/api/get_trans?${params}`);
      if (!res.ok) {
        on_translation_change?.(null);
        return;
      }
      const body = SchemaCompiled.parse(await res.json());
      on_translation_change?.(body.translation);
    } catch {
      on_translation_change?.(null);
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <LanguagesIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    <p class="text-sm text-muted-foreground">Translation</p>
  </div>
  <Select.Root
    type="single"
    value={value.toString()}
    onValueChange={handleValueChange}
    disabled={loading}
  >
    <Select.Trigger class="w-40 px-3 py-2 text-sm">
      {options.find((option) => option.id === value)?.label ?? '-- Select --'}
    </Select.Trigger>
    <Select.Content>
      {#each options as option (option.id)}
        <Select.Item value={option.id.toString()}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</div>
