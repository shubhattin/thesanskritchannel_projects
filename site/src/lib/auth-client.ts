import { createAuthClient } from 'better-auth/svelte';
import { adminClient, jwtClient } from 'better-auth/client/plugins';
import { userInfoPluginClient } from '$app/lib/auth_plugins/user_info/client';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL ?? 'http://localhost:5188',
  plugins: [
    // usernameClient(),
    adminClient(),
    userInfoPluginClient(),
    jwtClient()
  ]
});

export const { useSession, signIn, signOut, signUp } = authClient;
