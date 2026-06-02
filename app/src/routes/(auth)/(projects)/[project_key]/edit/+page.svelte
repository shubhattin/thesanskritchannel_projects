<script lang="ts">
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<MetaTags title={`${data.project_name} | Edit Map`} />
