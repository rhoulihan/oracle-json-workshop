import { describe, it, expect, afterAll } from 'vitest';
import { execute, closePool } from './setup.js';

afterAll(() => closePool());

describe('JSON collections', () => {
  it('client_interactions collection table exists', async () => {
    const result = await execute(
      `SELECT table_name FROM user_json_collection_tables WHERE table_name = 'CLIENT_INTERACTIONS'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('advisory_entities collection table exists', async () => {
    const result = await execute(
      `SELECT table_name FROM user_json_collection_tables WHERE table_name = 'ADVISORY_ENTITIES'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('can insert and query client_interactions', async () => {
    const doc = JSON.stringify({
      client_id: 99999,
      advisor_id: 99999,
      type: 'test',
      summary: 'Integration test document',
    });

    await execute(`INSERT INTO client_interactions (data) VALUES (:doc)`, [doc]);

    const result = await execute(
      `SELECT json_serialize(data PRETTY) AS doc FROM client_interactions ci
       WHERE ci.data.client_id.number() = 99999`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);

    // Clean up
    await execute(`DELETE FROM client_interactions ci WHERE ci.data.client_id.number() = 99999`);
    await execute(`COMMIT`);
  });

  it('can insert and query advisory_entities', async () => {
    const doc = JSON.stringify({
      pk: 'TEST#99999',
      sk: 'PROFILE',
      entityType: 'test',
      data: { name: 'Integration test' },
    });

    await execute(`INSERT INTO advisory_entities (data) VALUES (:doc)`, [doc]);

    const result = await execute(
      `SELECT json_serialize(data PRETTY) AS doc FROM advisory_entities ae
       WHERE ae.data.pk.string() = 'TEST#99999'`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);

    // Clean up
    await execute(`DELETE FROM advisory_entities ae WHERE ae.data.pk.string() = 'TEST#99999'`);
    await execute(`COMMIT`);
  });
});
