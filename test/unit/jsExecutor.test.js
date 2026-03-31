import { describe, it, expect, vi } from 'vitest';
import { JsExecutor } from '../../src/services/jsExecutor.js';

describe('JsExecutor', () => {
  it('executes simple JavaScript and returns output', async () => {
    const executor = new JsExecutor();
    const result = await executor.execute('const x = 1 + 2; x;');

    expect(result.output).toBe(3);
    expect(result.error).toBeUndefined();
    expect(typeof result.duration).toBe('number');
  });

  it('captures console.log output', async () => {
    const executor = new JsExecutor();
    const result = await executor.execute('console.log("hello"); console.log("world");');

    expect(result.logs).toEqual(['hello', 'world']);
  });

  it('injects connection into sandbox', async () => {
    const mockConn = {
      execute: vi.fn().mockResolvedValue({ rows: [{ ID: 1 }] }),
    };
    const executor = new JsExecutor();
    const result = await executor.execute(
      'const r = await connection.execute("SELECT 1 FROM dual"); r;',
      { connection: mockConn },
    );

    expect(mockConn.execute).toHaveBeenCalled();
    expect(result.output).toEqual({ rows: [{ ID: 1 }] });
  });

  it('injects oracledb into sandbox', async () => {
    const mockOracledb = { OUT_FORMAT_OBJECT: 4001 };
    const executor = new JsExecutor();
    const result = await executor.execute('oracledb.OUT_FORMAT_OBJECT;', {
      oracledb: mockOracledb,
    });

    expect(result.output).toBe(4001);
  });

  it('blocks require', async () => {
    const executor = new JsExecutor();
    const result = await executor.execute('require("fs")');

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/require.*not.*defined|not a function|not allowed/i);
  });

  it('blocks process access', async () => {
    const executor = new JsExecutor();
    const result = await executor.execute('process.exit(1)');

    expect(result.error).toBeTruthy();
  });

  it('returns error for syntax errors', async () => {
    const executor = new JsExecutor();
    const result = await executor.execute('function {{{');

    expect(result.error).toBeTruthy();
  });

  it('returns error for runtime exceptions', async () => {
    const executor = new JsExecutor();
    const result = await executor.execute('throw new Error("boom")');

    expect(result.error).toMatch(/boom/);
  });

  it('blocks import expressions in code', async () => {
    const executor = new JsExecutor();
    const result = await executor.execute('const fs = await import("fs")');

    expect(result.error).toBeTruthy();
  });

  it('handles timeout', async () => {
    const executor = new JsExecutor({ timeout: 100 });
    const result = await executor.execute('while(true) {}');

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/timed?\s*out|execution time/i);
  });
});
