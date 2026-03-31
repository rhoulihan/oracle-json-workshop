/**
 * Progress tracking service.
 * Reads/writes the workshop_users.progress JSON column.
 */
import oracledb from 'oracledb';

export class ProgressService {
  /**
   * Get progress for a user.
   * @param {object} conn - Database connection
   * @param {string} schemaName - User's schema name (WS_XXXXXX)
   * @returns {Promise<object>} Progress JSON
   */
  async getProgress(conn, schemaName) {
    const result = await conn.execute(
      `SELECT progress FROM workshop_users WHERE schema_name = :sn`,
      { sn: schemaName },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    if (!result.rows || result.rows.length === 0) {
      return {};
    }

    const raw = result.rows[0].PROGRESS;
    if (!raw) return {};

    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  /**
   * Mark an exercise as complete.
   * @param {object} conn - Database connection
   * @param {string} schemaName - User's schema name
   * @param {string} moduleId - Module ID (e.g., 'module-1')
   * @param {string} exerciseId - Exercise ID (e.g., '1.1')
   */
  async markComplete(conn, schemaName, moduleId, exerciseId) {
    const progress = await this.getProgress(conn, schemaName);

    if (!progress[moduleId]) {
      progress[moduleId] = { exercises: {} };
    }
    if (!progress[moduleId].exercises) {
      progress[moduleId].exercises = {};
    }

    progress[moduleId].exercises[exerciseId] = {
      completedAt: new Date().toISOString(),
    };

    await conn.execute(`UPDATE workshop_users SET progress = :progress WHERE schema_name = :sn`, {
      progress: JSON.stringify(progress),
      sn: schemaName,
    });
    await conn.commit();
  }

  /**
   * Get completion status for a specific module.
   * @param {object} progress - Full progress object
   * @param {string} moduleId - Module ID
   * @param {number} totalExercises - Total exercises in the module
   * @returns {{ completed: number, total: number, percentage: number }}
   */
  getModuleStatus(progress, moduleId, totalExercises) {
    const moduleProgress = progress[moduleId];
    const completed = moduleProgress?.exercises ? Object.keys(moduleProgress.exercises).length : 0;

    return {
      completed,
      total: totalExercises,
      percentage: totalExercises > 0 ? Math.round((completed / totalExercises) * 1000) / 10 : 0,
    };
  }
}
