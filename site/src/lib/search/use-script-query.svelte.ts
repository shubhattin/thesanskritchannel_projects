import { untrack } from 'svelte';
import { createTypingContext } from 'lipilekhika/typing';
import { ensure_text_normal } from '@app/utils/search/project_name_dev_normal_cache';
import { normal_source_for_query_word } from '@app/utils/search/query_word_script';
import { tokenize_search_query } from '@app/utils/search/project_list_search';
import { site_prefs } from '$lib/main_text/site-prefs.svelte';

const TYPING_OPTIONS = { includeInherentVowel: false };

/**
 * Typing context for the current site script, plus Normal forms of Brahmic query words.
 * Call during component init. The context is recreated only when the script changes.
 * Script data is already preloaded by the script selector, so the switch does not wait on a cold load.
 */
export function use_script_query(get_query: () => string) {
  let ctx = $state(
    createTypingContext(
      untrack(() => site_prefs.script),
      TYPING_OPTIONS
    )
  );

  $effect(() => {
    const script = site_prefs.script;
    if (script === untrack(() => ctx.getNormalizedScript())) return;
    ctx = createTypingContext(script, TYPING_OPTIONS);
  });

  let query_normals = $state<readonly (string | undefined)[]>([]);
  /** Tokenized query the `query_normals` array was built for. Stale results are ignored. */
  let normals_for = $state('');

  $effect(() => {
    const words = tokenize_search_query(get_query());
    const selected = site_prefs.script;
    const sources = words.map((word) => normal_source_for_query_word(word, selected));
    const words_key = words.join('\0');

    if (sources.every((source) => source === null)) {
      if (untrack(() => normals_for) !== words_key || untrack(() => query_normals).length > 0) {
        normals_for = words_key;
        query_normals = [];
      }
      return;
    }

    let cancelled = false;
    void Promise.all(
      words.map(async (word, index) => {
        const source = sources[index];
        if (!source) return undefined;
        return ensure_text_normal(source, word);
      })
    ).then((normals) => {
      if (cancelled) return;
      normals_for = words_key;
      query_normals = normals;
    });

    return () => {
      cancelled = true;
    };
  });

  return {
    get ctx() {
      return ctx;
    },
    /** Normal forms for this exact query, or undefined while a Brahmic transliteration is still in flight. */
    normals_for_text(search_text: string) {
      if (tokenize_search_query(search_text).join('\0') !== normals_for) return undefined;
      return query_normals;
    }
  };
}
