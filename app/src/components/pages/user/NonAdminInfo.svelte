<script lang="ts">
  import AppScopeStatusGate from './AppScopeStatusGate.svelte';
  import ProjectsPortalProfile from './ProjectsPortalProfile.svelte';
  import LekhaProfilePanel from './LekhaProfilePanel.svelte';
  import { APP_SCOPE_ID_LEKHA, APP_SCOPE_ID_PROJECT_PORTAL, type AppScopeEnum } from '~/state/data_types';

  let {
    user_info,
    scope_id = APP_SCOPE_ID_PROJECT_PORTAL
  }: {
    user_info: {
      id: string;
      name: string;
      email: string;
      role?: string | null;
    };
    scope_id?: AppScopeEnum;
  } = $props();
</script>

<AppScopeStatusGate user_id={user_info.id} {scope_id}>
  {#if scope_id === APP_SCOPE_ID_PROJECT_PORTAL}
    <ProjectsPortalProfile {user_info} />
  {:else if scope_id === APP_SCOPE_ID_LEKHA}
    <LekhaProfilePanel {scope_id} />
  {/if}
</AppScopeStatusGate>
