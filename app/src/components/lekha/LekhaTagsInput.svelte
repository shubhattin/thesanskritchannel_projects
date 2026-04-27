<script lang="ts">
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import X from '@lucide/svelte/icons/x';

  let {
    id = 'lekha-tags',
    label = 'Tags',
    tags = $bindable([]),
    placeholder = 'Add tag and press Enter'
  }: {
    id?: string;
    label?: string;
    tags?: string[];
    placeholder?: string;
  } = $props();

  let draft = $state('');

  const add_tags_from_string = (raw: string) => {
    const parts = raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...tags];
    const seen = new Set(next.map((t) => t.toLowerCase()));
    for (const p of parts) {
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(p);
    }
    tags = next;
  };

  const remove_at = (index: number) => {
    tags = tags.filter((_, i) => i !== index);
  };

  const handle_tag_keydown = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = e.currentTarget.value.trim();
      if (v) {
        add_tags_from_string(v);
        e.currentTarget.value = '';
        draft = '';
      }
      return;
    }
    if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      tags = tags.slice(0, -1);
    }
  };
</script>

<div class="space-y-2">
  <Label for={id} class="text-sm font-medium">{label}</Label>
  <div
    class="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 dark:bg-input/30"
  >
    {#each tags as tag, i (tag + ':' + i)}
      <span
        class="inline-flex max-w-full items-center gap-0.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
      >
        <span class="truncate">{tag}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-5 shrink-0 text-muted-foreground hover:text-foreground"
          onclick={() => remove_at(i)}
          aria-label={`Remove tag ${tag}`}
        >
          <X class="size-3" />
        </Button>
      </span>
    {/each}
    <Input
      {id}
      data-slot="input-group-control"
      class="min-w-[8rem] flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
      {placeholder}
      bind:value={draft}
      onkeydown={handle_tag_keydown}
      onblur={() => {
        const v = draft.trim();
        if (v) {
          add_tags_from_string(v);
          draft = '';
        }
      }}
    />
  </div>
</div>
