<script lang="ts">
  import type { PageData } from './$types';
  import Youtube from '@lucide/svelte/icons/youtube';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Heart from '@lucide/svelte/icons/heart';
  import Calendar from '@lucide/svelte/icons/calendar';

  let { data }: { data: PageData } = $props();

  function formatDate(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function toIsoString(value: Date | string | null | undefined): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }
</script>

<svelte:head>
  <title>The Sanskrit Channel — Explore Authentic Sanskrit Literature</title>
  <meta
    name="description"
    content="Discover ancient Sanskrit texts, learn Indian scripts, and explore tools for Sanskrit learning. Read Valmiki Ramayanam, Bhagavad Gita, and more in multiple scripts."
  />
</svelte:head>

<!-- Hero Section -->
<section
  class="relative overflow-hidden border-b border-border/30 bg-linear-to-br from-background via-accent/15 to-primary/5 py-6 outline-hidden"
>
  <!-- Background glowing spots -->
  <div
    class="pointer-events-none absolute top-1/4 left-1/2 -z-10 h-125 w-125 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-primary/10 blur-[100px] duration-5000"
  ></div>
  <div
    class="pointer-events-none absolute top-1/2 left-1/3 -z-10 h-75 w-75 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[80px]"
  ></div>

  <!-- Decorative background pattern -->
  <div
    class="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
    style="background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0); background-size: 40px 40px;"
    aria-hidden="true"
  ></div>

  <div class="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
    <div class="mx-auto max-w-4xl text-center">
      <h1
        class="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl/none"
      >
        Explore
        <span
          class="mt-2 bg-linear-to-r from-primary via-amber-500 to-primary/80 bg-clip-text text-transparent"
        >
          Sanskrit
        </span>
      </h1>

      <p class="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-xl">
        Explore authentic Sanskrit literature through a modern reading experience. Read texts in
        multiple Indian scripts, use powerful learning tools, and join a community dedicated to
        preserving ancient wisdom.
      </p>

      <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href="/texts"
          class="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-150 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/15 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Explore Texts
        </a>
        <a
          href="https://www.youtube.com/@TheSanskritChannel"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background/50 px-8 text-sm font-semibold text-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Youtube
            class="size-5 text-red-500 transition-transform duration-150 group-hover:scale-110"
          />
          Watch on YouTube
        </a>
      </div>
    </div>
  </div>
</section>

<!-- Tools Showcase Section -->
<section
  id="tools"
  class="border-t border-b border-border/30 bg-linear-to-b from-muted/20 via-background to-muted/20"
  style="scroll-margin-top: 4rem;"
