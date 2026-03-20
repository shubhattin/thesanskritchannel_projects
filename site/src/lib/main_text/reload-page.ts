export async function reload_current_page() {
  try {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      document.startViewTransition(() => {
        window.location.assign(window.location.href);
      });
      return;
    }
  } catch {}

  window.location.assign(window.location.href);
}
