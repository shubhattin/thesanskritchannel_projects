import type { BetterAuthClientPlugin } from 'better-auth';
import type { userInfoPlugin } from './server';

export const userInfoPluginClient = () => {
  return {
    id: 'additional_user_info',
    // SAFETY: better-auth only reads $InferServerPlugin's *type* (server-plugin inference);
    // the runtime value is never invoked, so an empty-object placeholder is safe here.
    $InferServerPlugin: {} as ReturnType<typeof userInfoPlugin>
  } satisfies BetterAuthClientPlugin;
};
