<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs';
  import ListIcon from '@lucide/svelte/icons/list';
  import FileText from '@lucide/svelte/icons/file-text';
  import Plus from '@lucide/svelte/icons/plus';

  let lekha_section = $state('list');
</script>

<div class="flex w-full justify-center pt-2">
  <Tabs.Root
    bind:value={lekha_section}
    class="flex w-full max-w-3xl flex-row items-start gap-4 sm:gap-6"
  >
    <Tabs.List
      aria-label="Lekha tools"
      class="flex h-auto w-36 shrink-0 flex-col items-stretch gap-1 rounded-lg bg-muted p-[3px] sm:w-40"
    >
      <Tabs.Trigger value="list" class="w-full flex-none justify-start gap-2 px-3 py-2.5">
        <ListIcon class="size-4 shrink-0" aria-hidden="true" />
        List
      </Tabs.Trigger>
      <Tabs.Trigger value="drafts" class="w-full flex-none justify-start gap-2 px-3 py-2.5">
        <FileText class="size-4 shrink-0" aria-hidden="true" />
        Drafts
      </Tabs.Trigger>
      <Tabs.Trigger value="create" class="w-full flex-none justify-start gap-2 px-3 py-2.5">
        <Plus class="size-4 shrink-0" aria-hidden="true" />
        Create
      </Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="list" class="mt-0 min-h-0 min-w-0 flex-1 outline-none">
      <div
        class="min-h-[min(24rem,50vh)] rounded-lg border border-dashed border-border/70 bg-muted/15 p-6"
        aria-label="List — content area"
      ></div>
    </Tabs.Content>
    <Tabs.Content value="drafts" class="mt-0 min-h-0 min-w-0 flex-1 outline-none">
      <div
        class="min-h-[min(24rem,50vh)] rounded-lg border border-dashed border-border/70 bg-muted/15 p-6"
        aria-label="Drafts — content area"
      ></div>
    </Tabs.Content>
    <Tabs.Content value="create" class="mt-0 min-h-0 min-w-0 flex-1 outline-none">
      <div
        class="min-h-[min(24rem,50vh)] rounded-lg border border-dashed border-border/70 bg-muted/15 p-6"
        aria-label="Create — content area"
      ></div>
    </Tabs.Content>
  </Tabs.Root>
</div>
