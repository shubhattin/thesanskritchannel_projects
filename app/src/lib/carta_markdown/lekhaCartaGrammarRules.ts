import type { GrammarRule } from 'carta-md';

/**
 * Carta/Shiki highlight uses a generic HTML-block rule whose `while` continues on every
 * non-blank line until a blank line. That keeps markdown (e.g. `##` headings) after
 * `</lipi-shloka>` on the *next* line inside the HTML tokenizer, so headings lose scopes.
 *
 * These begin/end rules are injected before `#html` so Lipi blocks close at their real
 * closing tags and following markdown highlights normally.
 */
export const LEKHA_CARTA_GRAMMAR_RULES: GrammarRule[] = [
  {
    name: 'lipi-custom-block',
    type: 'block',
    definition: {
      begin: '(?i)(^|\\G)[ \\t]*(<(lipi)(?:\\s[^>]*)?\\s*>)',
      beginCaptures: {
        '2': { name: 'meta.tag.structure.start.html' },
        '3': { name: 'entity.name.tag.html' }
      },
      end: '(?i)(^|\\G)[ \\t]*(</\\s*(lipi)\\s*>)',
      endCaptures: {
        '2': { name: 'meta.tag.structure.end.html' },
        '3': { name: 'entity.name.tag.html' }
      },
      name: 'meta.embedded.block.lipi.markdown',
      patterns: [{ include: 'text.html.markdown' }]
    }
  },
  {
    name: 'shloka-custom-block',
    type: 'block',
    definition: {
      begin: '(?i)(^|\\G)[ \\t]*(<(shloka)(?:\\s[^>]*)?\\s*>)',
      beginCaptures: {
        '2': { name: 'meta.tag.structure.start.html' },
        '3': { name: 'entity.name.tag.html' }
      },
      end: '(?i)(^|\\G)[ \\t]*(</\\s*(shloka)\\s*>)',
      endCaptures: {
        '2': { name: 'meta.tag.structure.end.html' },
        '3': { name: 'entity.name.tag.html' }
      },
      name: 'meta.embedded.block.shloka.markdown',
      patterns: [{ include: 'text.html.markdown' }]
    }
  },
  {
    name: 'lipi-shloka-custom-block',
    type: 'block',
    definition: {
      begin: '(?i)(^|\\G)[ \\t]*(<(lipi-shloka)(?:\\s[^>]*)?\\s*>)',
      beginCaptures: {
        '2': { name: 'meta.tag.structure.start.html' },
        '3': { name: 'entity.name.tag.html' }
      },
      end: '(?i)(^|\\G)[ \\t]*(</\\s*(lipi-shloka)\\s*>)',
      endCaptures: {
        '2': { name: 'meta.tag.structure.end.html' },
        '3': { name: 'entity.name.tag.html' }
      },
      name: 'meta.embedded.block.lipi-shloka.markdown',
      patterns: [{ include: 'text.html.markdown' }]
    }
  }
];
