<script lang="ts">
  import ScriptSelector from '~/components/utils/ScriptSelector.svelte';
  import Cookies from 'js-cookie';
  import {
    SCRIPT_LIST,
    SCRIPT_LIST_IDS,
    get_script_from_id,
    type script_list_type
  } from '$app/state/lang_list';
  import { SCRIPT_ID_COOKIE_NAME } from '~/lib/cookies';
  import { reload_current_page } from '~/lib/main_text/reload-page';
  import { type ScriptListType } from 'lipilekhika';
  import PenLineIcon from '@lucide/svelte/icons/pen-line';

  let { initial_script_id }: { initial_script_id: number } = $props();

  function idToScript(id: number): script_list_type {
    const s = get_script_from_id(id);
    return (s ?? get_script_from_id(1)) as script_list_type;
  }

  // svelte-ignore state_referenced_locally -- normalize once from initial prop
  const initialScript = idToScript(initial_script_id);
  const initialIdx = SCRIPT_LIST.indexOf(initialScript);
  const normalizedInitialId =
    initialIdx === -1 ? SCRIPT_LIST_IDS[0]! : SCRIPT_LIST_IDS[initialIdx]!;

  // svelte-ignore state_referenced_locally type_check
  let script = $state(initialScript);
  // svelte-ignore state_referenced_locally
  let last_persisted_id = $state(normalizedInitialId);

  // svelte-ignore state_referenced_locally -- compare to raw prop for cookie repair
  if (typeof window !== 'undefined' && normalizedInitialId !== initial_script_id) {
    Cookies.set(SCRIPT_ID_COOKIE_NAME, String(normalizedInitialId), {
      sameSite: 'lax',
      expires: 365
    });
  }

  async function handle_script_change(next: ScriptListType) {
    const idx = SCRIPT_LIST.indexOf(next as script_list_type);
    if (idx === -1) return;
    const nextId = SCRIPT_LIST_IDS[idx]!;
    if (nextId === last_persisted_id) return;
    last_persisted_id = nextId;
    Cookies.set(SCRIPT_ID_COOKIE_NAME, String(nextId), {
      sameSite: 'lax',
      expires: 365
    });
    await reload_current_page();
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <PenLineIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    <p class="text-sm text-muted-foreground">Script</p>
  </div>
  <ScriptSelector bind:script on_script_change={handle_script_change} />
</div>
