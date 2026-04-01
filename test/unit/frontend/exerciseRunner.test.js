import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runExercise } from '../../../public/js/exercise-runner.js';

describe('runExercise', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            rows: [{ X: 1 }],
            columns: ['X'],
            rowCount: 1,
            duration: 5,
            resultType: 'tabular',
          }),
      }),
    );
  });

  it('executes single SQL statement', async () => {
    const result = await runExercise('sql', 'SELECT 1 FROM dual');
    expect(result.results).toHaveLength(1);
    expect(result.finalResult.rows).toBeDefined();
  });

  it('executes multiple SQL statements sequentially', async () => {
    let callCount = 0;
    fetch.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            rows: [{ N: callCount }],
            columns: ['N'],
            rowCount: 1,
            duration: 3,
            resultType: 'tabular',
          }),
      });
    });

    const result = await runExercise('sql', 'INSERT INTO t VALUES (1);\nCOMMIT;\nSELECT * FROM t');
    expect(result.results).toHaveLength(3);
    expect(result.finalResult.rows[0].N).toBe(3);
  });

  it('dispatches JS to executeJs', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ output: 42, logs: [], duration: 2 }),
    });
    const result = await runExercise('js', 'const x = 42; x');
    expect(fetch).toHaveBeenCalledWith(
      '/api/query/js',
      expect.objectContaining({ body: JSON.stringify({ code: 'const x = 42; x' }) }),
    );
    expect(result.finalResult.output).toBe(42);
  });

  it('dispatches mongo to executeMongo', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ documents: [], count: 0, duration: 1 }),
    });
    const result = await runExercise('mongo', 'show collections');
    expect(fetch).toHaveBeenCalledWith(
      '/api/query/mongo',
      expect.objectContaining({ body: JSON.stringify({ command: 'show collections' }) }),
    );
    expect(result.results).toHaveLength(1);
  });

  it('stops on error and returns partial results', async () => {
    let callCount = 0;
    fetch.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.resolve({
          ok: true,
          status: 500,
          json: () => Promise.resolve({ error: 'ORA-00942', duration: 1 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            rows: [],
            columns: [],
            rowCount: 0,
            duration: 1,
            resultType: 'tabular',
          }),
      });
    });

    const result = await runExercise('sql', 'SELECT 1;\nSELECT bad;\nSELECT 3');
    expect(result.error).toBe('ORA-00942');
    expect(result.results).toHaveLength(2); // first succeeded, second errored, third skipped
  });

  it('returns total duration', async () => {
    const result = await runExercise('sql', 'SELECT 1 FROM dual');
    expect(typeof result.totalDuration).toBe('number');
  });

  it('handles empty code', async () => {
    const result = await runExercise('sql', '');
    expect(result.results).toHaveLength(0);
    expect(result.finalResult).toBeNull();
  });
});
