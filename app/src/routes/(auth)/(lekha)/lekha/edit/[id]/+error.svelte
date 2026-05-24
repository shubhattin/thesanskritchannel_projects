<script lang="ts">
  import { page } from '$app/state';
  import MetaTags from '~/components/tags/MetaTags.svelte';
</script>

<MetaTags title="Error" />
<div class="mx-4 my-4 text-xl font-semibold">{page.error?.message}</div>
