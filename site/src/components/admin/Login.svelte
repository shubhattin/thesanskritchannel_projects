<script lang="ts">
  import { signIn } from '$lib/auth-client';
  import Icon from '$app/tools/Icon.svelte';
  import { GoogleIcon } from '$app/components/icons';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
</script>

<div class="flex min-h-[50vh] items-center justify-center px-4 py-12">
  <Card.Root class="w-full max-w-sm">
    <Card.Header>
      <Card.Title>Sign In</Card.Title>
      <Card.Description>Sign in with Google to open the admin dashboard.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col items-stretch">
      <Button
        variant="outline"
        size="lg"
        class="w-full text-base"
        onclick={async () => {
          await signIn.social({
            provider: 'google',
            callbackURL: window.location.href
          });
        }}
      >
        <Icon src={GoogleIcon} class="inline-block size-5" />
        Sign in with Google
      </Button>
    </Card.Content>
  </Card.Root>
</div>
