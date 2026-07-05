import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ImageSystemFontRole = 'main' | 'normal' | 'trans' | 'num_main' | 'num_norm';

export type ImageSystemFontOverrides = Record<ImageSystemFontRole, string | null>;

export const EMPTY_SYSTEM_FONT_OVERRIDES: ImageSystemFontOverrides = {
  main: null,
  normal: null,
  trans: null,
  num_main: null,
  num_norm: null
};

export const SYSTEM_FONT_ROLE_LABELS: Record<ImageSystemFontRole, string> = {
  main: 'Main text',
  normal: 'Normal text',
  trans: 'Translation',
  num_main: 'Native number',
  num_norm: 'Romanized number'
};

const SYSTEM_FONT_ROLES = Object.keys(EMPTY_SYSTEM_FONT_OVERRIDES) as ImageSystemFontRole[];

let cached_system_fonts: string[] | null = null;
let system_fonts_load_failed = false;
let preload_promise: Promise<string[]> | null = null;

/** Shared list for pickers — null until first successful load attempt finishes. */
export const system_font_families = writable<string[] | null>(null);
export const system_fonts_loading = writable(false);

export function system_fonts_available(): boolean {
  return browser && 'queryLocalFonts' in window;
}

function yield_to_main_thread(): Promise<void> {
  return new Promise((resolve) => {
    if (browser && 'requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(), { timeout: 120 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function dedupe_and_sort_families(fonts: { family: string }[]): string[] {
  const families = [...new Set(fonts.map((f) => f.family))];
  families.sort((a, b) => a.localeCompare(b));
  return families;
}

/** Check whether a system font family is available on this device. */
export function is_system_font_family_available(
  family: string,
  installed_families: string[] | null = cached_system_fonts
): boolean {
  if (!browser || !family) return false;
  if (installed_families && installed_families.length > 0) {
    return installed_families.includes(family);
  }
  try {
    return document.fonts.check(`16px "${family}"`);
  } catch {
    return false;
  }
}

export type MissingSystemFont = { role: ImageSystemFontRole; family: string };

/** Drop preset system fonts that are not installed locally. */
export async function sanitize_system_font_overrides(
  overrides: ImageSystemFontOverrides
): Promise<{ overrides: ImageSystemFontOverrides; missing: MissingSystemFont[] }> {
  const installed = await load_system_font_families();
  const missing: MissingSystemFont[] = [];
  const sanitized = { ...overrides };

  for (const role of SYSTEM_FONT_ROLES) {
    const family = overrides[role];
    if (!family) continue;
    if (!is_system_font_family_available(family, installed)) {
      sanitized[role] = null;
      missing.push({ role, family });
    }
  }

  return { overrides: sanitized, missing };
}

/** Start loading system fonts in the background (safe to call multiple times). */
export function preload_system_font_families(): Promise<string[]> {
  if (!browser) return Promise.resolve([]);
  if (cached_system_fonts) return Promise.resolve(cached_system_fonts);
  if (system_fonts_load_failed) return Promise.resolve([]);
  if (preload_promise) return preload_promise;

  if (!system_fonts_available()) {
    system_fonts_load_failed = true;
    system_font_families.set([]);
    return Promise.resolve([]);
  }

  system_fonts_loading.set(true);

  preload_promise = (async () => {
    try {
      await yield_to_main_thread();

      const query = window.queryLocalFonts;
      if (!query) {
        system_fonts_load_failed = true;
        system_font_families.set([]);
        return [];
      }

      const fonts = await query();
      await yield_to_main_thread();

      const families = dedupe_and_sort_families(fonts);
      cached_system_fonts = families;
      system_font_families.set(families);
      return families;
    } catch {
      system_fonts_load_failed = true;
      system_font_families.set([]);
      return [];
    } finally {
      system_fonts_loading.set(false);
      preload_promise = null;
    }
  })();

  return preload_promise;
}

/** Returns cached families or waits for an in-flight preload. */
export async function load_system_font_families(): Promise<string[]> {
  if (cached_system_fonts) return cached_system_fonts;
  if (system_fonts_load_failed) return [];
  return preload_system_font_families();
}

export function clear_system_fonts_cache() {
  cached_system_fonts = null;
  system_fonts_load_failed = false;
  preload_promise = null;
  system_font_families.set(null);
  system_fonts_loading.set(false);
}

export function toast_missing_system_fonts(missing: MissingSystemFont[]) {
  if (missing.length === 0) return;

  // Dynamic import avoids pulling sonner into server bundles.
  void import('svelte-sonner').then(({ toast }) => {
    if (missing.length === 1) {
      const { role, family } = missing[0]!;
      toast.warning(
        `Font "${family}" (${SYSTEM_FONT_ROLE_LABELS[role]}) is not installed on this device. Using the project font instead.`
      );
      return;
    }

    const description = missing
      .map(({ role, family }) => `• ${SYSTEM_FONT_ROLE_LABELS[role]}: ${family}`)
      .join('\n');

    toast.warning(
      `${missing.length} preset system fonts are not installed on this device. Using project fonts instead.`,
      { description }
    );
  });
}
