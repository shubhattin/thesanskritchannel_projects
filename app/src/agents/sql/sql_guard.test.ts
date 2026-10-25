import { describe, expect, it } from 'vitest';
import { guardSelectQuery } from './sql_guard';

const verdicts = (queries: string[]) =>
  Object.fromEntries(queries.map((query) => [query, guardSelectQuery(query).ok]));
const all = (queries: string[], ok: boolean) =>
  Object.fromEntries(queries.map((query) => [query, ok]));

describe('guardSelectQuery', () => {
  it('allows plain reads', () => {
    const queries = [
      'SELECT key, name FROM projects ORDER BY id',
      "select * from site_lekhas where published_at > now() - interval '7 days';",
      `WITH counts AS (SELECT project_id, count(*) n FROM project_paths GROUP BY 1)
      SELECT p.key, counts.n FROM counts JOIN projects p ON p.id = counts.project_id ORDER BY 2 DESC LIMIT 10`,
      "SELECT jsonb_path_query(map, 'strict $.**.name_dev') FROM projects OFFSET 5"
    ];
    expect(verdicts(queries)).toEqual(all(queries, true));
  });

  it('ignores keywords inside strings, quoted identifiers and comments', () => {
    const queries = [
      "SELECT title FROM site_lekhas WHERE title ILIKE '%delete; drop table%'",
      'SELECT 1 AS "update" -- insert into x\n',
      "SELECT 'it''s; fine' AS note"
    ];
    expect(verdicts(queries)).toEqual(all(queries, true));
  });

  it('does not trip on identifiers that contain blocked words', () => {
    const queries = [
      'SELECT updated_at, created_at, published_at FROM site_lekhas',
      "SELECT format('%s lines', count(*)) FROM texts"
    ];
    expect(verdicts(queries)).toEqual(all(queries, true));
  });

  it('blocks writes, DDL and multiple statements', () => {
    const queries = [
      'DELETE FROM projects',
      'UPDATE projects SET listed = true',
      'SELECT 1; DROP TABLE projects',
      'WITH d AS (DELETE FROM texts RETURNING *) SELECT * FROM d',
      'SELECT * INTO new_table FROM projects',
      'SELECT * FROM projects FOR UPDATE',
      'SELECT * FROM projects FOR SHARE',
      'SELECT * FROM projects FOR KEY SHARE',
      'CREATE TABLE x (id int)',
      'EXPLAIN ANALYZE SELECT 1'
    ];
    expect(verdicts(queries)).toEqual(all(queries, false));
  });

  it('blocks side-effect functions and session changes', () => {
    const queries = [
      'SELECT pg_sleep(10)',
      "SELECT set_config('statement_timeout', '0', false)",
      "SELECT nextval('projects_id_seq')",
      "SELECT pg_read_file('/etc/passwd')",
      "SELECT * FROM dblink('host=x', 'select 1') AS t(a int)"
    ];
    expect(verdicts(queries)).toEqual(all(queries, false));
  });

  it('rejects dollar quoting and unterminated input', () => {
    const queries = ['SELECT $$ delete $$', "SELECT 'open", 'SELECT 1 /* never closed'];
    expect(verdicts(queries)).toEqual(all(queries, false));
  });
});
