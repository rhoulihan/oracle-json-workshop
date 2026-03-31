import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { createAdminRouter } from '../../src/routes/admin.js';

function buildApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );

  const defaults = {
    workspaceService: {
      list: vi.fn().mockResolvedValue([
        { schemaName: 'WS_AAA111', displayName: 'Alice', status: 'active' },
        { schemaName: 'WS_BBB222', displayName: 'Bob', status: 'active' },
      ]),
      teardown: vi.fn().mockResolvedValue(undefined),
      teardownAll: vi.fn().mockResolvedValue(undefined),
    },
    adminPassword: 'instructor2026',
  };

  const router = createAdminRouter({ ...defaults, ...deps });
  app.use('/api/admin', router);
  return app;
}

/** Helper to get an admin-authenticated agent */
async function adminAgent(app, password = 'instructor2026') {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ password });
  return agent;
}

describe('admin routes', () => {
  describe('POST /api/admin/login', () => {
    it('returns 200 and sets admin session with correct password', async () => {
      const app = buildApp();
      const agent = request.agent(app);

      const res = await agent.post('/api/admin/login').send({ password: 'instructor2026' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns 403 with wrong password', async () => {
      const app = buildApp();

      const res = await request(app).post('/api/admin/login').send({ password: 'wrong' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/invalid|password/i);
    });

    it('returns 400 when password is missing', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/admin/login').send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/workspaces', () => {
    it('returns 403 without admin session', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/admin/workspaces');

      expect(res.status).toBe(403);
    });

    it('returns workspace list for admin', async () => {
      const app = buildApp();
      const agent = await adminAgent(app);

      const res = await agent.get('/api/admin/workspaces');

      expect(res.status).toBe(200);
      expect(res.body.workspaces).toHaveLength(2);
      expect(res.body.workspaces[0].schemaName).toBe('WS_AAA111');
    });

    it('calls workspaceService.list()', async () => {
      const ws = {
        list: vi.fn().mockResolvedValue([]),
        teardown: vi.fn(),
        teardownAll: vi.fn(),
      };
      const app = buildApp({ workspaceService: ws });
      const agent = await adminAgent(app);

      await agent.get('/api/admin/workspaces');

      expect(ws.list).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/admin/workspaces/:schemaName', () => {
    it('returns 403 without admin session', async () => {
      const app = buildApp();
      const res = await request(app).delete('/api/admin/workspaces/WS_AAA111');

      expect(res.status).toBe(403);
    });

    it('tears down a specific workspace', async () => {
      const ws = {
        list: vi.fn().mockResolvedValue([]),
        teardown: vi.fn().mockResolvedValue(undefined),
        teardownAll: vi.fn(),
      };
      const app = buildApp({ workspaceService: ws });
      const agent = await adminAgent(app);

      const res = await agent.delete('/api/admin/workspaces/WS_AAA111');

      expect(res.status).toBe(200);
      expect(ws.teardown).toHaveBeenCalledWith('WS_AAA111');
    });

    it('returns 500 when teardown fails', async () => {
      const ws = {
        list: vi.fn().mockResolvedValue([]),
        teardown: vi.fn().mockRejectedValue(new Error('ORA-01918')),
        teardownAll: vi.fn(),
      };
      const app = buildApp({ workspaceService: ws });
      const agent = await adminAgent(app);

      const res = await agent.delete('/api/admin/workspaces/WS_CCC333');

      expect(res.status).toBe(500);
      expect(res.body.error).toBeTruthy();
    });

    it('rejects schema names that do not start with WS_', async () => {
      const app = buildApp();
      const agent = await adminAgent(app);

      const res = await agent.delete('/api/admin/workspaces/SYS');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid.*schema/i);
    });
  });

  describe('DELETE /api/admin/workspaces', () => {
    it('returns 403 without admin session', async () => {
      const app = buildApp();
      const res = await request(app).delete('/api/admin/workspaces');

      expect(res.status).toBe(403);
    });

    it('tears down all workspaces', async () => {
      const ws = {
        list: vi.fn().mockResolvedValue([]),
        teardown: vi.fn(),
        teardownAll: vi.fn().mockResolvedValue(undefined),
      };
      const app = buildApp({ workspaceService: ws });
      const agent = await adminAgent(app);

      const res = await agent.delete('/api/admin/workspaces');

      expect(res.status).toBe(200);
      expect(ws.teardownAll).toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/logout', () => {
    it('clears admin session', async () => {
      const app = buildApp();
      const agent = await adminAgent(app);

      const res = await agent.post('/api/admin/logout');
      expect(res.status).toBe(200);

      // Subsequent admin request should fail
      const check = await agent.get('/api/admin/workspaces');
      expect(check.status).toBe(403);
    });
  });
});
