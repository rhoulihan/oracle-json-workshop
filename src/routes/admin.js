import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';

/**
 * Create admin router with injected services.
 * @param {object} deps
 * @param {object} deps.workspaceService - WorkspaceService instance
 * @param {string} deps.adminPassword - Expected admin password
 * @returns {Router}
 */
export function createAdminRouter({ workspaceService, adminPassword }) {
  const router = Router();

  // POST /login — admin authentication
  router.post('/login', (req, res) => {
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password !== adminPassword) {
      return res.status(403).json({ error: 'Invalid admin password' });
    }

    req.session.admin = true;
    res.json({ ok: true });
  });

  // POST /logout — clear admin session
  router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ ok: true });
    });
  });

  // GET /workspaces — list all workspaces
  router.get('/workspaces', requireAdmin, async (req, res) => {
    try {
      const workspaces = await workspaceService.list();
      res.json({ workspaces });
    } catch (err) {
      res.status(500).json({ error: `Failed to list workspaces: ${err.message}` });
    }
  });

  // DELETE /workspaces — tear down ALL workspaces
  router.delete('/workspaces', requireAdmin, async (req, res) => {
    try {
      await workspaceService.teardownAll();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: `Bulk teardown failed: ${err.message}` });
    }
  });

  // DELETE /workspaces/:schemaName — tear down a specific workspace
  router.delete('/workspaces/:schemaName', requireAdmin, async (req, res) => {
    const { schemaName } = req.params;

    // Only allow tearing down WS_ prefixed schemas (safety guard)
    if (!/^WS_[A-F0-9]{6}$/i.test(schemaName)) {
      return res.status(400).json({ error: 'Invalid schema name — must match WS_XXXXXX pattern' });
    }

    try {
      await workspaceService.teardown(schemaName);
      res.json({ ok: true, schemaName });
    } catch (err) {
      res.status(500).json({ error: `Teardown failed: ${err.message}` });
    }
  });

  return router;
}