>
  <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
    <div class="mb-12 text-center">
      <div
        class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold tracking-wider text-primary uppercase"
      >
        Ecosystem
      </div>
      <h2 class="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Tools for Sanskrit Learning
      </h2>
      <p class="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
        Interactive web applications designed to help you learn, practice, and experience Sanskrit
        in new, accessible ways.
      </p>
    </div>

    <div class="grid gap-6 sm:grid-cols-2">
      <!-- Padavali -->
      <a
        href="https://krida.thesanskritchannel.org/padavali"
        target="_blank"
        rel="noopener noreferrer"
        class="group animate-fade-in-up stagger-1 relative flex gap-5 rounded-2xl border border-border/60 bg-card/45 p-6 shadow-2xs backdrop-blur-xs transition-all duration-300 before:absolute before:top-4 before:bottom-4 before:left-0 before:w-1 before:rounded-r-md before:bg-amber-500/20 before:transition-all before:duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:bg-card hover:shadow-md hover:before:top-0 hover:before:bottom-0 hover:before:bg-amber-500"
      >
        <div
          class="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-amber-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        ></div>

        <div
          class="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xs transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm"
        >
          <img
            src="/icons/apps/padavali_64.png"
            alt=""
            width="44"
            height="44"
            class="h-full w-full object-contain p-1"
            aria-hidden="true"
          />
        </div>

        <div class="relative min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <h3
                class="font-heading text-lg font-bold text-foreground transition-colors duration-300 group-hover:text-amber-500"
              >
                Padavali
              </h3>
              <ExternalLink
                class="size-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>
            <span
              class="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-500 uppercase"
            >
              Word Game
            </span>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sanskrit Word Game playable in multiple Indian scripts. Challenge yourself and build
            your vocabulary.
          </p>
        </div>
      </a>

      <!-- Svara Darshini -->
      <a
        href="https://svara.thesanskritchannel.org/"
        target="_blank"
        rel="noopener noreferrer"
        class="group animate-fade-in-up stagger-2 relative flex gap-5 rounded-2xl border border-border/60 bg-card/45 p-6 shadow-2xs backdrop-blur-xs transition-all duration-300 before:absolute before:top-4 before:bottom-4 before:left-0 before:w-1 before:rounded-r-md before:bg-emerald-500/20 before:transition-all before:duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-card hover:shadow-md hover:before:top-0 hover:before:bottom-0 hover:before:bg-emerald-500"
      >
        <div
          class="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        ></div>

        <div
          class="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xs transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm"
        >
          <img
            src="/icons/apps/svara_64.png"
            alt=""
            width="44"
            height="44"
            class="h-full w-full object-contain p-1"
            aria-hidden="true"
          />
        </div>

        <div class="relative min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <h3
                class="font-heading text-lg font-bold text-foreground transition-colors duration-300 group-hover:text-emerald-500"
              >
                Svara Darshini
              </h3>
              <ExternalLink
                class="size-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>
            <span
              class="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-500 uppercase"
            >
              Chanting
            </span>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
            Visualize and practice Vedic pitch levels for chanting. Master the accent systems of
            sacred chanting.
          </p>
        </div>
      </a>

      <!-- Akshara -->
      <a
        href="https://akshara.thesanskritchannel.org/"
        target="_blank"
        rel="noopener noreferrer"
        class="group animate-fade-in-up stagger-3 relative flex gap-5 rounded-2xl border border-border/60 bg-card/45 p-6 shadow-2xs backdrop-blur-xs transition-all duration-300 before:absolute before:top-4 before:bottom-4 before:left-0 before:w-1 before:rounded-r-md before:bg-violet-500/20 before:transition-all before:duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:bg-card hover:shadow-md hover:before:top-0 hover:before:bottom-0 hover:before:bg-violet-500"
      >
        <div
          class="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-violet-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        ></div>

        <div
          class="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xs transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm"
        >
          <img
            src="/icons/apps/akshara_64.png"
            alt=""
            width="44"
            height="44"
            class="h-full w-full object-contain p-1"
            aria-hidden="true"
          />
        </div>

        <div class="relative min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <h3
                class="font-heading text-lg font-bold text-foreground transition-colors duration-300 group-hover:text-violet-500"
              >
                Akshara
              </h3>
              <ExternalLink
                class="size-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>
            <span
              class="inline-flex items-center rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-violet-500 uppercase"
            >
              Learning
            </span>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
            Interactive lessons to learn, read, and write Indian scripts. Trace letters and
            understand pronunciation.
          </p>
        </div>
      </a>

      <!-- Lipi Lekhika -->
      <a
        href="https://lipilekhika.in/"
        target="_blank"
        rel="noopener noreferrer"
        class="group animate-fade-in-up stagger-4 relative flex gap-5 rounded-2xl border border-border/60 bg-card/45 p-6 shadow-2xs backdrop-blur-xs transition-all duration-300 before:absolute before:top-4 before:bottom-4 before:left-0 before:w-1 before:rounded-r-md before:bg-sky-500/20 before:transition-all before:duration-300 hover:-translate-y-1 hover:border-sky-500/30 hover:bg-card hover:shadow-md hover:before:top-0 hover:before:bottom-0 hover:before:bg-sky-500"
      >
        <div
          class="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-sky-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        ></div>

        <div
          class="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xs transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm"
        >
          <img
            src="/icons/apps/lipi.svg"
            alt=""
            width="44"
            height="44"
            class="h-full w-full object-contain p-1"
            aria-hidden="true"
          />
        </div>

        <div class="relative min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <h3
                class="font-heading text-lg font-bold text-foreground transition-colors duration-300 group-hover:text-sky-500"
              >
                Lipi Lekhika
              </h3>
              <ExternalLink
                class="size-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>
            <span
              class="inline-flex items-center rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sky-500 uppercase"
            >
              Converter
            </span>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
            Convert text between Indian scripts with ease. A robust transliteration engine
            supporting major Indic scripts.
          </p>
        </div>
      </a>
    </div>
  </div>
