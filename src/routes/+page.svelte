<script lang="ts">
  import { PROJECT_LIST } from '~/state/project_list';
</script>

<svelte:head>
  <title>The Sanskrit Channel Projects</title>
</svelte:head>

<main class="container mx-auto px-4 py-8">
  <h1 class="mb-8 text-center text-2xl font-bold">The Sanskrit Channel Projects</h1>

  <div class="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
    {#each PROJECT_LIST as project}
      <a
        href={'/' + project.key}
        class="btn block rounded-lg p-6 shadow-md transition-shadow hover:shadow-lg"
      >
        <h2 class="mb-2 text-xl font-semibold">
          {project.name}
          <div class="text-base text-stone-500 dark:text-stone-400">{project.name_dev}</div>
        </h2>
        <p class="mb-4 text-gray-600">{project.description}</p>
        <div class="flex items-center text-blue-600 dark:text-blue-400">
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
</main>
