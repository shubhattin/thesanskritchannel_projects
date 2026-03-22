<script lang="ts">
  import { cn } from '$lib/utils';

  interface Props {
    value: number;
    max?: number;
    size?: string;
    strokeWidth?: string;
    class?: string;
    meterClass?: string;
    trackClass?: string;
  }

  let {
    value,
    max = 100,
    size = 'size-8',
    strokeWidth = '4px',
    class: className = '',
    meterClass = 'stroke-primary',
    trackClass = 'stroke-primary/30'
  }: Props = $props();

  let percentage = $derived(Math.min((value / max) * 100, 100));
  let circumference = $derived(2 * Math.PI * 45); // radius of 45
  let strokeDashoffset = $derived(circumference - (percentage / 100) * circumference);
</script>

<svg class={cn('inline-block -rotate-90', size, className)} viewBox="0 0 100 100">
  <!-- Track -->
  <circle class={cn('fill-none', trackClass)} cx="50" cy="50" r="45" stroke-width={strokeWidth} />
  <!-- Meter -->
  <circle
    class={cn('fill-none transition-all duration-200', meterClass)}
    cx="50"
    cy="50"
    r="45"
    stroke-width={strokeWidth}
    stroke-linecap="butt"
    stroke-dasharray={circumference}
    stroke-dashoffset={strokeDashoffset}
  />
</svg>
