<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { onDestroy } from 'svelte';

  let progress = $state(0);
  let opacity = $state(0);
  let settling = $state(false);

  let generation = 0;
  let running = false;
  let raf = 0;
  let hideTimer = 0;

  function cancelRaf() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function clearHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = 0;
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function tick() {
    const cap = 0.9;
    const remaining = cap - progress;
    const pace = progress < 0.35 ? 0.07 : 0.02;
    progress = Math.min(cap, progress + Math.max(remaining * pace, 0.0015));
    if (progress < cap - 0.001) raf = requestAnimationFrame(tick);
    else raf = 0;
  }

  function begin() {
    const gen = ++generation;
    clearHide();
    cancelRaf();
    running = true;
    settling = false;
    opacity = 1;
    progress = reducedMotion() ? 1 : 0.08;
    if (!reducedMotion()) raf = requestAnimationFrame(tick);
    return gen;
  }

  function finish(gen: number) {
    if (gen !== generation || !running) return;
    cancelRaf();

    // Two frames so the started bar paints before the completion transition,
    // including when the destination was already preloaded.
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        if (gen !== generation) return;
        running = false;

        if (reducedMotion()) {
          opacity = 0;
          settling = false;
          progress = 0;
          return;
        }

        settling = true;
        progress = 1;
        opacity = 0;
        hideTimer = window.setTimeout(() => {
          if (gen !== generation) return;
          hideTimer = 0;
          settling = false;
          progress = 0;
        }, 420);
      });
    });
  }

  // Client navigations only. The first load is `enter` and does not come
  // through here; leaving the document (`willUnload`) is a full page load.
  beforeNavigate((navigation) => {
    if (navigation.willUnload) return;
    const gen = begin();
    void navigation.complete.finally(() => finish(gen));
  });

  onDestroy(() => {
    cancelRaf();
    clearHide();
  });
</script>

<div
  class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]"
  style:opacity
  style:transition={settling ? 'opacity 200ms ease 160ms' : 'opacity 80ms ease'}
  aria-hidden="true"
>
  <div
    class="relative h-full w-full origin-left bg-primary shadow-[0_0_8px_var(--primary)]"
    style:transform="scaleX({progress})"
    style:transition={settling ? 'transform 180ms ease-out' : 'none'}
  >
    <span
      class="absolute inset-y-0 right-0 w-16 bg-linear-to-r from-transparent to-[oklch(0.97_0.05_95)]"
    ></span>
  </div>
</div>
