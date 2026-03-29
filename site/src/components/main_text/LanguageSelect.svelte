<script lang="ts">
  import Cookies from 'js-cookie';
  import { LANG_LIST, LANG_LIST_IDS } from '$app/state/lang_list';
  import { DEFAULT_LANG_ID, LANG_ID_COOKIE_NAME } from '~/lib/cookies';
  import { reload_current_page } from '~/lib/main_text/reload-page';
  import * as Select from '$lib/components/ui/select';

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
    <svg viewBox="0 0 24 24" class="size-4 text-muted-foreground" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.056 12h-2a1 1 0 0 0 0 2v2H17.87a3 3 0 0 0 .185-1a3 3 0 0 0-5.598-1.5a1 1 0 1 0 1.732 1a1 1 0 0 1 .866-.5a1 1 0 0 1 0 2a1 1 0 0 0 0 2a1 1 0 1 1 0 2a1 1 0 0 1-.866-.5a1 1 0 1 0-1.732 1a3 3 0 0 0 5.598-1.5a3 3 0 0 0-.185-1h1.185v3a1 1 0 0 0 2 0v-7a1 1 0 1 0 0-2m-11.97-.757a1 1 0 1 0 1.94-.486l-1.757-7.03a2.28 2.28 0 0 0-4.425 0l-1.758 7.03a1 1 0 1 0 1.94.486L5.585 9h2.94ZM6.086 7l.697-2.787a.292.292 0 0 1 .546 0L8.026 7Zm7.97 0h1a1 1 0 0 1 1 1v1a1 1 0 0 0 2 0V8a3.003 3.003 0 0 0-3-3h-1a1 1 0 0 0 0 2m-4 9h-1a1 1 0 0 1-1-1v-1a1 1 0 0 0-2 0v1a3.003 3.003 0 0 0 3 3h1a1 1 0 0 0 0-2"
      />
    </svg>
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
