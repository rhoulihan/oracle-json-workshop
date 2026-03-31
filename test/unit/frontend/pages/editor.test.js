import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeQuery, renderResult } from '../../../../public/js/pages/editor.js';

describe('editor page', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }),
    );
  });

  describe('executeQuery', () => {
    it('calls executeSql for sql tab', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            rows: [{ ID: 1 }],
            columns: ['ID'],
            rowCount: 1,
            duration: 5,
            resultType: 'tabular',
          }),
      });
      const result = await executeQuery('sql', 'SELECT 1 FROM dual');
      expect(fetch).toHaveBeenCalledWith(
        '/api/query/sql',
        expect.objectContaining({ body: JSON.stringify({ sql: 'SELECT 1 FROM dual' }) }),
      );
      expect(result.rows).toBeDefined();
    });

    it('calls executeJs for js tab', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ output: 42, logs: [], duration: 3 }),
      });
      await executeQuery('js', 'const x = 42; x');
      expect(fetch).toHaveBeenCalledWith(
        '/api/query/js',
        expect.objectContaining({ body: JSON.stringify({ code: 'const x = 42; x' }) }),
      );
    });

    it('calls executeMongo for mongo tab', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ documents: [], count: 0, duration: 1 }),
      });
      await executeQuery('mongo', 'show collections');
      expect(fetch).toHaveBeenCalledWith(
        '/api/query/mongo',
        expect.objectContaining({ body: JSON.stringify({ command: 'show collections' }) }),
      );
    });
  });

  describe('renderResult', () => {
    it('returns table element for tabular results', () => {
      const el = renderResult({
        rows: [{ ID: 1 }],
        columns: ['ID'],
        rowCount: 1,
        duration: 5,
        resultType: 'tabular',
      });
      expect(el.querySelector('table')).toBeTruthy();
    });

    it('returns pre element for json results', () => {
      const el = renderResult({
        rows: [{ DATA: { name: 'Alice' } }],
        columns: ['DATA'],
        rowCount: 1,
        duration: 3,
        resultType: 'json',
      });
      expect(el.querySelector('pre')).toBeTruthy();
    });

    it('returns error div for error results', () => {
      const el = renderResult({ error: 'ORA-00942', duration: 1 });
      expect(el.querySelector('.error-message')).toBeTruthy();
    });

    it('returns dml message for dml results', () => {
      const el = renderResult({ rowsAffected: 3, duration: 2, resultType: 'dml' });
      expect(el.textContent).toContain('3');
    });
  });
});
