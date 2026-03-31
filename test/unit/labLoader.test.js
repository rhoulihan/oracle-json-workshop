import { describe, it, expect } from 'vitest';
import { LabLoader } from '../../src/services/labLoader.js';

describe('LabLoader', () => {
  const loader = new LabLoader();

  describe('listModules', () => {
    it('returns all 6 module summaries', () => {
      const modules = loader.listModules();
      expect(modules).toHaveLength(6);
    });

    it('each summary has id, title, estimatedTime, exerciseCount', () => {
      const modules = loader.listModules();
      for (const m of modules) {
        expect(m).toHaveProperty('id');
        expect(m).toHaveProperty('title');
        expect(m).toHaveProperty('estimatedTime');
        expect(m).toHaveProperty('exerciseCount');
        expect(typeof m.exerciseCount).toBe('number');
      }
    });

    it('modules are sorted by ID', () => {
      const modules = loader.listModules();
      const ids = modules.map((m) => m.id);
      expect(ids).toEqual(['module-0', 'module-1', 'module-2', 'module-3', 'module-4', 'module-5']);
    });
  });

  describe('getModule', () => {
    it('returns full module content for valid ID', () => {
      const mod = loader.getModule('module-1');
      expect(mod).toBeDefined();
      expect(mod.id).toBe('module-1');
      expect(mod.exercises).toHaveLength(6);
    });

    it('returns null for unknown module ID', () => {
      expect(loader.getModule('module-99')).toBeNull();
      expect(loader.getModule('')).toBeNull();
      expect(loader.getModule(null)).toBeNull();
    });

    it('returns module-0 with empty exercises', () => {
      const mod = loader.getModule('module-0');
      expect(mod.exercises).toHaveLength(0);
    });
  });

  describe('getExercise', () => {
    it('returns a specific exercise', () => {
      const ex = loader.getExercise('module-1', '1.1');
      expect(ex).toBeDefined();
      expect(ex.id).toBe('1.1');
      expect(ex.title).toBe('Explore the Collection');
    });

    it('returns null for unknown exercise', () => {
      expect(loader.getExercise('module-1', '99.99')).toBeNull();
    });

    it('returns null for unknown module', () => {
      expect(loader.getExercise('module-99', '1.1')).toBeNull();
    });
  });
});
