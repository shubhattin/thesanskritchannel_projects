<script lang="ts">
  import Login from './Login.svelte';
  import Home from './Home.svelte';
  import { user_info } from '~/state/user.svelte';
</script>

{#if $user_info}
  <Home />
{:else}
  <Login />
{/if}
