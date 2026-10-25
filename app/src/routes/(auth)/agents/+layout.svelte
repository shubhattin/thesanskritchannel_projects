<script lang="ts">
  import type { Snippet } from 'svelte';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import ChatHistory from '~/components/pages/agents/sidebar/ChatHistory.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<MetaTags title="Agents" description="Admin AI agent for the Sanskrit Channel projects" />

<!-- App shell: chat history beside the open chat, filling the viewport below the app bar. -->
<div
  class="flex h-[calc(100dvh-4.75rem)] min-h-0 overflow-hidden rounded-xl border border-border/70 bg-background"
>
  <aside class="hidden w-72 shrink-0 flex-col border-r border-border/70 bg-muted/20 pt-3 md:flex">
    <ChatHistory />
  </aside>
  <main class="flex min-w-0 flex-1 flex-col">
    {@render children()}
  </main>
</div>
