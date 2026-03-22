import {
  navigate,
  supportsViewTransitions,
  transitionEnabledOnThisPage
} from 'astro:transitions/client';

export async function reload_current_page() {
  const href = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  try {
    if (supportsViewTransitions && transitionEnabledOnThisPage()) {
      await navigate(href, { history: 'replace' });
      return;
    }
  } catch {}

  window.location.assign(window.location.href);
}
