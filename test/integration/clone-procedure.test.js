import { describe, it, expect, afterAll, afterEach } from 'vitest';
import oracledb from 'oracledb';
import { execute, getConnection, closePool } from './setup.js';

const TEST_USER = 'WS_TEST_CLONE';
const TEST_PASS = 'CloneTest2026';
const CONNECT_STRING = process.env.DB_CONNECT_STRING || 'localhost:1521/FREEPDB1';

afterAll(() => closePool());

describe('clone_schema procedure', () => {
  // Clean up test user after each test
  afterEach(async () => {
    const conn = await getConnection();
    try {
      await conn.execute(`BEGIN WORKSHOP_ADMIN.drop_workspace(:username); END;`, {
        username: TEST_USER,
      });
      await conn.commit();
    } catch {
      // User may not exist, ignore
    } finally {
      await conn.close();
    }
  });

  it('clone_schema procedure exists', async () => {
    const result = await execute(
      `SELECT object_name FROM user_procedures WHERE object_name = 'CLONE_SCHEMA'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('drop_workspace procedure exists', async () => {
    const result = await execute(
      `SELECT object_name FROM user_procedures WHERE object_name = 'DROP_WORKSPACE'`,
    );
    expect(result.rows).toHaveLength(1);
  });

  it('creates a new schema with all tables and data', async () => {
    // Clone schema
    const conn = await getConnection();
    try {
      await conn.execute(`BEGIN WORKSHOP_ADMIN.clone_schema(:username, :password); END;`, {
        username: TEST_USER,
        password: TEST_PASS,
      });
      await conn.commit();
    } finally {
      await conn.close();
    }

    // Connect as new user and verify tables exist
    const userConn = await oracledb.getConnection({
      user: TEST_USER,
      password: TEST_PASS,
      connectString: CONNECT_STRING,
    });

    try {
      const tables = await userConn.execute(
        `SELECT table_name FROM user_tables ORDER BY table_name`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const tableNames = tables.rows.map((r) => r.TABLE_NAME);

      expect(tableNames).toEqual(
        expect.arrayContaining([
          'ACCOUNTS',
          'ADVISOR_CLIENT_MAP',
          'ADVISORS',
          'CLIENTS',
          'HOLDINGS',
          'TRANSACTIONS',
        ]),
      );

      // Verify data was copied
      const advisorCount = await userConn.execute(`SELECT COUNT(*) AS cnt FROM advisors`, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      expect(advisorCount.rows[0].CNT).toBe(20);

      // Verify duality views exist
      const dvs = await userConn.execute(
        `SELECT view_name FROM user_json_duality_views ORDER BY view_name`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const dvNames = dvs.rows.map((r) => r.VIEW_NAME);
      expect(dvNames).toEqual(
        expect.arrayContaining(['ADVISOR_BOOK_DV', 'CLIENT_PORTFOLIO_DV', 'TRANSACTION_FEED_DV']),
      );

      // Verify duality view returns data
      const dvResult = await userConn.execute(
        `SELECT data FROM client_portfolio_dv FETCH FIRST 1 ROWS ONLY`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      expect(dvResult.rows).toHaveLength(1);
      expect(dvResult.rows[0].DATA).toHaveProperty('firstName');
    } finally {
      await userConn.close();
    }
  });

  it('records workspace in workshop_users table', async () => {
    const conn = await getConnection();
    try {
      await conn.execute(`BEGIN WORKSHOP_ADMIN.clone_schema(:username, :password); END;`, {
        username: TEST_USER,
        password: TEST_PASS,
      });
      await conn.commit();
    } finally {
      await conn.close();
    }

    const result = await execute(
      `SELECT schema_name, status FROM workshop_users WHERE schema_name = :name`,
      [TEST_USER],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].STATUS).toBe('active');
  });

  it('drop_workspace removes the schema', async () => {
    // Create first
    const conn = await getConnection();
    try {
      await conn.execute(`BEGIN WORKSHOP_ADMIN.clone_schema(:username, :password); END;`, {
        username: TEST_USER,
        password: TEST_PASS,
      });
      await conn.commit();
    } finally {
      await conn.close();
    }

    // Drop
    const conn2 = await getConnection();
    try {
      await conn2.execute(`BEGIN WORKSHOP_ADMIN.drop_workspace(:username); END;`, {
        username: TEST_USER,
      });
      await conn2.commit();
    } finally {
      await conn2.close();
    }

    // Verify user is gone from workshop_users
    const result = await execute(
      `SELECT COUNT(*) AS cnt FROM workshop_users WHERE schema_name = :name`,
      [TEST_USER],
    );
    expect(result.rows[0].CNT).toBe(0);
  });
});
