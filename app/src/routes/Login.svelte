<script lang="ts">
  import { signIn } from '$lib/auth-client';
  import Icon from '~/tools/Icon.svelte';
  import { GoogleIcon } from '~/components/icons';
  import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
  <title>Login | The Sanskrit Channel</title>
</svelte:head>

<div class="mt-14 flex items-center justify-center">
  <Button
    onclick={async () => {
      await signIn.social({
        provider: 'google',
        callbackURL: window.location.origin
      });
    }}
    variant="outline"
    class="flex gap-2 text-lg font-semibold"
  >
    <Icon src={GoogleIcon} class="inline-block size-5" />
    Login with Google
  </Button>
</div>
