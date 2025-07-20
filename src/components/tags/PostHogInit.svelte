<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(() => {
    if (
      browser &&
      import.meta.env.PROD &&
      import.meta.env.VITE_POSTHOG_KEY &&
      (import.meta.env.VITE_POSTHOG_URL || import.meta.env.VITE_SITE_URL)
    ) {
      import('posthog-js').then((posthog) => {
        posthog.default.init(import.meta.env.VITE_POSTHOG_KEY, {
          api_host: `${import.meta.env.VITE_POSTHOG_URL}`,
          person_profiles: 'identified_only',
          ui_host: 'https://us.posthog.com'
        });
      });
    }
  });
</script>
