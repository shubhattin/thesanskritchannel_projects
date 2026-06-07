/**
 * Bundled GitHub-inspired Shiki themes with dual CSS-variable output.
 * Matches Carta defaults pattern (dual light/dark) for editor + SSR HTML.
 *
 * @see https://shiki.style/guide/dual-themes — class-based dark (`html.dark`) uses `--shiki-dark*`.
 */
import type { DualTheme } from 'carta-md';

/** Shared across Carta (`theme`), `@cartamd/plugin-code`, and `renderLekhaMarkdownToHtml`. */
export const LEKHA_SHIKI_DUAL: DualTheme = {
  light: 'github-light',
  dark: 'github-dark'
};
