<script lang="ts">
  /**
   * Client enhancement: wraps each markdown `<pre>` in a hover/focus-visible region with a Copy control.
   * Used on lekha article bodies only (`data-lekha-markdown`).
   */
  import { onMount } from 'svelte';

  /** CSS selector for the container holding rendered markdown (SSR `Content`). */
  let {
    anchorSelector = '[data-lekha-markdown]'
  }: {
    anchorSelector?: string;
  } = $props();

  let live_region = $state('');

  const svg_ns = 'http://www.w3.org/2000/svg';

  function base_icons_svg(width: string, height: string) {
    const svg = document.createElementNS(svg_ns, 'svg');
    svg.setAttribute('xmlns', svg_ns);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  }

  /** Matches `@lucide/svelte/icons/copy` (Lucide v0). */
  function lucide_icon_copy(): SVGSVGElement {
    const svg = base_icons_svg('16', '16');
    const rect = document.createElementNS(svg_ns, 'rect');
    rect.setAttribute('width', '14');
    rect.setAttribute('height', '14');
    rect.setAttribute('x', '8');
    rect.setAttribute('y', '8');
    rect.setAttribute('rx', '2');
    rect.setAttribute('ry', '2');
    svg.appendChild(rect);
    const path = document.createElementNS(svg_ns, 'path');
    path.setAttribute('d', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2');
    svg.appendChild(path);
    return svg;
  }

  /** Matches `@lucide/svelte/icons/check` (Lucide v0). */
  function lucide_icon_check(): SVGSVGElement {
    const svg = base_icons_svg('16', '16');
    const path = document.createElementNS(svg_ns, 'path');
    path.setAttribute('d', 'M20 6 9 17l-5-5');
    svg.appendChild(path);
    return svg;
  }

  function get_code_text(pre: HTMLPreElement) {
    return pre.querySelector('code')?.innerText ?? pre.innerText;
  }

  function enhance(container: HTMLElement) {
    container.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
      if (pre.closest('[data-code-block-copy]')) return;

      const wrap = document.createElement('div');
      wrap.className = 'lekha-code-block-copy group relative z-0';
      wrap.setAttribute('data-code-block-copy', '');

      const parent = pre.parentNode;
      if (!parent) return;
      parent.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'lekha-code-copy-btn absolute right-2 top-2 z-10 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card/95 text-foreground shadow-sm backdrop-blur transition-opacity duration-150 pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100';
      btn.setAttribute('aria-label', 'Copy code');
      const icon_holder = document.createElement('span');
      icon_holder.className = 'lekha-code-copy-icon inline-flex [&>svg]:size-4';
      icon_holder.appendChild(lucide_icon_copy());
      btn.appendChild(icon_holder);

      btn.addEventListener('click', async () => {
        const text = get_code_text(pre);
        const show_copy = () => {
          icon_holder.replaceChildren(lucide_icon_copy());
        };
        try {
          await navigator.clipboard.writeText(text);
          icon_holder.replaceChildren(lucide_icon_check());
          btn.setAttribute('aria-label', 'Copied');
          live_region = 'Code copied';
          window.setTimeout(() => {
            btn.setAttribute('aria-label', 'Copy code');
            show_copy();
          }, 2200);
        } catch {
          btn.setAttribute('aria-label', 'Copy failed');
          live_region = 'Copy failed';
          window.setTimeout(() => {
            btn.setAttribute('aria-label', 'Copy code');
            show_copy();
          }, 2200);
        }
      });

      wrap.appendChild(btn);
    });
  }

  onMount(() => {
    const root = document.querySelector<HTMLElement>(anchorSelector);
    if (!root || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    enhance(root);
  });
</script>

<!--
  Hydration attaches behaviour; no chrome. Live region announces copy for SRs.
-->
<div role="status" class="sr-only" aria-live="polite">{live_region}</div>
