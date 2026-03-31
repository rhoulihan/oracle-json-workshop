import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LABS_DIR = join(__dirname, '../labs');

/**
 * Lab content loader. Reads module JSON files from src/labs/ at construction
 * and serves them from memory.
 */
export class LabLoader {
  #modules = new Map();

  constructor() {
    this.#loadAll();
  }

  #loadAll() {
    const files = readdirSync(LABS_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const content = readFileSync(join(LABS_DIR, file), 'utf-8');
      const mod = JSON.parse(content);
      this.#modules.set(mod.id, mod);
    }
  }

  /**
   * List all modules with summary info.
   * @returns {Array<{ id, title, description, estimatedTime, exerciseCount }>}
   */
  listModules() {
    return [...this.#modules.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        estimatedTime: m.estimatedTime,
        exerciseCount: m.exercises.length,
      }));
  }

  /**
   * Get full module content by ID.
   * @param {string} moduleId
   * @returns {object|null}
   */
  getModule(moduleId) {
    if (!moduleId) return null;
    return this.#modules.get(moduleId) || null;
  }

  /**
   * Get a specific exercise by module and exercise ID.
   * @param {string} moduleId
   * @param {string} exerciseId
   * @returns {object|null}
   */
  getExercise(moduleId, exerciseId) {
    const mod = this.getModule(moduleId);
    if (!mod) return null;
    return mod.exercises.find((e) => e.id === exerciseId) || null;
  }
}
