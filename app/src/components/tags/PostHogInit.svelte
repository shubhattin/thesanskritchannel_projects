<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { posthogErrorTrackingConfig } from '~/lib/posthog_client';

  onMount(() => {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (
      browser &&
      import.meta.env.PROD &&
      key &&
      (import.meta.env.VITE_POSTHOG_URL || import.meta.env.VITE_SITE_URL)
    ) {
      import('posthog-js').then((posthog) => {
        posthog.default.init(key, {
          api_host: `${import.meta.env.VITE_POSTHOG_URL}`,
          person_profiles: 'identified_only',
          ui_host: 'https://us.posthog.com',
          ...posthogErrorTrackingConfig()
        });
      });
    }
  });
</script>
