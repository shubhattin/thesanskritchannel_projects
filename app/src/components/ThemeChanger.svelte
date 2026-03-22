<script lang="ts">
  import { setMode } from 'mode-watcher';
  import { LuSun, LuMoon } from 'svelte-icons-pack/lu';
  import Icon from '~/tools/Icon.svelte';
  import { SlScreenDesktop } from 'svelte-icons-pack/sl';
</script>

<button class="group -mb-1 inline-flex items-center p-0" onclick={() => setMode('system')}>
  <Icon
    src={SlScreenDesktop}
    class="h-5 w-5 scale-100 rotate-0 group-hover:text-blue-500 dark:group-hover:text-sky-500"
  />
</button>
<button class="group -mb-1 inline-flex items-center p-0" onclick={() => setMode('light')}>
  <Icon src={LuSun} class="h-5 w-5 scale-100 rotate-0 dark:group-hover:text-yellow-300" />
</button>
<button class="group -mb-1 inline-flex items-center p-0" onclick={() => setMode('dark')}>
  <Icon
    src={LuMoon}
    class="h-5 w-5 scale-100 rotate-0 group-hover:text-purple-600 dark:group-hover:text-white"
  />
</button>
