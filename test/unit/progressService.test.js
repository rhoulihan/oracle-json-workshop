import { describe, it, expect, vi } from 'vitest';
import { ProgressService } from '../../src/services/progressService.js';

function mockConnection(rows = []) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
    commit: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ProgressService', () => {
  describe('getProgress', () => {
    it('returns progress JSON for a user', async () => {
      const progress = {
        'module-1': { exercises: { 1.1: { completedAt: '2026-03-30T20:00:00Z' } } },
      };
      const conn = mockConnection([{ PROGRESS: JSON.stringify(progress) }]);
      const svc = new ProgressService();

      const result = await svc.getProgress(conn, 'WS_ABC123');

      expect(result).toEqual(progress);
      expect(conn.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.objectContaining({ sn: 'WS_ABC123' }),
      );
    });

    it('returns empty object for user with no progress', async () => {
      const conn = mockConnection([{ PROGRESS: '{}' }]);
      const svc = new ProgressService();

      const result = await svc.getProgress(conn, 'WS_NEW');
      expect(result).toEqual({});
    });

    it('returns empty object when user not found', async () => {
      const conn = mockConnection([]);
      const svc = new ProgressService();

      const result = await svc.getProgress(conn, 'WS_MISSING');
      expect(result).toEqual({});
    });
  });

  describe('markComplete', () => {
    it('updates progress with exercise completion timestamp', async () => {
      const conn = mockConnection([{ PROGRESS: '{}' }]);
      const svc = new ProgressService();

      await svc.markComplete(conn, 'WS_ABC123', 'module-1', '1.1');

      // Should have called execute twice: SELECT then UPDATE
      expect(conn.execute).toHaveBeenCalledTimes(2);
      const updateCall = conn.execute.mock.calls[1];
      expect(updateCall[0]).toMatch(/UPDATE/);
      // The progress JSON should contain the exercise
      const progressArg = updateCall[1].progress;
      const parsed = JSON.parse(progressArg);
      expect(parsed['module-1'].exercises['1.1']).toHaveProperty('completedAt');
    });

    it('preserves existing progress when adding new exercise', async () => {
      const existing = {
        'module-1': {
          exercises: { 1.1: { completedAt: '2026-03-30T20:00:00Z' } },
        },
      };
      const conn = mockConnection([{ PROGRESS: JSON.stringify(existing) }]);
      const svc = new ProgressService();

      await svc.markComplete(conn, 'WS_ABC123', 'module-1', '1.2');

      const updateCall = conn.execute.mock.calls[1];
      const parsed = JSON.parse(updateCall[1].progress);
      expect(parsed['module-1'].exercises['1.1']).toBeDefined();
      expect(parsed['module-1'].exercises['1.2']).toBeDefined();
    });

    it('commits after updating', async () => {
      const conn = mockConnection([{ PROGRESS: '{}' }]);
      const svc = new ProgressService();

      await svc.markComplete(conn, 'WS_ABC123', 'module-1', '1.1');

      expect(conn.commit).toHaveBeenCalled();
    });
  });

  describe('getModuleStatus', () => {
    it('returns 0% for module with no progress', () => {
      const svc = new ProgressService();
      const status = svc.getModuleStatus({}, 'module-1', 6);

      expect(status.completed).toBe(0);
      expect(status.total).toBe(6);
      expect(status.percentage).toBe(0);
    });

    it('returns correct percentage for partial completion', () => {
      const progress = {
        'module-1': {
          exercises: {
            1.1: { completedAt: '2026-03-30T20:00:00Z' },
            1.2: { completedAt: '2026-03-30T20:05:00Z' },
          },
        },
      };
      const svc = new ProgressService();
      const status = svc.getModuleStatus(progress, 'module-1', 6);

      expect(status.completed).toBe(2);
      expect(status.total).toBe(6);
      expect(status.percentage).toBeCloseTo(33.3, 0);
    });

    it('returns 100% when all exercises complete', () => {
      const progress = {
        'module-1': {
          exercises: {
            1.1: { completedAt: 'x' },
            1.2: { completedAt: 'x' },
            1.3: { completedAt: 'x' },
          },
        },
      };
      const svc = new ProgressService();
      const status = svc.getModuleStatus(progress, 'module-1', 3);

      expect(status.percentage).toBe(100);
    });
  });
});
