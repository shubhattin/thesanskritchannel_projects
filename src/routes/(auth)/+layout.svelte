<script>
  import InitUserState from './InitUserState.svelte';

  let { children } = $props();
</script>

<InitUserState />

{@render children()}
