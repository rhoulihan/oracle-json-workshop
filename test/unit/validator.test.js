import { describe, it, expect, vi } from 'vitest';
import { Validator } from '../../src/services/validator.js';

function mockConnection(result) {
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

function mockConnectionError(err) {
  return {
    execute: vi.fn().mockRejectedValue(err),
  };
}

describe('Validator', () => {
  describe('pattern parsing', () => {
    it('parses rowCount:>0', () => {
      const v = new Validator();
      const parsed = v.parsePattern('rowCount:>0');
      expect(parsed).toEqual({ type: 'rowCount', op: '>', value: 0 });
    });

    it('parses rowCount:3', () => {
      const v = new Validator();
      const parsed = v.parsePattern('rowCount:3');
      expect(parsed).toEqual({ type: 'rowCount', op: '=', value: 3 });
    });

    it('parses rowCount:>=5', () => {
      const v = new Validator();
      const parsed = v.parsePattern('rowCount:>=5');
      expect(parsed).toEqual({ type: 'rowCount', op: '>=', value: 5 });
    });

    it('parses exact:{RESULT:1}', () => {
      const v = new Validator();
      const parsed = v.parsePattern('exact:{"RESULT":1}');
      expect(parsed).toEqual({ type: 'exact', expected: { RESULT: 1 } });
    });

    it('parses contains:dividend', () => {
      const v = new Validator();
      const parsed = v.parsePattern('contains:dividend');
      expect(parsed).toEqual({ type: 'contains', value: 'dividend' });
    });

    it('parses columnExists:COLUMN_NAME', () => {
      const v = new Validator();
      const parsed = v.parsePattern('columnExists:ACTION_ITEM');
      expect(parsed).toEqual({ type: 'columnExists', column: 'ACTION_ITEM' });
    });

    it('returns null for unknown patterns', () => {
      const v = new Validator();
      expect(v.parsePattern('unknown:foo')).toBeNull();
      expect(v.parsePattern('')).toBeNull();
    });
  });

  describe('validate', () => {
    it('validates rowCount:>0 with matching rows', async () => {
      const conn = mockConnection({
        rows: [{ X: 1 }, { X: 2 }],
        metaData: [{ name: 'X' }],
      });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT 1 FROM dual', 'rowCount:>0');

      expect(result.valid).toBe(true);
      expect(result.message).toMatch(/2.*row/i);
    });

    it('fails rowCount:>0 with zero rows', async () => {
      const conn = mockConnection({ rows: [], metaData: [{ name: 'X' }] });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT 1 FROM dual WHERE 1=0', 'rowCount:>0');

      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/expected.*>.*0/i);
    });

    it('validates exact row count', async () => {
      const conn = mockConnection({
        rows: [{ X: 1 }, { X: 2 }, { X: 3 }],
        metaData: [{ name: 'X' }],
      });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT 1 FROM dual', 'rowCount:3');

      expect(result.valid).toBe(true);
    });

    it('fails exact row count mismatch', async () => {
      const conn = mockConnection({
        rows: [{ X: 1 }],
        metaData: [{ name: 'X' }],
      });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT 1 FROM dual', 'rowCount:3');

      expect(result.valid).toBe(false);
    });

    it('validates exact match on first row', async () => {
      const conn = mockConnection({
        rows: [{ RESULT: 1 }],
        metaData: [{ name: 'RESULT' }],
      });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT 1 AS result FROM dual', 'exact:{"RESULT":1}');

      expect(result.valid).toBe(true);
    });

    it('fails exact match when values differ', async () => {
      const conn = mockConnection({
        rows: [{ RESULT: 42 }],
        metaData: [{ name: 'RESULT' }],
      });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT 42 AS result FROM dual', 'exact:{"RESULT":1}');

      expect(result.valid).toBe(false);
    });

    it('validates contains when value found in any row', async () => {
      const conn = mockConnection({
        rows: [{ TAG: 'growth' }, { TAG: 'dividend' }, { TAG: 'value' }],
        metaData: [{ name: 'TAG' }],
      });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT tag FROM tags', 'contains:dividend');

      expect(result.valid).toBe(true);
    });

    it('fails contains when value not found', async () => {
      const conn = mockConnection({
        rows: [{ TAG: 'growth' }, { TAG: 'value' }],
        metaData: [{ name: 'TAG' }],
      });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT tag FROM tags', 'contains:dividend');

      expect(result.valid).toBe(false);
    });

    it('validates columnExists when column present', async () => {
      const conn = mockConnection({
        rows: [{ ACTION_ITEM: 'review' }],
        metaData: [{ name: 'ACTION_ITEM' }],
      });
      const v = new Validator();
      const result = await v.validate(
        conn,
        'SELECT action_item FROM t',
        'columnExists:ACTION_ITEM',
      );

      expect(result.valid).toBe(true);
    });

    it('fails columnExists when column missing', async () => {
      const conn = mockConnection({
        rows: [{ NAME: 'Alice' }],
        metaData: [{ name: 'NAME' }],
      });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT name FROM t', 'columnExists:ACTION_ITEM');

      expect(result.valid).toBe(false);
    });

    it('returns error result when query fails', async () => {
      const conn = mockConnectionError(new Error('ORA-00942: table does not exist'));
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT * FROM missing', 'rowCount:>0');

      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/ORA-00942/);
    });

    it('returns error for invalid pattern', async () => {
      const conn = mockConnection({ rows: [], metaData: [] });
      const v = new Validator();
      const result = await v.validate(conn, 'SELECT 1 FROM dual', 'badpattern');

      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/invalid.*pattern/i);
    });
  });
});
