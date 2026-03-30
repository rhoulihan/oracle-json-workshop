import { describe, it, expect, afterAll } from 'vitest';
import { execute, closePool } from './setup.js';

afterAll(() => closePool());

describe('indexes', () => {
  it('pk_sk functional index exists on advisory_entities', async () => {
    const result = await execute(
      `SELECT index_name FROM user_indexes
       WHERE table_name = 'ADVISORY_ENTITIES' AND index_name = 'IDX_PK_SK'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('gsi1 functional index exists on advisory_entities', async () => {
    const result = await execute(
      `SELECT index_name FROM user_indexes
       WHERE table_name = 'ADVISORY_ENTITIES' AND index_name = 'IDX_GSI1'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('multi-value index on tags exists', async () => {
    const result = await execute(
      `SELECT index_name FROM user_indexes
       WHERE table_name = 'ADVISORY_ENTITIES' AND index_name = 'IDX_TAGS'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('multi-value index on sectors exists', async () => {
    const result = await execute(
      `SELECT index_name FROM user_indexes
       WHERE table_name = 'ADVISORY_ENTITIES' AND index_name = 'IDX_SECTORS'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('search index on client_interactions exists', async () => {
    const result = await execute(
      `SELECT index_name FROM user_indexes
       WHERE table_name = 'CLIENT_INTERACTIONS' AND index_name = 'IDX_INTERACTIONS_SEARCH'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('multi-value index is used for tag queries', async () => {
    await execute(
      `EXPLAIN PLAN FOR
       SELECT data FROM advisory_entities ae
       WHERE JSON_EXISTS(ae.data, '$.data.tags?(@ == "dividend")')`,
    );

    const plan = await execute(
      `SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', NULL, 'BASIC'))`,
    );
    const planText = plan.rows.map((r) => r.PLAN_TABLE_OUTPUT).join('\n');
    // Index should appear in the plan (not a full table scan)
    expect(planText).toMatch(/IDX_TAGS|INDEX/i);
  });
});
