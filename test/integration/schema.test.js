import { describe, it, expect, afterAll } from 'vitest';
import { execute, closePool } from './setup.js';

afterAll(() => closePool());

describe('relational schema', () => {
  const EXPECTED_TABLES = [
    'ADVISORS',
    'CLIENTS',
    'ACCOUNTS',
    'HOLDINGS',
    'ADVISOR_CLIENT_MAP',
    'TRANSACTIONS',
  ];

  it.each(EXPECTED_TABLES)('table %s exists', async (tableName) => {
    const result = await execute(`SELECT table_name FROM user_tables WHERE table_name = :name`, [
      tableName,
    ]);
    expect(result.rows).toHaveLength(1);
  });

  it('advisors has correct columns', async () => {
    const result = await execute(
      `SELECT column_name FROM user_tab_columns WHERE table_name = 'ADVISORS' ORDER BY column_id`,
    );
    const cols = result.rows.map((r) => r.COLUMN_NAME);
    expect(cols).toEqual(
      expect.arrayContaining([
        'ADVISOR_ID',
        'FIRST_NAME',
        'LAST_NAME',
        'EMAIL',
        'LICENSE_TYPE',
        'REGION',
        'HIRE_DATE',
      ]),
    );
  });

  it('clients has risk_profile check constraint', async () => {
    const result = await execute(
      `SELECT constraint_name FROM user_constraints
       WHERE table_name = 'CLIENTS' AND constraint_type = 'C'
       AND search_condition_vc LIKE '%risk_profile%'`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('accounts references clients via FK', async () => {
    const result = await execute(
      `SELECT constraint_name FROM user_constraints
       WHERE table_name = 'ACCOUNTS' AND constraint_type = 'R'`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('holdings references accounts via FK', async () => {
    const result = await execute(
      `SELECT constraint_name FROM user_constraints
       WHERE table_name = 'HOLDINGS' AND constraint_type = 'R'`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('advisor_client_map has composite PK', async () => {
    const result = await execute(
      `SELECT constraint_name FROM user_constraints
       WHERE table_name = 'ADVISOR_CLIENT_MAP' AND constraint_type = 'P'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('transactions has notes column of JSON type', async () => {
    const result = await execute(
      `SELECT data_type FROM user_tab_columns
       WHERE table_name = 'TRANSACTIONS' AND column_name = 'NOTES'`,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].DATA_TYPE).toBe('JSON');
  });

  it('workshop_users table exists', async () => {
    const result = await execute(
      `SELECT table_name FROM user_tables WHERE table_name = 'WORKSHOP_USERS'`,
    );
    expect(result.rows).toHaveLength(1);
  });
});
