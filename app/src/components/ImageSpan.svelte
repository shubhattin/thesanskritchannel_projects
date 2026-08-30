<script lang="ts">
  import { cn } from '$lib/utils';
  let { class: className, src }: { class: string; src: string } = $props();
</script>

<span class={cn('inline-block bg-cover', className)} style:background-image={`url(${src})`}></span>
