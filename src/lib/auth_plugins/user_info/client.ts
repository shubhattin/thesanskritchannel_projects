import type { BetterAuthClientPlugin } from 'better-auth';
import type { userInfoPlugin } from './server';

export const userInfoPluginClient = () => {
  return {
    id: 'additional_user_info',
    $InferServerPlugin: {} as ReturnType<typeof userInfoPlugin>
  } satisfies BetterAuthClientPlugin;
};
