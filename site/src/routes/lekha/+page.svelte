<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const title = 'Lekha — The Sanskrit Channel';
  const description = 'Notes and articles from The Sanskrit Channel.';

  function formatDate(value: Date | string | null | undefined) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function toIso(value: Date | string | null | undefined) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <header class="mb-10 border-b border-border pb-8">
    <h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Lekha</h1>
    <p class="mt-3 text-muted-foreground">{description}</p>
  </header>

  <ul class="flex flex-col gap-6">
    {#each data.posts as post}
      <li>
        <a
          href={`/lekha/${post.url_slug}`}
          class="group block rounded-lg border border-border/60 bg-card/40 px-5 py-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
        >
          <h2 class="text-lg font-semibold tracking-tight group-hover:text-primary">
            {post.title}
          </h2>
          {#if post.description}
            <p class="mt-2 text-sm text-muted-foreground">{post.description}</p>
          {/if}
          <time
            class="mt-3 block text-xs text-muted-foreground"
            datetime={toIso(post.published_at)}
          >
            {formatDate(post.published_at)}
          </time>
        </a>
      </li>
    {/each}
  </ul>

  {#if data.posts.length === 0}
    <p class="text-muted-foreground">
      No published posts yet. Add listed, non-draft lekhas in the app; they will appear here when
      synced to the database.
    </p>
  {/if}
</div>
