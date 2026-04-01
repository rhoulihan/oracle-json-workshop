/**
 * StepRunner — manages step-by-step execution of multi-statement exercises.
 * Each call to executeNext() runs one step and advances the index.
 */
import { api } from './api.js';

export class StepRunner {
  #steps;
  #codeType;
  #index = 0;

  /**
   * @param {Array<{ label: string, code: string }>} steps
   * @param {string} codeType - 'sql' | 'js' | 'mongo'
   */
  constructor(steps, codeType) {
    this.#steps = steps;
    this.#codeType = codeType;
  }

  getStepIndex() {
    return this.#index;
  }

  getTotalSteps() {
    return this.#steps.length;
  }

  isComplete() {
    return this.#index >= this.#steps.length;
  }

  getCurrentStep() {
    if (this.isComplete()) return null;
    return this.#steps[this.#index];
  }

  getProgress() {
    return `Step ${this.#index + 1} of ${this.#steps.length}`;
  }

  /**
   * Execute the current step and advance.
   * @returns {Promise<object|null>} API result, or null if already complete
   */
  async executeNext() {
    if (this.isComplete()) return null;

    const step = this.#steps[this.#index];
    let result;

    if (this.#codeType === 'js') {
      result = await api.executeJs(step.code);
    } else if (this.#codeType === 'mongo') {
      result = await api.executeMongo(step.code);
    } else {
      result = await api.executeSql(step.code);
    }

    this.#index++;
    return result;
  }

  reset() {
    this.#index = 0;
  }
}
