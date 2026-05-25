<script lang="ts">
  import { APP_SCOPE_IDENTIFIERS, type AppScopeEnum } from '~/state/data_types';

  let { scope_id }: { scope_id: AppScopeEnum } = $props();

  const scope_label = $derived(APP_SCOPE_IDENTIFIERS[scope_id]);
</script>

<div class="mt-2 text-sm text-muted-foreground">
  {scope_label} profile settings will be available here soon.
</div>
