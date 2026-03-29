<script lang="ts">
  import { onMount } from 'svelte';
  import * as Popover from '~/lib/components/ui/popover';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Monitor from '@lucide/svelte/icons/monitor';
  import SunMoon from '@lucide/svelte/icons/sun-moon';
  import {
    applyTheme,
    getDarkMql,
    syncSystemThemeListener,
    THEME_STORAGE_KEY
  } from '$lib/theme-runtime';

  type ThemeMode = 'light' | 'dark' | 'system';

  let current: ThemeMode = $state('system');
  let open = $state(false);

  function init() {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') current = stored;
      else current = 'system';
    } catch {
      current = 'system';
    }
  }

  onMount(() => {
    init();
  });

  function setMode(mode: ThemeMode) {
    current = mode;
    const prefersDark = getDarkMql().matches;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);

    applyTheme(isDark);

    try {
      if (mode === 'system') {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
    } catch {}

    syncSystemThemeListener();

    open = false;
  }

  const modes: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'system', label: 'System', icon: Monitor },
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon }
  ];

  const currentIcon = $derived.by(() => {
    if (current === 'light') return Sun;
    if (current === 'dark') return Moon;
    return SunMoon;
  });
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    aria-label="Change Theme"
  >
    {@const Icon = currentIcon}
    <Icon class="size-4" aria-hidden="true" />
  </Popover.Trigger>
  <Popover.Content side="bottom" align="end" class="w-36 p-1">
    {#each modes as { mode, label, icon: Icon }}
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none
          {current === mode
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
        onclick={() => setMode(mode)}
      >
        <Icon class="size-3.5" aria-hidden="true" />
        {label}
      </button>
    {/each}
  </Popover.Content>
</Popover.Root>
