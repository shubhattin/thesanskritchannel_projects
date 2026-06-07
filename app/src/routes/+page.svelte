<script lang="ts">
  import Login from './Login.svelte';
  import Home from './Home.svelte';
  import { useSession } from '~/lib/auth-client';

  const session = useSession();
</script>

{#if !$session.isPending}
  {#if $session.data?.user}
    <Home />
  {:else}
    <Login />
  {/if}
{/if}
