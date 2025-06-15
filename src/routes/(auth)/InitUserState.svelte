<script lang="ts">
  import { user_info } from '~/state/user.svelte';
  import { useSession } from '~/lib/auth-client';
  import { browser } from '$app/environment';
  import { page } from '$app/state';

  const session = useSession();
  let user_info_fetched = $state(false);

  $user_info = null;
  if (page.data.user_info) $user_info = page.data.user_info;
  $effect(() => {
    $user_info = user_info_fetched ? $session.data?.user : page.data.user_info;
  });

  $effect(() => {
    if (browser && $session.data?.user) {
      user_info_fetched = true;
    }
  });
</script>
