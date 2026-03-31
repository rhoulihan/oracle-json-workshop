import { Router } from 'express';
import { classifySQL } from '../middleware/security.js';

/**
 * Create query router with injected services.
 * @param {object} deps
 * @param {object} deps.queryExecutor - QueryExecutor instance
 * @param {object} deps.jsExecutor - JsExecutor instance
 * @param {object} deps.mongoExecutor - MongoExecutor instance
 * @param {Function} deps.getConnection - async function returning a DB connection
 * @returns {Router}
 */
export function createQueryRouter({ queryExecutor, jsExecutor, mongoExecutor, getConnection }) {
  const router = Router();

  // Auth check — all query endpoints require a session
  function requireAuth(req, res, next) {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  }

  // POST /sql — execute SQL
  router.post('/sql', requireAuth, async (req, res) => {
    const { sql } = req.body || {};
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'Missing required field: sql' });
    }

    // Security check
    const classification = classifySQL(sql);
    if (!classification.allowed) {
      return res.status(403).json({ error: classification.reason });
    }

    const conn = await getConnection(req.session.user);
    try {
      const result = await queryExecutor.execute(conn, sql);
      if (result.error) {
        return res.status(500).json({ error: result.error, duration: result.duration });
      }
      res.json(result);
    } finally {
      await conn.close();
    }
  });

  // POST /js — execute JavaScript
  router.post('/js', requireAuth, async (req, res) => {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing required field: code' });
    }

    const conn = await getConnection(req.session.user);
    try {
      const result = await jsExecutor.execute(code, { connection: conn });
      if (result.error) {
        return res.status(500).json({ error: result.error, duration: result.duration });
      }
      res.json(result);
    } finally {
      await conn.close();
    }
  });

  // POST /mongo — execute MongoDB command
  router.post('/mongo', requireAuth, async (req, res) => {
    const { command } = req.body || {};
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Missing required field: command' });
    }

    const conn = await getConnection(req.session.user);
    try {
      const result = await mongoExecutor.execute(conn, command);
      if (result.error) {
        return res.status(500).json({ error: result.error, duration: result.duration });
      }
      res.json(result);
    } finally {
      await conn.close();
    }
  });

  return router;
}
