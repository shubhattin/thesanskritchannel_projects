<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Cpu from '@lucide/svelte/icons/cpu';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import {
    agent_model_id_schema,
    AGENT_MODEL_IDS,
    AGENT_MODELS,
    type AgentModelId
  } from '~/agents/models';

  let { value = $bindable(), disabled = false }: { value: AgentModelId; disabled?: boolean } =
    $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger {disabled}>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="sm" class="text-muted-foreground">
        <Cpu />
        {AGENT_MODELS[value].label}
        <ChevronDown class="opacity-60" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="start" class="w-64">
    <DropdownMenu.Group>
      <DropdownMenu.Label>Model</DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        bind:value={
          () => value,
          (next) => {
            const parsed = agent_model_id_schema.safeParse(next);
            if (parsed.success) value = parsed.data;
          }
        }
      >
        {#each AGENT_MODEL_IDS as id (id)}
          <DropdownMenu.RadioItem value={id} class="items-start">
            <span class="flex flex-col">
              <span class="font-medium">{AGENT_MODELS[id].label}</span>
              <span class="text-xs text-muted-foreground">{AGENT_MODELS[id].hint}</span>
            </span>
          </DropdownMenu.RadioItem>
        {/each}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
