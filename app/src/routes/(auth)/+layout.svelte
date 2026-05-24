<script lang="ts">
  import type { Snippet } from 'svelte';
  import { is_current_app_scope } from '~/state/user.svelte';

  let { children }: { children: Snippet } = $props();
</script>

{#if $is_current_app_scope}
  {@render children()}
{:else}
  <div class="flex h-screen items-center justify-center">
    <h1 class="text-2xl font-bold">You are not authorized to access this page</h1>
  </div>
{/if}
