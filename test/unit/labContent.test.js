import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LABS_DIR = join(__dirname, '../../src/labs');

const VALID_CODE_TYPES = ['sql', 'js', 'mongo'];
const MODULE_IDS = ['module-0', 'module-1', 'module-2', 'module-3', 'module-4', 'module-5'];

function loadModule(filename) {
  const content = readFileSync(join(LABS_DIR, filename), 'utf-8');
  return JSON.parse(content);
}

function loadAllModules() {
  const files = readdirSync(LABS_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) => ({ filename: f, module: loadModule(f) }));
}

describe('lab content JSON files', () => {
  const modules = loadAllModules();

  it('has exactly 6 module files', () => {
    expect(modules).toHaveLength(6);
  });

  it('all module IDs are present and sequential', () => {
    const ids = modules.map((m) => m.module.id).sort();
    expect(ids).toEqual(MODULE_IDS);
  });

  it('no duplicate exercise IDs across all modules', () => {
    const allIds = modules.flatMap((m) => m.module.exercises.map((e) => e.id));
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  describe.each(modules)('$filename', ({ module }) => {
    it('has required top-level fields', () => {
      expect(module).toHaveProperty('id');
      expect(module).toHaveProperty('title');
      expect(module).toHaveProperty('description');
      expect(module).toHaveProperty('estimatedTime');
      expect(module).toHaveProperty('exercises');
      expect(typeof module.id).toBe('string');
      expect(typeof module.title).toBe('string');
      expect(typeof module.description).toBe('string');
      expect(typeof module.estimatedTime).toBe('number');
      expect(Array.isArray(module.exercises)).toBe(true);
    });

    it('has valid estimatedTime', () => {
      expect(module.estimatedTime).toBeGreaterThan(0);
      expect(module.estimatedTime).toBeLessThanOrEqual(30);
    });

    it('exercises have required fields', () => {
      for (const exercise of module.exercises) {
        expect(exercise).toHaveProperty('id');
        expect(exercise).toHaveProperty('title');
        expect(exercise).toHaveProperty('description');
        expect(exercise).toHaveProperty('code');
        expect(exercise).toHaveProperty('codeType');
        expect(typeof exercise.id).toBe('string');
        expect(typeof exercise.title).toBe('string');
        expect(typeof exercise.code).toBe('string');
        expect(exercise.code.length).toBeGreaterThan(0);
        expect(VALID_CODE_TYPES).toContain(exercise.codeType);
      }
    });

    it('exercises with validation have both validationQuery and expectedResultPattern', () => {
      for (const exercise of module.exercises) {
        if (exercise.validationQuery) {
          expect(exercise).toHaveProperty('expectedResultPattern');
          expect(typeof exercise.validationQuery).toBe('string');
          expect(typeof exercise.expectedResultPattern).toBe('string');
        }
      }
    });
  });

  it('module-0 has no exercises (read-only)', () => {
    const m0 = modules.find((m) => m.module.id === 'module-0');
    expect(m0.module.exercises).toHaveLength(0);
  });

  it('module-1 has 6 exercises', () => {
    const m1 = modules.find((m) => m.module.id === 'module-1');
    expect(m1.module.exercises).toHaveLength(6);
  });

  it('module-2 has 7 exercises', () => {
    const m2 = modules.find((m) => m.module.id === 'module-2');
    expect(m2.module.exercises).toHaveLength(7);
  });

  it('module-3 has 5 exercises', () => {
    const m3 = modules.find((m) => m.module.id === 'module-3');
    expect(m3.module.exercises).toHaveLength(5);
  });

  it('module-4 has 4 exercises', () => {
    const m4 = modules.find((m) => m.module.id === 'module-4');
    expect(m4.module.exercises).toHaveLength(4);
  });

  it('module-5 has 2 exercises', () => {
    const m5 = modules.find((m) => m.module.id === 'module-5');
    expect(m5.module.exercises).toHaveLength(2);
  });
});
