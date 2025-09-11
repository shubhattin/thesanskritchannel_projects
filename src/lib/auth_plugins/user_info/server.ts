import { type BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint } from 'better-auth/plugins';
import { z } from 'zod';
import { redis } from '~/db/redis';
import { auth } from '~/lib/auth';

export const userInfoPlugin = () => {
  return {
    id: 'additional_user_info',
    schema: {
      user: {
        fields: {
          is_maintainer: {
            type: 'boolean',
            defaultValue: false,
            required: false,
            input: false
          }
        }
      }
    }
  } satisfies BetterAuthPlugin;
};
