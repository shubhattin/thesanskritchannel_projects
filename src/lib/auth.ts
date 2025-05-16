import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/db';
import { redis } from '../db/redis';
import * as schema from '../db/schema';
import { env } from '$env/dynamic/private';
import { admin, openAPI } from 'better-auth/plugins';
import { COOKIE_CACHE_TIME_MS } from './cache-time';
import { userInfoPlugin } from './auth_plugins/user_info/server';

export const ALLOWED_ORIGINS = (() => {
  if (import.meta.env.DEV) return ['http://localhost:5173', 'http://localhost:3000'];
  const list: string[] = [];
  if (env.AUTH_DOMAIN && env.AUTH_DOMAIN_SITES)
    for (let site of env.AUTH_DOMAIN_SITES.split(','))
      list.push(`https://${site}.${env.AUTH_DOMAIN}`);
  return list;
})();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema
  }),
  // emailAndPassword: {
  //   enabled: true
  // },
  plugins: [
    // username({
    //   minUsernameLength: 6,
    //   maxUsernameLength: 20
    // }),
    // we do we have it enabled but we are not using username auth now
    // to keep it simple its google auth only for now
    admin(),
    ...(import.meta.env.DEV ? [openAPI()] : []),
    userInfoPlugin()
    // captcha({
    //   provider: 'cloudflare-turnstile',
    //   secretKey: env.TURNSTILE_SECRET_KEY!
    // })
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: COOKIE_CACHE_TIME_MS / 1000
    },
    expiresIn: 60 * 60 * 24 * 15, // 15 days
    updateAge: 60 * 60 * 24 * 1 // 1 day (every 1 day the session expiration is updated)
  },
  secondaryStorage: {
    get: async (key) => {
      const value = (await redis.get(key)) as null | any;
      return value ? JSON.stringify(value) : null;
    },
    set: async (key, value, ttl) => {
      if (ttl)
        await redis.set(key, value, {
          ex: ttl
        });
      else await redis.set(key, value);
    },
    delete: async (key) => {
      await redis.del(key);
    }
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!
    }
  },
  advanced: {
    ...(env.AUTH_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: `.${env.AUTH_DOMAIN}` // Domain with a leading period
          },
          defaultCookieAttributes: {
            secure: true,
            httpOnly: true,
            sameSite: 'none', // Allows CORS-based cookie sharing across subdomains
            partitioned: true // New browser standards will mandate this for foreign cookies
          }
        }
      : {})
  },
  trustedOrigins: ALLOWED_ORIGINS
});
