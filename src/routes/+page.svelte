<script lang="ts">
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import { PROJECT_LIST } from '~/state/project_list';
</script>

<MetaTags title="The Sanskrit Channel Projects" description="The Sanskrit Channel Projects" />

<main class="container mx-auto px-4 py-8">
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
          <svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            ></path>
          </svg>
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="7"></circle>
        <line x1="16.65" y1="16.65" x2="21" y2="21"></line>
      </svg>
      <span>Search across texts</span>
    </a>
  </div>
</main>
