import { nanoid } from 'nanoid';
import type { TxOrDb } from '~/effect/database';

/**
 * Length of the universally unique ids assigned to projects and lekhas.
 * Capped at 5 chars for now — short and URL-friendly.
 */
export const UID_LENGTH = 5;

/** Generation attempts before giving up (collision space is ~1B at length 5; exhaustion is unexpected). */
const UID_MAX_ATTEMPTS = 10;

/**
 * Generates a universally unique id shared across `projects` and `site_lekhas`.
 *
 * Universality facts (nano-id):
 * - Default URL-safe alphabet (`A-Za-z0-9_-`), so uids are safe to embed in URLs as-is.
 * - At length 5 the collision space is 64^5 (~1 billion); every candidate is checked against
 *   BOTH tables before use, so cross-table uniqueness holds regardless of randomness odds.
 * - A per-table DB `UNIQUE` constraint backs each `uid` column; the cross-table half is
 *   app-enforced here (a single DB constraint cannot span two tables).
 *
 * Run inside the creation transaction so the check-and-insert stays atomic.
 */
export async function generateUniqueUid(db: TxOrDb): Promise<string> {
  for (let attempt = 0; attempt < UID_MAX_ATTEMPTS; attempt++) {
    const uid = nanoid(UID_LENGTH);
    const [project_hit, lekha_hit] = await Promise.all([
      db.query.projects.findFirst({
        where: (tbl, { eq: eqUid }) => eqUid(tbl.uid, uid),
        columns: { id: true }
      }),
      db.query.site_lekhas.findFirst({
        where: (tbl, { eq: eqUid }) => eqUid(tbl.uid, uid),
        columns: { id: true }
      })
    ]);
    if (!project_hit && !lekha_hit) return uid;
  }
  throw new Error(`Failed to generate a unique uid after ${UID_MAX_ATTEMPTS} attempts`);
}
