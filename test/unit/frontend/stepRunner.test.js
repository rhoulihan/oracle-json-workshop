import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepRunner } from '../../../public/js/step-runner.js';

describe('StepRunner', () => {
  const STEPS = [
    { label: 'View documents', code: 'SELECT * FROM t FETCH FIRST 3 ROWS ONLY' },
    { label: 'Count documents', code: 'SELECT COUNT(*) FROM t' },
    { label: 'Aggregate', code: 'SELECT type, COUNT(*) FROM t GROUP BY type' },
  ];

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

  it('initializes with step 0', () => {
    const runner = new StepRunner(STEPS, 'sql');
    expect(runner.getStepIndex()).toBe(0);
    expect(runner.getTotalSteps()).toBe(3);
    expect(runner.isComplete()).toBe(false);
  });

  it('getCurrentStep returns first step', () => {
    const runner = new StepRunner(STEPS, 'sql');
    const step = runner.getCurrentStep();
    expect(step.label).toBe('View documents');
    expect(step.code).toContain('FETCH FIRST');
  });

  it('executeNext runs current step and advances', async () => {
    const runner = new StepRunner(STEPS, 'sql');
    const result = await runner.executeNext();
    expect(result.rows).toBeDefined();
    expect(runner.getStepIndex()).toBe(1);
  });

  it('executeNext advances through all steps', async () => {
    const runner = new StepRunner(STEPS, 'sql');
    await runner.executeNext();
    await runner.executeNext();
    await runner.executeNext();
    expect(runner.isComplete()).toBe(true);
    expect(runner.getStepIndex()).toBe(3);
  });

  it('executeNext returns null after completion', async () => {
    const runner = new StepRunner(STEPS, 'sql');
    await runner.executeNext();
    await runner.executeNext();
    await runner.executeNext();
    const result = await runner.executeNext();
    expect(result).toBeNull();
  });

  it('getProgress returns label text', () => {
    const runner = new StepRunner(STEPS, 'sql');
    expect(runner.getProgress()).toBe('Step 1 of 3');
  });

  it('reset starts over', async () => {
    const runner = new StepRunner(STEPS, 'sql');
    await runner.executeNext();
    await runner.executeNext();
    runner.reset();
    expect(runner.getStepIndex()).toBe(0);
    expect(runner.isComplete()).toBe(false);
  });

  it('dispatches js code to executeJs', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ output: 42, logs: [], duration: 2 }),
    });
    const jsSteps = [{ label: 'Run JS', code: 'const x = 42; x' }];
    const runner = new StepRunner(jsSteps, 'js');
    const result = await runner.executeNext();
    expect(fetch).toHaveBeenCalledWith(
      '/api/query/js',
      expect.objectContaining({ body: JSON.stringify({ code: 'const x = 42; x' }) }),
    );
    expect(result.output).toBe(42);
  });
});
