<script lang="ts">
  import { APP_SCOPE_IDENTIFIERS } from '~/state/data_types';
  import type { AppScopeId } from '~/state/app_scope_queries';

  let { scope_id }: { scope_id: AppScopeId } = $props();

  const scope_label = $derived(APP_SCOPE_IDENTIFIERS[scope_id]);
</script>

<div class="mt-2 text-sm text-muted-foreground">
  {scope_label} profile settings will be available here soon.
</div>
