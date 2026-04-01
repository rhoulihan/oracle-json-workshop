import { describe, it, expect } from 'vitest';
import { splitStatements } from '../../../public/js/sql-splitter.js';

describe('splitStatements', () => {
  it('returns single statement as-is', () => {
    expect(splitStatements('SELECT 1 FROM dual')).toEqual(['SELECT 1 FROM dual']);
  });

  it('splits on semicolons', () => {
    const result = splitStatements('SELECT 1 FROM dual;\nSELECT 2 FROM dual');
    expect(result).toEqual(['SELECT 1 FROM dual', 'SELECT 2 FROM dual']);
  });

  it('handles trailing semicolons', () => {
    expect(splitStatements('SELECT 1 FROM dual;')).toEqual(['SELECT 1 FROM dual']);
  });

  it('does not split on semicolons inside string literals', () => {
    const result = splitStatements("SELECT * FROM t WHERE name = 'a;b;c'");
    expect(result).toEqual(["SELECT * FROM t WHERE name = 'a;b;c'"]);
  });

  it('strips line comments', () => {
    const sql = '-- This is a comment\nSELECT 1 FROM dual';
    expect(splitStatements(sql)).toEqual(['SELECT 1 FROM dual']);
  });

  it('strips block comments', () => {
    const sql = '/* comment */ SELECT 1 FROM dual';
    expect(splitStatements(sql)).toEqual(['SELECT 1 FROM dual']);
  });

  it('handles COMMIT as separate statement', () => {
    const sql = 'INSERT INTO t VALUES (1);\nCOMMIT;\nSELECT * FROM t';
    const result = splitStatements(sql);
    expect(result).toEqual(['INSERT INTO t VALUES (1)', 'COMMIT', 'SELECT * FROM t']);
  });

  it('strips empty statements', () => {
    const sql = 'SELECT 1;;\n;\nSELECT 2';
    const result = splitStatements(sql);
    expect(result).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('handles multi-line statements', () => {
    const sql = 'SELECT a,\n       b,\n       c\nFROM t\nWHERE x = 1';
    expect(splitStatements(sql)).toEqual(['SELECT a,\n       b,\n       c\nFROM t\nWHERE x = 1']);
  });

  it('returns empty array for empty input', () => {
    expect(splitStatements('')).toEqual([]);
    expect(splitStatements('   ')).toEqual([]);
    expect(splitStatements('-- just a comment')).toEqual([]);
  });
});
