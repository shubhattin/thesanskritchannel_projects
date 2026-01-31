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
  >
    <Icon src={GoogleIcon} class="inline-block text-[1.25rem]" />
    Signin with Google
  </Button>
</div>
