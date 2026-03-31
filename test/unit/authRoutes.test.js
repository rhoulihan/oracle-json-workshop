import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { createAuthRouter } from '../../src/routes/auth.js';

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
      create: vi.fn().mockResolvedValue({ schemaName: 'WS_ABC123', password: 'TestPass1abc' }),
    },
    dbService: {
      getPool: vi.fn().mockReturnValue({}),
    },
  };

  const router = createAuthRouter({ ...defaults, ...deps });
  app.use('/api/auth', router);
  return app;
}

describe('auth routes', () => {
  describe('POST /api/auth/register', () => {
    it('creates a workspace and returns schema info', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ displayName: 'Alice', email: 'alice@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.schemaName).toBe('WS_ABC123');
      expect(res.body.password).toBeUndefined(); // password should NOT be in response body
    });

    it('sets session.user after registration', async () => {
      const app = buildApp();
      const agent = request.agent(app);

      await agent.post('/api/auth/register').send({ displayName: 'Bob', email: 'bob@example.com' });

      // Verify session was set by hitting a protected-like endpoint
      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.schemaName).toBe('WS_ABC123');
    });

    it('calls workspaceService.create with displayName and email', async () => {
      const ws = {
        create: vi.fn().mockResolvedValue({ schemaName: 'WS_DEF456', password: 'Pass1xyz' }),
      };
      const app = buildApp({ workspaceService: ws });

      await request(app)
        .post('/api/auth/register')
        .send({ displayName: 'Charlie', email: 'charlie@test.com' });

      expect(ws.create).toHaveBeenCalledWith({
        displayName: 'Charlie',
        email: 'charlie@test.com',
      });
    });

    it('returns 500 when workspace creation fails', async () => {
      const ws = {
        create: vi.fn().mockRejectedValue(new Error('ORA-65100')),
      };
      const app = buildApp({ workspaceService: ws });

      const res = await request(app).post('/api/auth/register').send({ displayName: 'Fail' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeTruthy();
    });

    it('works without displayName and email (both optional)', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/auth/register').send({});

      expect(res.status).toBe(201);
      expect(res.body.schemaName).toBe('WS_ABC123');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 400 if schemaName or password missing', async () => {
      const app = buildApp();

      const res1 = await request(app).post('/api/auth/login').send({ schemaName: 'WS_ABC123' });
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/api/auth/login').send({ password: 'x' });
      expect(res2.status).toBe(400);
    });

    it('logs in with valid credentials and sets session', async () => {
      // Mock getConnectionAs to simulate valid credentials
      const deps = {
        getConnectionAs: vi.fn().mockResolvedValue({ close: vi.fn() }),
      };
      const app = buildApp(deps);
      const agent = request.agent(app);

      const res = await agent
        .post('/api/auth/login')
        .send({ schemaName: 'WS_ABC123', password: 'TestPass1' });

      expect(res.status).toBe(200);
      expect(res.body.schemaName).toBe('WS_ABC123');

      // Verify session persists
      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.schemaName).toBe('WS_ABC123');
    });

    it('returns 401 for invalid credentials', async () => {
      const deps = {
        getConnectionAs: vi
          .fn()
          .mockRejectedValue(new Error('ORA-01017: invalid username/password')),
      };
      const app = buildApp(deps);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ schemaName: 'WS_BAD', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid|credentials/i);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the session', async () => {
      const deps = {
        getConnectionAs: vi.fn().mockResolvedValue({ close: vi.fn() }),
      };
      const app = buildApp(deps);
      const agent = request.agent(app);

      // Login first
      await agent.post('/api/auth/login').send({ schemaName: 'WS_ABC123', password: 'TestPass1' });

      // Logout
      const res = await agent.post('/api/auth/logout');
      expect(res.status).toBe(200);

      // Session should be gone
      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when not logged in', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns user info when logged in', async () => {
      const deps = {
        getConnectionAs: vi.fn().mockResolvedValue({ close: vi.fn() }),
      };
      const app = buildApp(deps);
      const agent = request.agent(app);

      await agent.post('/api/auth/login').send({ schemaName: 'WS_TEST', password: 'pass' });

      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.schemaName).toBe('WS_TEST');
    });
  });
});
