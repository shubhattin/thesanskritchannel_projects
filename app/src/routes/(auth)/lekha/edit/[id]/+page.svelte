<script lang="ts">
  import LekhaForm from '~/components/lekha/LekhaAddEdit.svelte';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();

  let lekha = $derived(data.lekha);
</script>

<MetaTags title={`Edit Lekha: ${lekha.title}`} />

<LekhaForm mode="edit" lekha_id={lekha.id} initial={lekha} />
