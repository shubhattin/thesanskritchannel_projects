<script lang="ts">
  import { signIn } from '~/lib/auth-client';
  import Icon from '~/tools/Icon.svelte';
  import { GoogleIcon } from '~/components/icons';
  import { Button } from '$lib/components/ui/button';
</script>

<div class="mt-4 flex flex-col items-center justify-center">
  <Button
    variant="outline"
    onclick={async () => {
      await signIn.social({
        provider: 'google',
        callbackURL: window.location.href
      });
    }}
    size="lg"
    class="text-base"
  >
    <Icon src={GoogleIcon} class="inline-block size-5" />
    Signup with Google
  </Button>
</div>
