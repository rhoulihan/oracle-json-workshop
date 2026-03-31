import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

/**
 * Create lab router with injected services.
 * @param {object} deps
 * @param {object} deps.labLoader - LabLoader instance
 * @param {object} deps.validator - Validator instance
 * @param {object} deps.progressService - ProgressService instance
 * @param {Function} deps.getConnection - async (user) => connection (user schema)
 * @param {Function} deps.getAdminConnection - async () => connection (admin pool)
 * @returns {Router}
 */
export function createLabRouter({
  labLoader,
  validator,
  progressService,
  getConnection,
  getAdminConnection,
}) {
  const router = Router();

  // GET / — list all modules
  router.get('/', requireAuth, (_req, res) => {
    const modules = labLoader.listModules();
    res.json({ modules });
  });

  // GET /progress — get user's completion state
  router.get('/progress', requireAuth, async (req, res) => {
    const conn = await getAdminConnection();
    try {
      const progress = await progressService.getProgress(conn, req.session.user.schemaName);
      res.json({ progress });
    } finally {
      await conn.close();
    }
  });

  // GET /:moduleId — get full module content
  router.get('/:moduleId', requireAuth, (req, res) => {
    const mod = labLoader.getModule(req.params.moduleId);
    if (!mod) {
      return res.status(404).json({ error: `Module not found: ${req.params.moduleId}` });
    }
    res.json(mod);
  });

  // POST /:moduleId/check/:exerciseId — validate exercise answer
  router.post('/:moduleId/check/:exerciseId', requireAuth, async (req, res) => {
    const { moduleId, exerciseId } = req.params;

    const exercise = labLoader.getExercise(moduleId, exerciseId);
    if (!exercise) {
      return res.status(404).json({ error: `Exercise not found: ${moduleId}/${exerciseId}` });
    }

    if (!exercise.validationQuery || !exercise.expectedResultPattern) {
      return res.json({
        exerciseId,
        valid: true,
        message: 'No validation required for this exercise',
      });
    }

    const userConn = await getConnection(req.session.user);
    try {
      const result = await validator.validate(
        userConn,
        exercise.validationQuery,
        exercise.expectedResultPattern,
      );

      if (result.valid) {
        const adminConn = await getAdminConnection();
        try {
          await progressService.markComplete(
            adminConn,
            req.session.user.schemaName,
            moduleId,
            exerciseId,
          );
        } finally {
          await adminConn.close();
        }
      }

      res.json({
        exerciseId,
        valid: result.valid,
        message: result.message,
        ...(result.valid && { completedAt: new Date().toISOString() }),
      });
    } finally {
      await userConn.close();
    }
  });

  return router;
}
