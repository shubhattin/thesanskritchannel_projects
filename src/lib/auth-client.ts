import { createAuthClient } from 'better-auth/svelte';
import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
import { adminClient } from 'better-auth/client/plugins';
import { userInfoPluginClient } from './auth_plugins/user_info/client';

export const authClient = createAuthClient({
  baseURL: PUBLIC_BETTER_AUTH_URL ?? import.meta.env.VITE_SITE_URL ?? 'http://localhost:5173',
  plugins: [
    // usernameClient(),
    adminClient(),
    userInfoPluginClient()
  ]
});

export const { useSession, signIn, signOut, signUp } = authClient;
