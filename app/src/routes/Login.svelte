<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { refreshAuthSession } from '$lib/auth-client';
  import { startGoogleSignIn } from '$lib/popup_sign_in';
  import Icon from '~/tools/Icon.svelte';
  import { GoogleIcon } from '~/components/icons';
  import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
  <title>Login | The Sanskrit Channel</title>
</svelte:head>

<div class="mt-14 flex items-center justify-center">
  <Button
    onclick={() =>
      void startGoogleSignIn({
        onSignedIn: () => {
          refreshAuthSession();
          void invalidateAll();
        },
        onError: () => toast.error('Google sign-in did not complete. Please try again.')
      })}
    variant="outline"
    class="flex gap-2 text-lg font-semibold"
  >
    <Icon src={GoogleIcon} class="inline-block size-5" />
    Login with Google
  </Button>
</div>
