<script lang="ts">
  import Cookies from 'js-cookie';
  import { SCRIPT_LIST, SCRIPT_LIST_IDS } from '$app/state/lang_list';
  import { SCRIPT_ID_COOKIE_NAME } from '~/lib/cookies';
  import { reload_current_page } from '~/lib/main_text/reload-page';
  import * as Select from '$lib/components/ui/select';

  type Props = {
    initial_script_id: number;
  };

  let { initial_script_id }: Props = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(initial_script_id);

  const options = SCRIPT_LIST.map((script, index) => ({
    id: SCRIPT_LIST_IDS[index]!,
    label: script
  }));

  async function handleValueChange(nextValue: string) {
    value = parseInt(nextValue);
    Cookies.set(SCRIPT_ID_COOKIE_NAME, nextValue, {
      sameSite: 'lax',
      expires: 365
    });
    await reload_current_page();
  }
</script>

<div class="flex flex-col gap-2">
  <p class="text-sm text-muted-foreground">Script</p>
  <Select.Root type="single" value={value.toString()} onValueChange={handleValueChange}>
    <Select.Trigger class="w-44 px-3 py-2 text-sm">
      {options.find((option) => option.id === value)?.label ?? 'Devanagari'}
    </Select.Trigger>
    <Select.Content>
      {#each options as option (option.id)}
        <Select.Item value={option.id.toString()}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</div>
