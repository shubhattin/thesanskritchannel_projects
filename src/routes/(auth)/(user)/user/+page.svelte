<script lang="ts">
  import { useSession } from '$lib/auth-client';
  import type { PageData } from './$types';
  import { browser } from '$app/environment';
  import MainProfilePage from '~/components/pages/user/MainProfilePage.svelte';

  const session = useSession();

  let { data }: { data: PageData } = $props();

  let user_info_fetched = $state(false);

  let user_info = $derived(user_info_fetched ? $session.data?.user : data.user_info);

  $effect(() => {
    if (browser && $session.data?.user) {
      user_info_fetched = true;
    }
  });
</script>

<svelte:head>
  <title>Profile Page</title>
</svelte:head>

{#if user_info}
  <div class="mt-8 px-1 sm:mt-12 sm:px-1.5">
    <MainProfilePage user={user_info} />
  </div>
{/if}
