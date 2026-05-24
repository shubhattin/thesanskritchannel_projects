<script lang="ts">
  import { is_current_app_scope, user_info } from '~/state/user.svelte';
  import MainProfilePage from '~/components/pages/user/MainProfilePage.svelte';
</script>

<svelte:head>
  <title>Profile Page</title>
</svelte:head>

{#if $user_info}
  <div class="mt-8 px-1 sm:mt-12 sm:px-1.5">
    <MainProfilePage user={$user_info} is_current_app_scope={$is_current_app_scope} />
  </div>
{/if}
