/** Admin + public site origins and minimal public routes, so the agent can give shareable links. */

import { PUBLIC_SITE_ORIGIN } from '~/effect/sitemap_cache';

function normalizeOrigin(value: string | undefined): string {
  const raw = (value ?? '').trim().split(/\s/)[0] ?? '';
  const cleaned = raw.replace(/\/+$/, '');
  // Defense-in-depth: config is operator-controlled, but keep the <site> tag shape intact.
  if (!cleaned) return '';
  if (!/^https?:\/\/[^<>\s]+$/.test(cleaned)) return '';
  return cleaned;
}

/** `<site>` section content, rebuilt on every agent creation (so new and old chats get it). */
export function buildSiteContext({
  adminOrigin,
  publicOrigin
}: {
  adminOrigin?: string;
  publicOrigin?: string;
}): string {
  const admin = normalizeOrigin(adminOrigin);
  const publicSite = normalizeOrigin(publicOrigin) || PUBLIC_SITE_ORIGIN;
  const adminLine = admin
    ? `Admin portal origin (VITE_SITE_URL): ${admin}`
    : 'Admin portal origin (VITE_SITE_URL): (not set — use relative paths like /search)';
  return `${adminLine}
Public site origin (VITE_MAIN_SITE_URL): ${publicSite}
Public routes (minimal, enough to link answers):
- / — public home
- /texts — all texts list
- /<project_key>/<path...> — project reader (e.g. /ramayanam/1/1#L-8; search_texts hrefs are already in this form)
- /lekha — articles list
- /lekha/<slug> — single article (e.g. /lekha/my-article)
- /support — support page
Admin routes (minimal):
- /search — same search as the search_texts tool
- /<project_key>/[...path] reader and /<project_key>/edit editor
- /lekha list and /lekha/edit/[id] editor
Link rules:
- In-chat passage citations stay relative, as in the Style section (e.g. [..](/ramayanam/1/1#L-8)).
- When the admin asks for a reference or link to share outside the chat, link the relevant public route.
- Prefer absolute public URLs (<public-origin><path>, e.g. ${publicSite}/lekha) for shareable references; search_texts hrefs are relative public paths — prefix them with the public origin.
- For admin-only work, give relative admin paths (e.g. /search) or prefix with the admin origin.
- projects.listed=false and lekha drafts are not public — never link them as public pages.
- Only link routes that exist above; never invent deeper paths.`;
}
