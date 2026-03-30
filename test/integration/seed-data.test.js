import { describe, it, expect, afterAll } from 'vitest';
import { execute, closePool } from './setup.js';

afterAll(() => closePool());

describe('seed data', () => {
  it('has 20 advisors', async () => {
    const result = await execute(`SELECT COUNT(*) AS cnt FROM advisors`);
    expect(result.rows[0].CNT).toBe(20);
  });

  it('has 200 clients', async () => {
    const result = await execute(`SELECT COUNT(*) AS cnt FROM clients`);
    expect(result.rows[0].CNT).toBe(200);
  });

  it('has 500 accounts', async () => {
    const result = await execute(`SELECT COUNT(*) AS cnt FROM accounts`);
    expect(result.rows[0].CNT).toBe(500);
  });

  it('has 2000 holdings', async () => {
    const result = await execute(`SELECT COUNT(*) AS cnt FROM holdings`);
    expect(result.rows[0].CNT).toBe(2000);
  });

  it('has 300 advisor-client mappings', async () => {
    const result = await execute(`SELECT COUNT(*) AS cnt FROM advisor_client_map`);
    expect(result.rows[0].CNT).toBe(300);
  });

  it('has 5000 transactions', async () => {
    const result = await execute(`SELECT COUNT(*) AS cnt FROM transactions`);
    expect(result.rows[0].CNT).toBe(5000);
  });

  it('has 500 client_interactions documents', async () => {
    const result = await execute(`SELECT COUNT(*) AS cnt FROM client_interactions`);
    expect(result.rows[0].CNT).toBe(500);
  });

  it('has 3000 advisory_entities documents', async () => {
    const result = await execute(`SELECT COUNT(*) AS cnt FROM advisory_entities`);
    expect(result.rows[0].CNT).toBe(3000);
  });

  it('advisors span 4 regions', async () => {
    const result = await execute(`SELECT COUNT(DISTINCT region) AS cnt FROM advisors`);
    expect(result.rows[0].CNT).toBe(4);
  });

  it('clients have all 3 risk profiles', async () => {
    const result = await execute(`SELECT COUNT(DISTINCT risk_profile) AS cnt FROM clients`);
    expect(result.rows[0].CNT).toBe(3);
  });

  it('advisory_entities has 4 entity types', async () => {
    const result = await execute(
      `SELECT COUNT(DISTINCT ae.data.entityType.string()) AS cnt FROM advisory_entities ae`,
    );
    expect(result.rows[0].CNT).toBe(4);
  });

  it('holdings in advisory_entities have tags arrays', async () => {
    const result = await execute(
      `SELECT COUNT(*) AS cnt FROM advisory_entities ae
       WHERE ae.data.entityType.string() = 'holding'
       AND JSON_EXISTS(ae.data, '$.data.tags[0]')`,
    );
    expect(result.rows[0].CNT).toBeGreaterThan(0);
  });

  it('holdings in advisory_entities have sectors arrays', async () => {
    const result = await execute(
      `SELECT COUNT(*) AS cnt FROM advisory_entities ae
       WHERE ae.data.entityType.string() = 'holding'
       AND JSON_EXISTS(ae.data, '$.data.sectors[0]')`,
    );
    expect(result.rows[0].CNT).toBeGreaterThan(0);
  });
});
