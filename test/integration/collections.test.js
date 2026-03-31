import { describe, it, expect, afterAll } from 'vitest';
import { execute, closePool } from './setup.js';

afterAll(() => closePool());

describe('JSON collections', () => {
  it('client_interactions collection table exists', async () => {
    const result = await execute(
      `SELECT collection_name FROM user_json_collection_tables WHERE collection_name = :name`,
      ['CLIENT_INTERACTIONS'],
    );
    expect(result.rows).toHaveLength(1);
  });

  it('advisory_entities collection table exists', async () => {
    const result = await execute(
      `SELECT collection_name FROM user_json_collection_tables WHERE collection_name = :name`,
      ['ADVISORY_ENTITIES'],
    );
    expect(result.rows).toHaveLength(1);
  });

  it('can insert and query client_interactions', async () => {
    await execute(
      `INSERT INTO client_interactions (data) VALUES (JSON('{"client_id":99999,"advisor_id":99999,"type":"test","summary":"Integration test"}'))`,
    );

    // Sync the JSON search index so the new document is immediately queryable
    await execute(`BEGIN CTX_DDL.SYNC_INDEX('IDX_INTERACTIONS_SEARCH'); END;`);

    const result = await execute(
      `SELECT json_serialize(data) AS doc FROM client_interactions ci
       WHERE ci.data.client_id = 99999`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);

    // Clean up
    await execute(`DELETE FROM client_interactions ci WHERE ci.data.client_id = 99999`);
    await execute(`BEGIN CTX_DDL.SYNC_INDEX('IDX_INTERACTIONS_SEARCH'); END;`);
  });

  it('can insert and query advisory_entities', async () => {
    await execute(
      `INSERT INTO advisory_entities (data) VALUES (JSON('{"pk":"TEST#99999","sk":"PROFILE","entityType":"test","data":{"name":"Integration test"}}'))`,
    );

    const result = await execute(
      `SELECT json_serialize(data) AS doc FROM advisory_entities ae
       WHERE ae.data.pk = 'TEST#99999'`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);

    // Clean up
    await execute(`DELETE FROM advisory_entities ae WHERE ae.data.pk = 'TEST#99999'`);
  });
});
