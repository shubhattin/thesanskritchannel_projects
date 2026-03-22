<script lang="ts">
  import Icon from '~/tools/Icon.svelte';
  import { OiVideo16 } from 'svelte-icons-pack/oi';
  import type { media_list_type } from './index';
  import { AiOutlineFileText } from 'svelte-icons-pack/ai';
  import { LuAudioLines } from 'svelte-icons-pack/lu';
  import { BsFileEarmarkPdf } from 'svelte-icons-pack/bs';

  let { media_type }: { media_type: media_list_type } = $props();
</script>

{#if media_type === 'video'}
  <Icon src={OiVideo16} class="text-2xl text-red-600 dark:text-red-400" />
{:else if media_type === 'audio'}
  <Icon src={LuAudioLines} class="text-2xl text-sky-600 dark:text-sky-400" />
{:else if media_type === 'pdf'}
  <Icon src={BsFileEarmarkPdf} class="text-xl text-rose-500 dark:text-rose-400" />
{:else if media_type === 'text'}
  <Icon src={AiOutlineFileText} class="text-2xl" />
{/if}
