import { type BetterAuthPlugin } from 'better-auth';

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
