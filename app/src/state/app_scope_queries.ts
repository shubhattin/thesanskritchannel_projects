import { queryOptions } from '@tanstack/svelte-query';
import type { APP_SCOPE_IDENTIFIERS } from '~/state/data_types';
import { get_user_app_scope_status } from '~/utils/app_scope_utils';
import ms from 'ms';

export type AppScopeId = keyof typeof APP_SCOPE_IDENTIFIERS;

export const APP_SCOPE_STATUS_QUERY_KEY = 'app_scope_status';

export const app_scope_status_query_options = (user_id: string, scope_name: AppScopeId) =>
  queryOptions({
    queryKey: [APP_SCOPE_STATUS_QUERY_KEY, user_id, scope_name],
    queryFn: () => get_user_app_scope_status(user_id, scope_name),
    enabled: !!user_id,
    staleTime: ms('5mins')
  });
