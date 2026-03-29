<script lang="ts">
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Monitor from '@lucide/svelte/icons/monitor';

  type ThemeMode = 'light' | 'dark' | 'system';

  let current: ThemeMode = $state('system');

  function init() {
    try {
      const stored = localStorage.getItem('tsc-site-theme');
      if (stored === 'light' || stored === 'dark') current = stored;
      else current = 'system';
    } catch {
      current = 'system';
    }
  }

  $effect(() => {
    init();
  });

  function setMode(mode: ThemeMode) {
    current = mode;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);

    document.documentElement.classList.toggle('dark', isDark);
    document.body?.classList.toggle('dark', isDark);

    // Set color-scheme for native element theming
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

    // Update theme-color meta
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', isDark ? '#1a1625' : '#f7f2eb');
    }

    try {
      if (mode === 'system') {
        localStorage.removeItem('tsc-site-theme');
      } else {
        localStorage.setItem('tsc-site-theme', mode);
      }
    } catch {}
  }

  const modes: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'system', label: 'System Theme', icon: Monitor },
    { mode: 'light', label: 'Light Theme', icon: Sun },
    { mode: 'dark', label: 'Dark Theme', icon: Moon }
  ];
</script>

<div class="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-0.5">
  {#each modes as { mode, label, icon: Icon }}
    <button
      type="button"
      aria-label={label}
      class="rounded-md p-1.5 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none
        {current === mode
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => setMode(mode)}
    >
      <Icon class="size-4" aria-hidden="true" />
    </button>
  {/each}
</div>
