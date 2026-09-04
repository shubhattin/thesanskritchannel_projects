<script lang="ts">
  import ScriptSelector from '~/components/utils/ScriptSelector.svelte';
  import Cookies from 'js-cookie';
  import {
    SCRIPT_LIST,
    SCRIPT_LIST_IDS,
    get_script_from_id,
    type script_list_type
  } from '@app/state/lang_list';
  import { SCRIPT_ID_COOKIE_NAME } from '~/lib/cookies';
  import { site_prefs } from '$lib/main_text/site-prefs.svelte';
  import { type ScriptListType } from 'lipilekhika';
  import PenLineIcon from '@lucide/svelte/icons/pen-line';

  function idToScript(id: number): script_list_type {
    const s = get_script_from_id(id);
    return s ?? get_script_from_id(1);
  }

  let script = $state(idToScript(site_prefs.script_id));

  $effect(() => {
    script = idToScript(site_prefs.script_id);
  });

  async function handle_script_change(next: ScriptListType) {
    const idx = SCRIPT_LIST.indexOf(next);
    if (idx === -1) return;
    const nextId = SCRIPT_LIST_IDS[idx]!;
    if (nextId === site_prefs.script_id) return;
    Cookies.set(SCRIPT_ID_COOKIE_NAME, String(nextId), {
      sameSite: 'lax',
      expires: 365
    });
    site_prefs.set_script_id(nextId);
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <PenLineIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    <p class="text-sm text-muted-foreground">Script</p>
  </div>
  <ScriptSelector bind:script on_script_change={handle_script_change} />
</div>
