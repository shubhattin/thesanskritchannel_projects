<script lang="ts">
  import UserControls from '~/components/pages/main_app/user/UserControls.svelte';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import PenLine from '@lucide/svelte/icons/pen-line';
  import Search from '@lucide/svelte/icons/search';
  import { PROJECT_LIST } from '~/state/project_list';
  import Button from '~/lib/components/ui/button/button.svelte';
</script>

<MetaTags title="The Sanskrit Channel Projects" description="The Sanskrit Channel Projects" />

<main class="container mx-auto px-4 py-8">
  <div class="-mb-4 flex justify-end">
    <UserControls />
  </div>
  <h1 class="mb-8 text-center text-2xl font-bold">The Sanskrit Channel Projects</h1>

  <div class="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
    {#each PROJECT_LIST as project}
      <a
        href={'/' + project.key}
        class="btn group block rounded-lg border border-border bg-card p-6 shadow-md transition duration-200 ease-out hover:-translate-y-1 hover:border-secondary hover:bg-muted/20 hover:shadow-lg focus-visible:ring focus-visible:ring-ring/70 focus-visible:outline-none"
      >
        <h2 class="mb-2 text-xl font-semibold">
          {project.name}
          <div class="text-base text-muted-foreground">{project.name_dev}</div>
        </h2>
        <p class="mb-4 text-sm text-muted-foreground">{project.description}</p>
        <div
          class="flex items-center text-primary transition-colors duration-200 group-hover:text-secondary-foreground"
        >
          <span>Explore</span>
          <ArrowRight class="ml-2 size-4" aria-hidden="true" />
        </div>
      </a>
    {/each}
  </div>

  <div class="mt-8 flex justify-center">
    <a
      href="/search"
      class="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 text-base font-semibold tracking-wide text-primary transition hover:border-secondary hover:bg-muted/70 focus-visible:ring focus-visible:ring-ring/70 focus-visible:outline-none"
      aria-label="Search across Sanskrit texts"
    >
      <Search class="size-5 shrink-0" aria-hidden="true" />
      <span>Search across texts</span>
    </a>
  </div>

  <div class="mt-4 flex justify-center">
    <a href="/lekha" aria-label="Browse Lekha writings">
      <Button variant="outline" size="lg">
        <PenLine class="size-5 shrink-0" aria-hidden="true" />
        <span>Lekha</span>
      </Button>
    </a>
  </div>
</main>
