<script lang="ts">
  import type { IconType } from 'svelte-icons-pack';
  import { cl_join } from './cl_join';
  export let src: IconType;
  export let title: string | undefined = undefined;
  export let outerClass: string | undefined = undefined;
  let className = '';
  export { className as class };
  export let viewBox: string | undefined = undefined;
  let innerHtml: string;

  $: {
    innerHtml = (title ? `<title>${title}</title>` : '') + src.c;
  }
</script>

<span class={outerClass}>
  <svg
    stroke="currentColor"
    fill="currentColor"
    stroke-width="0"
    class={cl_join('inline-block', className)}
    {viewBox}
    height="1em"
    width="1em"
    {...src.a}
    xmlns="http://www.w3.org/2000/svg"
  >
    {@html innerHtml}
  </svg>
  <slot />
</span>
