<script lang="ts">
  import { untrack } from 'svelte';
  import { ChevronDown } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
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

  const all_checked = $derived(
    project_registry.list.length > 0 &&
      project_registry.list.every((p) => selected_project_ids.has(p.id))
  );

  const some_checked = $derived(selected_project_ids.size > 0 && !all_checked);

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
    selected_project_ids = checked
      ? new Set(untrack(() => project_registry.list.map((p) => p.id)))
      : new Set();
  };

  const toggle_project = (id: number, checked: boolean) => {
    const next = new Set(untrack(() => selected_project_ids));
    if (checked) next.add(id);
    else next.delete(id);
    selected_project_ids = next;
  };
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
        <div class="max-h-64 space-y-1 overflow-y-auto">
          <label
            class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <Checkbox
              checked={all_checked}
              indeterminate={some_checked}
              onCheckedChange={(v) => toggle_all(v === true)}
            />
            <span class="text-sm font-medium">All</span>
          </label>
          <div class="my-1 border-t border-border/60"></div>
          {#each project_registry.list as project (project.id)}
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
        </div>
      </Popover.Content>
    </Popover.Root>
  {/if}
</div>
