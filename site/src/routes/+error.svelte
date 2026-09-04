<script lang="ts">
  import { page } from '$app/state';

  const is_not_found = $derived(page.status === 404);
</script>

<div
  class="mx-auto flex w-full max-w-3xl flex-col items-start justify-center gap-6 px-4 py-10 sm:px-6"
>
  <p class="text-sm tracking-[0.2em] text-muted-foreground uppercase">{page.status}</p>
  <div class="space-y-3">
    <h1 class="text-4xl font-semibold tracking-tight">
      {is_not_found ? 'Page not found' : 'Something went wrong'}
    </h1>
    <p class="text-base text-muted-foreground">
      {#if is_not_found}
        The route does not match a known text or section yet.
      {:else if page.error?.message}
        {page.error.message}
      {:else}
        An unexpected error occurred while loading this page.
      {/if}
    </p>
  </div>
  <a class="rounded-md border px-4 py-2 hover:bg-accent hover:text-accent-foreground" href="/">
    Return home
  </a>
</div>
