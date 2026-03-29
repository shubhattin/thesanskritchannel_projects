<script lang="ts">
  import * as Popover from '~/lib/components/ui/popover';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Monitor from '@lucide/svelte/icons/monitor';
  import SunMoon from '@lucide/svelte/icons/sun-moon';

  type ThemeMode = 'light' | 'dark' | 'system';

  let current: ThemeMode = $state('system');
  let open = $state(false);

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

  function applyTheme(isDark: boolean) {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#1a1625' : '#f7f2eb');
  }

  function setMode(mode: ThemeMode) {
    current = mode;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);

    applyTheme(isDark);

    try {
      if (mode === 'system') {
        localStorage.removeItem('tsc-site-theme');
      } else {
        localStorage.setItem('tsc-site-theme', mode);
      }
    } catch {}

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
