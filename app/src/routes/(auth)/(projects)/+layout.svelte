<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const is_projects_scope_allowed = $derived(data.is_projects_scope_allowed);
</script>

{#if is_projects_scope_allowed}
  {@render children()}
{:else}
  <div class="flex h-screen items-center justify-center">
    <h1 class="text-xl font-bold">You are not authorized to access Projects Portal Scope</h1>
  </div>
{/if}
