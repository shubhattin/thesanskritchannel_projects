<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs';
  import { Button } from '$lib/components/ui/button';
  import ListIcon from '@lucide/svelte/icons/list';
  import FileText from '@lucide/svelte/icons/file-text';
  import Plus from '@lucide/svelte/icons/plus';
  import LekhaList from '~/components/lekha/LekhaList.svelte';
  import MetaTags from '~/components/tags/MetaTags.svelte';

  let lekha_section: 'published' | 'draft' = $state('published');
</script>

<MetaTags title="Lekha" description="Lekha is a platform for creating and managing lekha." />

<div class="flex w-full flex-col items-center gap-4 pt-2">
  <div class="flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h1 class="text-xl font-semibold tracking-tight">Lekha</h1>
    <Button href="/lekha/add" class="shrink-0 gap-2">
      <Plus class="size-4" aria-hidden="true" />
      New post
    </Button>
  </div>

  <Tabs.Root
    bind:value={lekha_section}
    class="flex w-full max-w-3xl flex-row items-start gap-4 sm:gap-6"
  >
    <Tabs.List
      aria-label="Lekha tools"
      class="flex h-auto w-36 shrink-0 flex-col items-stretch gap-1 rounded-lg bg-muted p-[3px] sm:w-40"
    >
      <Tabs.Trigger value="published" class="w-full flex-none justify-start gap-2 px-3 py-2.5">
        <ListIcon class="size-4 shrink-0" aria-hidden="true" />
        Published
      </Tabs.Trigger>
      <Tabs.Trigger value="draft" class="w-full flex-none justify-start gap-2 px-3 py-2.5">
        <FileText class="size-4 shrink-0" aria-hidden="true" />
        Draft
      </Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="published" class="mt-0 min-h-0 min-w-0 flex-1 outline-none">
      <LekhaList draft={false} />
    </Tabs.Content>
    <Tabs.Content value="draft" class="mt-0 min-h-0 min-w-0 flex-1 outline-none">
      <LekhaList draft={true} />
    </Tabs.Content>
  </Tabs.Root>
</div>
