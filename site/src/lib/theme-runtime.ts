/** Shared theme application + prefers-color-scheme listener (system mode). */

export const THEME_STORAGE_KEY = 'tsc-site-theme';

let darkMql: MediaQueryList | null = null;

export function getDarkMql(): MediaQueryList {
  if (!darkMql) darkMql = window.matchMedia('(prefers-color-scheme: dark)');
  return darkMql;
}

let systemListener: (() => void) | null = null;

function getStoredMode(): 'light' | 'dark' | null {
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY);
    if (s === 'light' || s === 'dark') return s;
    return null;
  } catch {
    return null;
  }
}

export function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  if (document.body) {
    document.body.style.colorScheme = isDark ? 'dark' : 'light';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark ? '#1a1625' : '#f7f2eb');
}

export function resolveIsDark(): boolean {
  const stored = getStoredMode();
  const mql = getDarkMql();
  return stored === 'dark' || (stored !== 'light' && mql.matches);
}

export function applyThemeFromStorage() {
  applyTheme(resolveIsDark());
}

export function detachSystemThemeListener() {
  if (!systemListener) return;
  getDarkMql().removeEventListener('change', systemListener);
  systemListener = null;
}

export function attachSystemThemeListener() {
  detachSystemThemeListener();
  const mql = getDarkMql();
  systemListener = () => {
    if (getStoredMode() !== null) return;
    applyTheme(mql.matches);
  };
  mql.addEventListener('change', systemListener);
}

/** Register MQL listener only when theme follows system (no explicit light/dark in storage). */
export function syncSystemThemeListener() {
  detachSystemThemeListener();
  if (getStoredMode() !== null) return;
  attachSystemThemeListener();
}

export function bootTheme() {
  applyThemeFromStorage();
  syncSystemThemeListener();
  document.addEventListener('astro:after-swap', () => {
    applyThemeFromStorage();
    syncSystemThemeListener();
  });
}
