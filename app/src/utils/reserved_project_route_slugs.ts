/**
 * Top-level URL segments reserved by the admin app (`app/src/routes`) and public site
 * (`site/src/pages`). Project keys are the first path segment on both apps and must not
 * collide with these static routes (route groups and `[param]` segments are excluded).
 *
 * app/src/routes: api, grammar, lekha, search, user
 * site/src/pages: api, lekha, support
 */
export const RESERVED_PROJECT_ROUTE_SLUGS = [
  'api',
  'grammar',
  'lekha',
  'search',
  'support',
  'user'
] as const;

const reserved_slug_set = new Set<string>(RESERVED_PROJECT_ROUTE_SLUGS);

export const is_reserved_project_route_slug = (slug: string) => reserved_slug_set.has(slug);
