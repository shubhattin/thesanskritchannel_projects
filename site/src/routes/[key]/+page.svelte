<script lang="ts">
  import TextRoutePage from '$components/main_text/TextRoutePage.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<TextRoutePage {data} />
