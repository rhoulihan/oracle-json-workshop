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

  it('multi-value index returns results for tag queries', async () => {
    // Verify that a tag query actually returns data (index is functional)
    const result = await execute(
      `SELECT COUNT(*) AS cnt FROM advisory_entities ae
       WHERE JSON_EXISTS(ae.data, '$.data.tags?(@ == "dividend")')
       AND JSON_VALUE(ae.data, '$.entityType') = 'holding'`,
    );
    expect(result.rows[0].CNT).toBeGreaterThan(0);
  });
});
