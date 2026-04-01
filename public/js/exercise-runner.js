/**
 * Exercise runner — executes code and returns results.
 * Handles multi-statement SQL by splitting and running sequentially.
 */
import { api } from './api.js';
import { splitStatements } from './sql-splitter.js';

/**
 * Run exercise code and return all results.
 * @param {string} codeType - 'sql' | 'js' | 'mongo'
 * @param {string} code - The code to execute
 * @returns {Promise<{ results: object[], finalResult: object|null, error?: string, totalDuration: number }>}
 */
export async function runExercise(codeType, code) {
  if (!code || !code.trim()) {
    return { results: [], finalResult: null, totalDuration: 0 };
  }

  const start = performance.now();

  if (codeType === 'js') {
    const result = await api.executeJs(code);
    return {
      results: [result],
      finalResult: result,
      error: result.error,
      totalDuration: result.duration || Math.round(performance.now() - start),
    };
  }

  if (codeType === 'mongo') {
    const result = await api.executeMongo(code);
    return {
      results: [result],
      finalResult: result,
      error: result.error,
      totalDuration: result.duration || Math.round(performance.now() - start),
    };
  }

  // SQL: split and execute sequentially
  const statements = splitStatements(code);
  const results = [];
  let finalResult = null;
  let totalDuration = 0;

  for (const stmt of statements) {
    const result = await api.executeSql(stmt);
    results.push(result);
    totalDuration += result.duration || 0;

    if (result.error) {
      return { results, finalResult: result, error: result.error, totalDuration };
    }

    finalResult = result;
  }

  return { results, finalResult, totalDuration };
}
