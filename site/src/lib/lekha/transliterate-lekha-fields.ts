export type LekhaTransliterationSource = {
  title: string;
  description: string;
  auto_transliterate_title: boolean;
  auto_transliterate_description: boolean;
};

export type LekhaTransliteratedFields = {
  /** Null when the viewing script is Devanagari, the flag is off, or the result matches the source. */
  title_transliterated: string | null;
  description_transliterated: string | null;
};

/**
 * One lipilekhika list call for every title and description that should change script.
 * `transliterate_list` returns null for Devanagari so the payload is not duplicated.
 */
export async function transliterate_lekha_fields<T extends LekhaTransliterationSource>(
  rows: readonly T[],
  script_id: number,
  transliterate_list: (text: string[], script_id: number) => Promise<string[] | null>
): Promise<Array<T & LekhaTransliteratedFields>> {
  const jobs: string[] = [];
  const slots: { index: number; field: 'title' | 'description' }[] = [];

  rows.forEach((row, index) => {
    if (row.auto_transliterate_title && row.title.length > 0) {
      jobs.push(row.title);
      slots.push({ index, field: 'title' });
    }
    if (row.auto_transliterate_description && row.description.length > 0) {
      jobs.push(row.description);
      slots.push({ index, field: 'description' });
    }
  });

  const translated = jobs.length > 0 ? await transliterate_list(jobs, script_id) : null;
  const title_out: Array<string | null> = rows.map(() => null);
  const description_out: Array<string | null> = rows.map(() => null);

  if (translated) {
    slots.forEach((slot, job_index) => {
      const value = translated[job_index];
      const source =
        slot.field === 'title' ? rows[slot.index]!.title : rows[slot.index]!.description;
      if (value == null || value === source) return;
      if (slot.field === 'title') title_out[slot.index] = value;
      else description_out[slot.index] = value;
    });
  }

  return rows.map((row, index) => ({
    ...row,
    title_transliterated: title_out[index] ?? null,
    description_transliterated: description_out[index] ?? null
  }));
}
