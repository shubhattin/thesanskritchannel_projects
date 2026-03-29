<script lang="ts">
  import Cookies from 'js-cookie';
  import { LANG_LIST, LANG_LIST_IDS } from '$app/state/lang_list';
  import { DEFAULT_LANG_ID, LANG_ID_COOKIE_NAME } from '~/lib/cookies';
  import { reload_current_page } from '~/lib/main_text/reload-page';
  import * as Select from '$lib/components/ui/select';
  import LanguagesIcon from '@lucide/svelte/icons/languages';

  type Props = {
    initial_lang_id: number;
  };

  let { initial_lang_id }: Props = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(initial_lang_id);

  const options = [
    {
      id: DEFAULT_LANG_ID,
      label: '-- Select --'
    },
    ...LANG_LIST.map((lang, index) => ({
      id: LANG_LIST_IDS[index]!,
      label: lang
    }))
  ];

  async function handleValueChange(nextValue: string) {
    value = parseInt(nextValue);
    Cookies.set(LANG_ID_COOKIE_NAME, nextValue, {
      sameSite: 'lax',
      expires: 365
    });
    await reload_current_page();
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <LanguagesIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    <p class="text-sm text-muted-foreground">Translation</p>
  </div>
  <Select.Root type="single" value={value.toString()} onValueChange={handleValueChange}>
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
