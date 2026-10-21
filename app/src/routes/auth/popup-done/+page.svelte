<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { AUTH_POPUP_CHANNEL } from '$lib/popup_sign_in';

  // better-auth appends `error`; our errorCallbackURL adds `status=error`.
  const failed = $derived(
    page.url.searchParams.has('error') || page.url.searchParams.get('status') === 'error'
  );

  // OAuth landing page for the sign-in popup: report back to the opener tab
  // over BroadcastChannel and close. Only stays visible if closing is refused.
  onMount(() => {
    try {
      const channel = new BroadcastChannel(AUTH_POPUP_CHANNEL);
      channel.postMessage({ type: failed ? 'error' : 'signed_in' });
      channel.close();
    } catch {
      // Old browser — the user can return to the opener tab manually.
    }
    const timer = window.setTimeout(() => window.close(), failed ? 1500 : 150);
    return () => window.clearTimeout(timer);
  });
</script>

<svelte:head>
  <title>Signing in… | The Sanskrit Channel</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="mt-14 flex items-center justify-center">
  <div class="flex max-w-xs flex-col items-center gap-3 text-center">
    <p class="font-semibold">{failed ? 'Sign-in did not complete' : 'Signed in'}</p>
    <p class="text-sm text-muted-foreground">You can close this window.</p>
    <Button variant="outline" size="sm" href="/">Back</Button>
  </div>
</div>
