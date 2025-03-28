import { auth } from '~/lib/auth';
import type { LayoutServerLoad } from './$types'; // Adjust the path based on your project structure

export const load: LayoutServerLoad = async ({ locals, request }) => {
  const session = await auth.api.getSession({
    headers: request.headers
  });
  return {
    user_info: session?.user // This can be undefined if the user is not authenticated
  };
};
