<script lang="ts">
  import { cl_join } from '~/tools/cl_join';
  let { class: className, src }: { class: string; src: string } = $props();
</script>

<span class={cl_join('inline-block bg-cover', className)} style:background-image={`url(${src})`}
></span>
