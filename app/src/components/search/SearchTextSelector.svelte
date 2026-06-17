<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { ChevronDown, Search } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Popover from '$lib/components/ui/popover';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import type { project_registry_type } from '~/state/project_list';

  let {
    selected_project_ids = $bindable(new Set<number>()),
    project_registry,
    loading = false
  }: {
    selected_project_ids?: Set<number>;
    project_registry: project_registry_type;
    loading?: boolean;
  } = $props();

  let open = $state(false);
  let name_filter = $state('');
  let filter_input_el: HTMLInputElement | null = $state(null);

  const filtered_projects = $derived.by(() => {
    const q = name_filter.trim().toLowerCase();
    if (!q) return project_registry.list;
    return project_registry.list.filter((p) => p.name.toLowerCase().includes(q));
  });

  const all_checked = $derived(
    filtered_projects.length > 0 && filtered_projects.every((p) => selected_project_ids.has(p.id))
  );

  const some_checked = $derived(
    filtered_projects.some((p) => selected_project_ids.has(p.id)) && !all_checked
  );

  const button_label = $derived.by(() => {
    const count = selected_project_ids.size;
    if (count === 0) return 'Select text';
    if (count === 1) {
      const id = [...selected_project_ids][0]!;
      return project_registry.byId.get(id)?.name ?? '1 text';
    }
    return `${count} texts`;
  });

  const toggle_all = (checked: boolean) => {
    const next = new Set(untrack(() => selected_project_ids));
    for (const project of filtered_projects) {
      if (checked) next.add(project.id);
      else next.delete(project.id);
    }
    selected_project_ids = next;
  };

  const toggle_project = (id: number, checked: boolean) => {
    const next = new Set(untrack(() => selected_project_ids));
    if (checked) next.add(id);
    else next.delete(id);
    selected_project_ids = next;
  };

  $effect(() => {
    if (!open) {
      name_filter = '';
      return;
    }
    void tick().then(() => filter_input_el?.focus());
  });
</script>

<div class="space-y-2">
  <Label class="text-sm font-medium">Text</Label>
  {#if loading}
    <Skeleton class="h-10 w-full" />
  {:else}
    <Popover.Root bind:open>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="outline"
            class="w-full justify-between font-normal"
            aria-label="Select texts to search"
          >
            <span class="truncate">{button_label}</span>
            <ChevronDown class="size-4 shrink-0 opacity-50" />
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content
        class="w-(--bits-popover-anchor-width) border-border bg-card p-2 text-card-foreground shadow-md"
        align="start"
      >
        <div class="relative mb-2">
          <Search
            class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            bind:ref={filter_input_el}
            bind:value={name_filter}
            placeholder="Search by name…"
            class="h-8 pl-8"
            aria-label="Filter texts by name"
            onkeydown={(e) => e.stopPropagation()}
          />
        </div>
        <div class="max-h-64 space-y-1 overflow-y-auto">
          <label
            class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <Checkbox
              checked={all_checked}
              indeterminate={some_checked}
              onCheckedChange={(v) => toggle_all(v === true)}
            />
            <span class="text-sm font-medium">
              {name_filter.trim() ? 'All shown' : 'All'}
            </span>
          </label>
          <div class="my-1 border-t border-border/60"></div>
          {#if filtered_projects.length === 0}
            <p class="px-2 py-3 text-center text-sm text-muted-foreground">No matching texts</p>
          {:else}
            {#each filtered_projects as project (project.id)}
              <label
                class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <Checkbox
                  checked={selected_project_ids.has(project.id)}
                  onCheckedChange={(v) => toggle_project(project.id, v === true)}
                />
                <span class="truncate text-sm">{project.name}</span>
              </label>
            {/each}
          {/if}
        </div>
      </Popover.Content>
    </Popover.Root>
  {/if}
</div>