</section>

<!-- Featured Texts Section -->
<section
  id="texts"
  class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20"
  style="scroll-margin-top: 4rem;"
>
  <div class="mb-10 text-center">
    <h2 class="text-2xl font-bold tracking-tight sm:text-3xl">Texts</h2>
    <p class="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
      Read classical Sanskrit texts in a clean, distraction-free interface. Switch between multiple
      Indian scripts effortlessly.
    </p>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.featured_projects as project, index}
      <a
        href="/{project.key}"
        class="group animate-fade-in-up relative flex flex-col justify-between rounded-2xl border border-border bg-card/40 p-5 shadow-2xs backdrop-blur-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/80 hover:shadow-md stagger-{index +
          1}"
      >
        <div
          class="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        ></div>
        <div class="relative space-y-1.5">
          <p
            class="font-devanagari text-xl font-medium tracking-wide text-foreground transition-colors duration-300 group-hover:text-primary"
          >
            {project.name_dev}
          </p>
          <p class="text-sm text-muted-foreground">{project.name}</p>
        </div>
        <div
          class="relative mt-4 flex items-center gap-1 text-xs font-semibold text-primary/80 transition-colors duration-300 group-hover:text-primary"
        >
          <span>Read Text</span>
          <ArrowRight
            class="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </div>
      </a>
    {/each}
  </div>

  {#if data.projects.length > data.featured_projects.length}
    <div class="mt-8 text-center">
      <a
        href="/texts"
        class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        Explore More
        <ArrowRight class="size-4" />
      </a>
    </div>
  {/if}
</section>

{#if data.latest_lekhas.length > 0}
  <section class="border-b border-border/30 bg-muted/20" aria-labelledby="lekha-latest-heading">
    <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="lekha-latest-heading" class="text-2xl font-bold tracking-tight sm:text-3xl">
            Latest from Lekha
          </h2>
          <p class="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Short notes and articles — read the most recent posts.
          </p>
        </div>
        <a
          href="/lekha"
          class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          View all
          <ArrowRight class="size-4" />
        </a>
      </div>
      <ul class="flex flex-col gap-4">
        {#each data.latest_lekhas as post, index}
          <li>
            <a
              href="/lekha/{post.url_slug}"
              class="group animate-fade-in-up relative block rounded-2xl border border-border bg-card/40 px-6 py-5 shadow-2xs backdrop-blur-xs transition-all duration-300 hover:border-primary/40 hover:bg-card/85 hover:shadow-sm stagger-{index +
                1}"
            >
              <div
                class="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              ></div>
              <div class="relative">
                <h3
                  class="font-heading text-lg font-semibold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary"
                >
                  {post.title}
                </h3>
                {#if post.description}
                  <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {post.description}
                  </p>
                {/if}
                {#if post.published_at}
                  {@const formatted = formatDate(post.published_at)}
                  {#if formatted}
                    <div class="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar class="size-3.5 text-primary/60" />
                      <time datetime={toIsoString(post.published_at)}>
                        {formatted}
                      </time>
                    </div>
                  {/if}
                {/if}
              </div>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/if}

<!-- Support CTA Section -->
<section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
  <div
    class="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary/10 via-accent/30 to-primary/5 p-8 text-center sm:p-12"
  >
    <div class="relative">
      <h2 class="text-2xl font-bold tracking-tight sm:text-3xl">Support Our Mission</h2>
      <p class="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
        Help us make ancient Sanskrit treasures accessible to everyone. Your support keeps this
        project alive and growing.
      </p>
      <a
        href="/support"
        class="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-md transition-transform duration-150 hover:scale-[1.02] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Heart class="size-4" />
        Support Us
      </a>
    </div>
  </div>
</section>
