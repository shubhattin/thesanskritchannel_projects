<script>
  import CookieCacheRefresh from '$lib/CookieCacheRefresh.svelte';
  import InitUserState from './InitUserState.svelte';

  let { children } = $props();
</script>

<InitUserState />
<CookieCacheRefresh />

{@render children()}
