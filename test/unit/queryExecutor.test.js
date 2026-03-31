import { describe, it, expect, vi } from 'vitest';
import { QueryExecutor } from '../../src/services/queryExecutor.js';

function mockConnection(result, error) {
  return {
    execute: error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue(result),
  };
}

describe('QueryExecutor', () => {
  it('returns rows, columns, rowCount, duration, and resultType for tabular data', async () => {
    const conn = mockConnection({
      rows: [{ ID: 1, NAME: 'Alice' }],
      metaData: [{ name: 'ID' }, { name: 'NAME' }],
    });
    const executor = new QueryExecutor();
    const result = await executor.execute(conn, 'SELECT * FROM employees');

    expect(result.rows).toEqual([{ ID: 1, NAME: 'Alice' }]);
    expect(result.columns).toEqual(['ID', 'NAME']);
    expect(result.rowCount).toBe(1);
    expect(result.resultType).toBe('tabular');
    expect(typeof result.duration).toBe('number');
  });

  it('detects JSON result type when DATA column contains objects', async () => {
    const conn = mockConnection({
      rows: [{ DATA: { name: 'Alice' } }],
      metaData: [{ name: 'DATA' }],
    });
    const executor = new QueryExecutor();
    const result = await executor.execute(conn, 'SELECT data FROM products');

    expect(result.resultType).toBe('json');
  });

  it('limits rows to maxRows (default 1000)', async () => {
    const manyRows = Array.from({ length: 1500 }, (_, i) => ({ ID: i }));
    const conn = mockConnection({
      rows: manyRows,
      metaData: [{ name: 'ID' }],
    });
    const executor = new QueryExecutor();
    const result = await executor.execute(conn, 'SELECT id FROM big_table');

    expect(result.rows.length).toBeLessThanOrEqual(1000);
    expect(result.rowCount).toBe(1000);
  });

  it('passes timeout option to connection.execute', async () => {
    const conn = mockConnection({ rows: [], metaData: [] });
    const executor = new QueryExecutor({ timeout: 15000 });
    await executor.execute(conn, 'SELECT 1 FROM dual');

    expect(conn.execute).toHaveBeenCalledWith(
      'SELECT 1 FROM dual',
      [],
      expect.objectContaining({ callTimeout: 15000 }),
    );
  });

  it('handles errors gracefully without throwing', async () => {
    const conn = mockConnection(null, new Error('ORA-00942: table or view does not exist'));
    const executor = new QueryExecutor();
    const result = await executor.execute(conn, 'SELECT * FROM nonexistent');

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/ORA-00942/);
    expect(result.rows).toBeUndefined();
  });

  it('handles DML statements (no rows returned)', async () => {
    const conn = mockConnection({
      rowsAffected: 3,
      metaData: undefined,
      rows: undefined,
    });
    const executor = new QueryExecutor();
    const result = await executor.execute(conn, 'UPDATE employees SET name = :1');

    expect(result.rowsAffected).toBe(3);
    expect(result.resultType).toBe('dml');
  });

  it('uses default 30s timeout', async () => {
    const conn = mockConnection({ rows: [], metaData: [] });
    const executor = new QueryExecutor();
    await executor.execute(conn, 'SELECT 1 FROM dual');

    expect(conn.execute).toHaveBeenCalledWith(
      'SELECT 1 FROM dual',
      [],
      expect.objectContaining({ callTimeout: 30000 }),
    );
  });
});
