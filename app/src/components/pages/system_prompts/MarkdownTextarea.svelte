<script lang="ts">
  import { cn } from '$lib/utils';

  type Props = {
    value?: string;
    class?: string;
    placeholder?: string;
    rows?: number;
    spellcheck?: boolean;
    disabled?: boolean;
    id?: string;
  };

  let {
    value = $bindable(''),
    class: className = '',
    placeholder = '',
    rows = 12,
    spellcheck = false,
    disabled = false,
    id = undefined
  }: Props = $props();

  let textarea_el = $state<HTMLTextAreaElement | null>(null);
  let mirror_el = $state<HTMLPreElement | null>(null);

  const sync_scroll = () => {
    if (!textarea_el || !mirror_el) return;
    mirror_el.scrollTop = textarea_el.scrollTop;
    mirror_el.scrollLeft = textarea_el.scrollLeft;
  };

  const escape_html = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const HEADING_RE = /^(#{1,6})(\s+)(.*)$/;
  const BULLET_RE = /^(\s*)([-*+])(\s+)(.*)$/;
  const ORDERED_RE = /^(\s*)(\d+\.)(\s+)(.*)$/;
  const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;

  const highlight_inline = (text: string): string => {
    if (!text) return '';
    let out = '';
    let remaining = text;
    const INLINE = /(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*\n]+?\*|_[^*_\n]+?_)/;
    let m: RegExpExecArray | null;
    while ((m = INLINE.exec(remaining)) !== null) {
      out += remaining.slice(0, m.index);
      const token = m[0];
      if (token.startsWith('**')) {
        out += `<span class="font-semibold text-primary">${token}</span>`;
      } else if (token.startsWith('`')) {
        out += `<span class="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">${token}</span>`;
      } else {
        out += `<span class="italic text-foreground">${token}</span>`;
      }
      remaining = remaining.slice(m.index + token.length);
    }
    return out + remaining;
  };

  const highlight_line = (line: string): string => {
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const [, marks, space, rest] = heading;
      return `<span class="font-semibold text-primary">${marks}</span>${space}<span class="font-semibold text-foreground">${highlight_inline(rest ?? '')}</span>`;
    }
    if (HR_RE.test(line.trim())) {
      return `<span class="text-foreground/60">${line}</span>`;
    }
    const bullet = BULLET_RE.exec(line) ?? ORDERED_RE.exec(line);
    if (bullet) {
      const [, indent, marker, space, rest] = bullet;
      return `${indent}<span class="text-foreground">${marker}</span>${space}${highlight_inline(rest ?? '')}`;
    }
    return highlight_inline(line);
  };

  const highlighted_html = $derived(
    value
      .split('\n')
      .map(
        (line) =>
          `<span class="block min-h-[1em] whitespace-pre-wrap">${highlight_line(escape_html(line)) || '&#8203;'}</span>`
      )
      .join('') + '<span>&#8203;</span>'
  );

  const layer_class =
    'w-full px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words';
</script>

<div class={cn('relative rounded-md border border-input bg-transparent', className)}>
  <pre
    bind:this={mirror_el}
    aria-hidden="true"
    class={cn(layer_class, 'pointer-events-none absolute inset-0 overflow-hidden')}><code
      >{@html highlighted_html}</code
    ></pre>
  <textarea
    bind:this={textarea_el}
    bind:value
    {placeholder}
    {rows}
    {spellcheck}
    {disabled}
    {id}
    onscroll={sync_scroll}
    class={cn(
      layer_class,
      'relative block resize-y border-0 bg-transparent text-transparent caret-foreground selection:bg-primary/30 selection:text-transparent focus-visible:outline-none'
    )}></textarea>
</div>

<style>
  textarea::placeholder {
    color: var(--muted-foreground);
  }
</style>
