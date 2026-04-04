import { Router } from 'express';

/**
 * Create auth router with injected services.
 * @param {object} deps
 * @param {object} deps.workspaceService - WorkspaceService instance
 * @param {Function} [deps.getConnectionAs] - async (user, password) => connection
 * @returns {Router}
 */
export function createAuthRouter({ workspaceService, getConnectionAs }) {
  const router = Router();

  // POST /register — create a new workspace and log in
  router.post('/register', async (req, res) => {
    const { displayName, email } = req.body || {};

    // Check for duplicate email if provided
    if (email) {
      try {
        const existing = await workspaceService.findByEmail(email);
        if (existing) {
          return res.status(409).json({
            error: `A workspace already exists for ${email} (${existing.schemaName}). Use "Reconnect" to log in with your existing credentials.`,
          });
        }
      } catch {
        // If findByEmail fails, proceed with registration
      }
    }

    try {
      const { schemaName, password } = await workspaceService.create({ displayName, email });

      // Store credentials in session (password needed for per-user DB connections)
      req.session.user = { schemaName, password };

      res.status(201).json({ schemaName });
    } catch (err) {
      res.status(500).json({ error: `Workspace creation failed: ${err.message}` });
    }
  });

  // POST /login — authenticate with existing workspace credentials
  router.post('/login', async (req, res) => {
    const { schemaName, password } = req.body || {};

    if (!schemaName || !password) {
      return res.status(400).json({ error: 'schemaName and password are required' });
    }

    try {
      // Validate credentials by attempting a database connection
      const conn = await getConnectionAs(schemaName, password);
      await conn.close();

      req.session.user = { schemaName, password };
      res.json({ schemaName });
    } catch {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  // POST /logout — clear session
  router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ ok: true });
    });
  });

  // POST /reset — tear down and recreate workspace (fresh database state)
  router.post('/reset', async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { schemaName } = req.session.user;
    try {
      // Save progress before teardown (drop_workspace deletes the workshop_users row)
      const savedProgress = await workspaceService.getProgress(schemaName);
      // Tear down existing schema
      await workspaceService.teardown(schemaName);
      // Recreate with same schema name
      const { password } = await workspaceService.createWithName(schemaName);
      // Restore progress
      if (savedProgress && Object.keys(savedProgress).length > 0) {
        await workspaceService.setProgress(schemaName, savedProgress);
      }
      // Update session with new password
      req.session.user = { schemaName, password };
      res.json({ ok: true, schemaName });
    } catch (err) {
      res.status(500).json({ error: `Reset failed: ${err.message}` });
    }
  });

  // GET /me — return current user info
  router.get('/me', (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    // Return schema name only — never expose password
    res.json({ schemaName: req.session.user.schemaName });
  });

  return router;
}
