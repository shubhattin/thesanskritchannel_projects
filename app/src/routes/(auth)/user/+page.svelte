<script lang="ts">
  import { useSession } from '~/lib/auth-client';
  import MainProfilePage from '~/components/pages/user/MainProfilePage.svelte';

  const session = useSession();
</script>

<svelte:head>
  <title>Profile Page</title>
</svelte:head>

{#if $session.data?.user}
  <div class="mt-8 px-1 sm:mt-12 sm:px-1.5">
    <MainProfilePage user={$session.data.user} />
  </div>
{/if}
