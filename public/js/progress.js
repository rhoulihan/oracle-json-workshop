/**
 * Progress calculation — pure functions, no DOM, no fetch.
 */

/**
 * Calculate overall completion percentage across all modules.
 * @param {object} progress - Progress data from API
 * @param {Array} modules - Module list with exerciseCount
 * @returns {number} Percentage 0-100
 */
export function calculateOverall(progress, modules) {
  const totalExercises = modules.reduce((sum, m) => sum + m.exerciseCount, 0);
  if (totalExercises === 0) return 0;

  let completed = 0;
  for (const mod of modules) {
    const modProgress = progress[mod.id];
    if (modProgress?.exercises) {
      completed += Object.keys(modProgress.exercises).length;
    }
  }

  return Math.round((completed / totalExercises) * 100);
}

/**
 * Get completion status for a specific module.
 * @param {object} progress - Progress data
 * @param {string} moduleId - Module ID
 * @param {number} exerciseCount - Total exercises in module
 * @returns {{ completed: number, total: number, percentage: number }}
 */
export function getModuleStatus(progress, moduleId, exerciseCount) {
  const modProgress = progress[moduleId];
  const completed = modProgress?.exercises ? Object.keys(modProgress.exercises).length : 0;
  const percentage = exerciseCount > 0 ? Math.round((completed / exerciseCount) * 100) : 0;
  return { completed, total: exerciseCount, percentage };
}

/**
 * Check if a specific exercise is complete.
 * @param {object} progress
 * @param {string} moduleId
 * @param {string} exerciseId
 * @returns {boolean}
 */
export function isExerciseComplete(progress, moduleId, exerciseId) {
  return !!progress[moduleId]?.exercises?.[exerciseId];
}
