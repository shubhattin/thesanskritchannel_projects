<script lang="ts">
  import Cookies from 'js-cookie';
  import { LANG_LIST, LANG_LIST_IDS } from '$app/state/lang_list';
  import { DEFAULT_LANG_ID, LANG_ID_COOKIE_NAME } from '~/lib/cookies';
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
      label: '--'
    },
    ...LANG_LIST.map((lang, index) => ({
      id: LANG_LIST_IDS[index]!,
      label: lang
    }))
  ];

  async function reloadCurrentPage() {
    try {
      if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        document.startViewTransition(() => {
          window.location.assign(window.location.href);
        });
        return;
      }
    } catch {}

    window.location.assign(window.location.href);
  }

  async function handleValueChange(nextValue: string) {
    value = parseInt(nextValue);
    Cookies.set(LANG_ID_COOKIE_NAME, nextValue, {
      sameSite: 'lax',
      expires: 365
    });
    await reloadCurrentPage();
  }
</script>

<div class="flex flex-col gap-2">
  <p class="text-sm text-muted-foreground">Translation</p>
  <Select.Root type="single" value={value.toString()} onValueChange={handleValueChange}>
    <Select.Trigger class="w-40 px-3 py-2 text-sm">
      {options.find((option) => option.id === value)?.label ?? '--'}
    </Select.Trigger>
    <Select.Content>
      {#each options as option (option.id)}
        <Select.Item value={option.id.toString()}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</div>
