import { describe, it, expect } from 'vitest';
import { classifySQL } from '../../src/middleware/security.js';

describe('classifySQL', () => {
  describe('allowed statements', () => {
    it('allows SELECT', () => {
      expect(classifySQL('SELECT * FROM employees')).toEqual({ allowed: true });
    });

    it('allows INSERT', () => {
      expect(classifySQL('INSERT INTO employees (name) VALUES (:1)')).toEqual({ allowed: true });
    });

    it('allows UPDATE', () => {
      expect(classifySQL('UPDATE employees SET name = :1 WHERE id = :2')).toEqual({
        allowed: true,
      });
    });

    it('allows DELETE', () => {
      expect(classifySQL('DELETE FROM employees WHERE id = :1')).toEqual({ allowed: true });
    });

    it('allows EXPLAIN PLAN FOR', () => {
      expect(classifySQL('EXPLAIN PLAN FOR SELECT * FROM employees')).toEqual({ allowed: true });
    });

    it('allows CREATE TABLE', () => {
      expect(classifySQL('CREATE TABLE my_table (id NUMBER)')).toEqual({ allowed: true });
    });

    it('allows CREATE INDEX', () => {
      expect(classifySQL('CREATE INDEX idx_name ON employees(name)')).toEqual({ allowed: true });
    });

    it('allows DROP TABLE', () => {
      expect(classifySQL('DROP TABLE my_table')).toEqual({ allowed: true });
    });

    it('allows ALTER TABLE', () => {
      expect(classifySQL('ALTER TABLE my_table ADD (col VARCHAR2(100))')).toEqual({
        allowed: true,
      });
    });

    it('allows whitelisted CTX_DDL.SYNC_INDEX', () => {
      expect(classifySQL("BEGIN CTX_DDL.SYNC_INDEX('my_idx'); END;")).toEqual({ allowed: true });
    });
  });

  describe('blocked statements', () => {
    it('blocks DROP USER', () => {
      const result = classifySQL('DROP USER some_user CASCADE');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/DROP USER/i);
    });

    it('blocks ALTER SYSTEM', () => {
      const result = classifySQL('ALTER SYSTEM SET open_cursors=500');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/ALTER SYSTEM/i);
    });

    it('blocks CREATE DIRECTORY', () => {
      const result = classifySQL("CREATE DIRECTORY ext_dir AS '/tmp'");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/CREATE DIRECTORY/i);
    });

    it('blocks GRANT ... TO', () => {
      const result = classifySQL('GRANT DBA TO hacker');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/GRANT/i);
    });

    it('blocks CREATE USER', () => {
      const result = classifySQL('CREATE USER hacker IDENTIFIED BY pass123');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/CREATE USER/i);
    });

    it('blocks PL/SQL BEGIN blocks', () => {
      const result = classifySQL("BEGIN EXECUTE IMMEDIATE 'DROP USER x'; END;");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/PL\/SQL/i);
    });

    it('blocks DECLARE blocks', () => {
      const result = classifySQL('DECLARE v_x NUMBER; BEGIN NULL; END;');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/PL\/SQL/i);
    });

    it('blocks TRUNCATE TABLE', () => {
      const result = classifySQL('TRUNCATE TABLE employees');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/TRUNCATE/i);
    });
  });

  describe('edge cases', () => {
    it('blocks mixed case DrOp UsEr', () => {
      const result = classifySQL('DrOp UsEr some_user');
      expect(result.allowed).toBe(false);
    });

    it('blocks SQL hidden in comments: /* DROP USER */ SELECT 1', () => {
      const result = classifySQL('/* DROP USER foo */ SELECT 1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/suspicious/i);
    });

    it('allows DROP USER inside a string literal', () => {
      const result = classifySQL("SELECT * FROM users WHERE name = 'DROP USER'");
      expect(result.allowed).toBe(true);
    });

    it('blocks multiple statements with semicolons', () => {
      const result = classifySQL('SELECT 1; DROP USER foo');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/multiple/i);
    });

    it('blocks empty SQL', () => {
      const result = classifySQL('');
      expect(result.allowed).toBe(false);
    });

    it('blocks null/undefined SQL', () => {
      expect(classifySQL(null).allowed).toBe(false);
      expect(classifySQL(undefined).allowed).toBe(false);
    });

    it('allows SQL with string containing semicolons', () => {
      const result = classifySQL("SELECT * FROM t WHERE name = 'a;b;c'");
      expect(result.allowed).toBe(true);
    });

    it('blocks REVOKE', () => {
      const result = classifySQL('REVOKE DBA FROM user1');
      expect(result.allowed).toBe(false);
    });
  });
});
