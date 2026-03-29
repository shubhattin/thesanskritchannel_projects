<script lang="ts">
  import * as NavigationMenu from '~/lib/components/ui/navigation-menu';
  import { navigationMenuTriggerStyle } from '~/lib/components/ui/navigation-menu/navigation-menu-trigger.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
  import { PROJECT_LIST } from '$app/state/project_list';
  import Menu from '@lucide/svelte/icons/menu';
  import X from '@lucide/svelte/icons/x';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Heart from '@lucide/svelte/icons/heart';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
  import AudioLines from '@lucide/svelte/icons/audio-lines';
  import PenTool from '@lucide/svelte/icons/pen-tool';
  import Languages from '@lucide/svelte/icons/languages';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  let mobileMenuOpen = $state(false);

  const tools = [
    {
      name: 'Padavali',
      description: 'Sanskrit Word Game in Multiple Scripts',
      href: 'https://krida.thesanskritchannel.org/padavali',
      icon: Gamepad2
    },
    {
      name: 'Svara Darshini',
      description: 'Visualize & Practice Vedic Pitch Levels',
      href: 'https://svara.thesanskritchannel.org/',
      icon: AudioLines
    },
    {
      name: 'Akshara',
      description: 'Learn to Read & Write Indian Scripts',
      href: 'https://akshara.thesanskritchannel.org/',
      icon: PenTool
    },
    {
      name: 'Lipi Lekhika',
      description: 'Script Transliteration Tool',
      href: 'https://lipilekhika.in/',
      icon: Languages
    }
  ];

  function closeMobile() {
    mobileMenuOpen = false;
  }
</script>

<header
  class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg"
>
  <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
    <!-- Logo + Brand -->
    <a href="/" class="flex items-center gap-2.5 transition-opacity duration-150 hover:opacity-80">
      <img
        src="/icons/tsc_24.png"
        alt="The Sanskrit Channel"
        width="24"
        height="24"
        class="rounded-sm"
      />
      <span class="hidden text-sm font-semibold tracking-tight sm:inline">The Sanskrit Channel</span
      >
    </a>

    <!-- Desktop Navigation -->
    <nav class="hidden md:flex md:items-center md:gap-1" aria-label="Main Navigation">
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <!-- Tools -->
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Tools</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <ul class="grid w-[420px] gap-1 p-2 lg:w-[500px] lg:grid-cols-2">
                {#each tools as tool}
                  <li>
                    <NavigationMenu.Link href={tool.href} target="_blank" rel="noopener noreferrer">
                      <div class="flex items-start gap-3">
                        <div
                          class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                        >
                          <tool.icon class="size-4" aria-hidden="true" />
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center gap-1 text-sm font-medium">
                            {tool.name}
                            <ExternalLink class="size-3 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <p class="text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                      </div>
                    </NavigationMenu.Link>
                  </li>
                {/each}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <!-- Texts -->
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Texts</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <ul class="grid w-[320px] gap-1 p-2 lg:w-[400px] lg:grid-cols-2">
                {#each PROJECT_LIST as project}
                  <li>
                    <NavigationMenu.Link href={`/${project.key}`}>
                      <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0">
                          <div class="text-sm font-medium">{project.name}</div>
                          <p class="font-devanagari text-xs text-muted-foreground">
                            {project.name_dev}
                          </p>
                        </div>
                        <ChevronRight
                          class="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                    </NavigationMenu.Link>
                  </li>
                {/each}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>

          <!-- Support Us -->
          <NavigationMenu.Item>
            <a href="/support" class={navigationMenuTriggerStyle()}>
              <Heart class="mr-1.5 size-3.5 text-primary" aria-hidden="true" />
              Support Us
            </a>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    </nav>

    <!-- Right side: Theme + Mobile menu -->
    <div class="flex items-center gap-2">
      <div class="hidden md:block">
        <ThemeSwitcher />
      </div>

      <!-- Mobile menu button -->
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none md:hidden"
        aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
        onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
      >
        {#if mobileMenuOpen}
          <X class="size-5" aria-hidden="true" />
        {:else}
          <Menu class="size-5" aria-hidden="true" />
        {/if}
      </button>
    </div>
  </div>

  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <nav
      class="border-t border-border/40 bg-background md:hidden"
      aria-label="Mobile Navigation"
      style="overscroll-behavior: contain;"
    >
      <div class="max-h-[calc(100dvh-3.5rem)] space-y-1 overflow-y-auto px-4 py-4">
        <!-- Tools Section -->
        <div class="space-y-1">
          <p class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Tools
          </p>
          {#each tools as tool}
            <a
              href={tool.href}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-accent"
              onclick={closeMobile}
            >
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
              >
                <tool.icon class="size-4" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1 text-sm font-medium">
                  {tool.name}
                  <ExternalLink class="size-3 text-muted-foreground" aria-hidden="true" />
                </div>
                <p class="truncate text-xs text-muted-foreground">{tool.description}</p>
              </div>
            </a>
          {/each}
        </div>

        <!-- Separator -->
        <div class="my-2 border-t border-border/40"></div>

        <!-- Texts Section -->
        <div class="space-y-1">
          <p class="px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Texts
          </p>
          {#each PROJECT_LIST as project}
            <a
              href={`/${project.key}`}
              class="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-accent"
              onclick={closeMobile}
            >
              <div class="min-w-0">
                <div class="text-sm font-medium">{project.name}</div>
                <p class="font-devanagari truncate text-xs text-muted-foreground">
                  {project.name_dev}
                </p>
              </div>
              <ChevronRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          {/each}
        </div>

        <!-- Separator -->
        <div class="my-2 border-t border-border/40"></div>

        <!-- Support Us -->
        <a
          href="/support"
          class="flex items-center gap-2 rounded-lg px-2 py-2.5 font-medium text-primary transition-colors duration-150 hover:bg-accent"
          onclick={closeMobile}
        >
          <Heart class="size-4" aria-hidden="true" />
          Support Us
        </a>

        <!-- Theme Switcher -->
        <div class="my-2 border-t border-border/40"></div>
        <div class="flex items-center justify-between px-2 py-2">
          <span class="text-sm text-muted-foreground">Theme</span>
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  {/if}
</header>
