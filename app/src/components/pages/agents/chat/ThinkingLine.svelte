<script lang="ts">
  import Bot from '@lucide/svelte/icons/bot';
  import StepLine from '../tools/StepLine.svelte';
</script>

<StepLine title="Working" status="running">
  {#snippet icon()}<Bot />{/snippet}
</StepLine>
