<script lang="ts">
  import { onMount } from 'svelte';

  onMount(async () => {
    const key = import.meta.env.PUBLIC_POSTHOG_KEY;
    if (!import.meta.env.PROD || !key) return;

    const posthog = (await import('posthog-js')).default;
    posthog.init(key, {
      api_host: import.meta.env.PUBLIC_POSTHOG_URL ?? 'https://us.i.posthog.com',
      defaults: '2025-11-30',
      person_profiles: 'identified_only'
    });
  });
</script>
