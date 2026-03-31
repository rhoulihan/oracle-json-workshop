import { describe, it, expect } from 'vitest';
import {
  calculateOverall,
  getModuleStatus,
  isExerciseComplete,
} from '../../../public/js/progress.js';

const MODULES = [
  { id: 'module-0', exerciseCount: 0 },
  { id: 'module-1', exerciseCount: 6 },
  { id: 'module-2', exerciseCount: 7 },
  { id: 'module-3', exerciseCount: 5 },
  { id: 'module-4', exerciseCount: 4 },
  { id: 'module-5', exerciseCount: 2 },
];

describe('progress calculator', () => {
  describe('calculateOverall', () => {
    it('returns 0 for empty progress', () => {
      expect(calculateOverall({}, MODULES)).toBe(0);
    });

    it('returns 100 when all exercises complete', () => {
      const progress = {
        'module-1': { exercises: { 1.1: {}, 1.2: {}, 1.3: {}, 1.4: {}, 1.5: {}, 1.6: {} } },
        'module-2': {
          exercises: { 2.1: {}, 2.2: {}, 2.3: {}, 2.4: {}, 2.5: {}, 2.6: {}, 2.7: {} },
        },
        'module-3': { exercises: { 3.1: {}, 3.2: {}, 3.3: {}, 3.4: {}, 3.5: {} } },
        'module-4': { exercises: { 4.1: {}, 4.2: {}, 4.3: {}, 4.4: {} } },
        'module-5': { exercises: { 5.1: {}, 5.2: {} } },
      };
      expect(calculateOverall(progress, MODULES)).toBe(100);
    });

    it('returns correct partial percentage', () => {
      const progress = {
        'module-1': { exercises: { 1.1: {}, 1.2: {} } },
      };
      // 2 out of 24 total exercises = 8.3%
      const pct = calculateOverall(progress, MODULES);
      expect(pct).toBeCloseTo(8.3, 0);
    });
  });

  describe('getModuleStatus', () => {
    it('returns 0 for module with no progress', () => {
      const status = getModuleStatus({}, 'module-1', 6);
      expect(status).toEqual({ completed: 0, total: 6, percentage: 0 });
    });

    it('returns correct status for partial completion', () => {
      const progress = {
        'module-1': { exercises: { 1.1: {}, 1.2: {}, 1.3: {} } },
      };
      const status = getModuleStatus(progress, 'module-1', 6);
      expect(status.completed).toBe(3);
      expect(status.percentage).toBe(50);
    });

    it('returns 100 when module is complete', () => {
      const progress = {
        'module-5': { exercises: { 5.1: {}, 5.2: {} } },
      };
      expect(getModuleStatus(progress, 'module-5', 2).percentage).toBe(100);
    });
  });

  describe('isExerciseComplete', () => {
    it('returns true for completed exercise', () => {
      const progress = {
        'module-1': { exercises: { 1.1: { completedAt: '2026-03-30' } } },
      };
      expect(isExerciseComplete(progress, 'module-1', '1.1')).toBe(true);
    });

    it('returns false for incomplete exercise', () => {
      expect(isExerciseComplete({}, 'module-1', '1.1')).toBe(false);
    });

    it('returns false for missing module', () => {
      expect(isExerciseComplete({}, 'module-99', '1.1')).toBe(false);
    });
  });
});
