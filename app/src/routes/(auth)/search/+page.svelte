<script lang="ts">
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import Search from '~/components/Search.svelte';
  import { Button } from '$lib/components/ui/button';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
</script>

<MetaTags title="Search" description="Search across Sanskrit texts" />

<main class="container mx-auto px-4 py-6">
  <Button variant="ghost" size="icon-sm" href="/" aria-label="Back to home" class="mb-2">
    <ArrowLeft class="size-4" aria-hidden="true" />
  </Button>
  <Search />
</main>
