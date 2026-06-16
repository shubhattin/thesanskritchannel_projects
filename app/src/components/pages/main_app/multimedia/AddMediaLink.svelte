<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { CgAdd } from 'svelte-icons-pack/cg';
  import Icon from '~/tools/Icon.svelte';

  let { on_add }: { on_add: () => void } = $props();
</script>

<Button type="button" variant="outline" size="sm" class="h-8 w-full text-xs" onclick={on_add}>
  <Icon src={CgAdd} class="text-base" />
  Add link
</Button>
