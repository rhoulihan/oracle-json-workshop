import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { createQueryRouter } from '../../src/routes/query.js';

function buildApp(services = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );

  // Simulate authenticated session
  app.use((req, _res, next) => {
    if (req.headers['x-test-auth'] !== 'skip') {
      req.session.user = { schema: 'WS_TEST' };
    }
    next();
  });

  const defaults = {
    queryExecutor: {
      execute: vi
        .fn()
        .mockResolvedValue({
          rows: [],
          columns: [],
          rowCount: 0,
          duration: 1,
          resultType: 'tabular',
        }),
    },
    jsExecutor: { execute: vi.fn().mockResolvedValue({ output: null, logs: [], duration: 1 }) },
    mongoExecutor: { execute: vi.fn().mockResolvedValue({ documents: [], count: 0, duration: 1 }) },
    getConnection: vi.fn().mockResolvedValue({ close: vi.fn() }),
  };

  const router = createQueryRouter({ ...defaults, ...services });
  app.use('/api/query', router);
  return app;
}

describe('query routes', () => {
  describe('POST /api/query/sql', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/query/sql')
        .set('x-test-auth', 'skip')
        .send({ sql: 'SELECT 1 FROM dual' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when sql field is missing', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/query/sql').send({});
      expect(res.status).toBe(400);
    });

    it('returns 403 for blocked SQL', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/query/sql')
        .send({ sql: 'DROP USER hacker CASCADE' });
      expect(res.status).toBe(403);
    });

    it('executes allowed SQL and returns results', async () => {
      const executor = {
        execute: vi.fn().mockResolvedValue({
          rows: [{ ID: 1 }],
          columns: ['ID'],
          rowCount: 1,
          duration: 5,
          resultType: 'tabular',
        }),
      };
      const app = buildApp({ queryExecutor: executor });
      const res = await request(app)
        .post('/api/query/sql')
        .send({ sql: 'SELECT 1 AS id FROM dual' });

      expect(res.status).toBe(200);
      expect(res.body.rows).toEqual([{ ID: 1 }]);
      expect(res.body.duration).toBe(5);
    });

    it('returns 500 when executor returns error', async () => {
      const executor = {
        execute: vi.fn().mockResolvedValue({ error: 'ORA-00942', duration: 1 }),
      };
      const app = buildApp({ queryExecutor: executor });
      const res = await request(app)
        .post('/api/query/sql')
        .send({ sql: 'SELECT * FROM nonexistent' });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/ORA-00942/);
    });
  });

  describe('POST /api/query/js', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/query/js')
        .set('x-test-auth', 'skip')
        .send({ code: '1 + 1' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when code field is missing', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/query/js').send({});
      expect(res.status).toBe(400);
    });

    it('executes JS and returns output', async () => {
      const jsExec = {
        execute: vi.fn().mockResolvedValue({ output: 42, logs: ['hello'], duration: 3 }),
      };
      const app = buildApp({ jsExecutor: jsExec });
      const res = await request(app).post('/api/query/js').send({ code: '40 + 2' });

      expect(res.status).toBe(200);
      expect(res.body.output).toBe(42);
      expect(res.body.logs).toEqual(['hello']);
    });

    it('returns 500 when JS executor returns error', async () => {
      const jsExec = {
        execute: vi.fn().mockResolvedValue({ error: 'boom', duration: 1 }),
      };
      const app = buildApp({ jsExecutor: jsExec });
      const res = await request(app).post('/api/query/js').send({ code: 'throw "boom"' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('boom');
    });
  });

  describe('POST /api/query/mongo', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/query/mongo')
        .set('x-test-auth', 'skip')
        .send({ command: 'show collections' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when command field is missing', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/query/mongo').send({});
      expect(res.status).toBe(400);
    });

    it('executes mongo command and returns documents', async () => {
      const mongoExec = {
        execute: vi.fn().mockResolvedValue({
          documents: [{ name: 'Alice' }],
          count: 1,
          duration: 4,
        }),
      };
      const app = buildApp({ mongoExecutor: mongoExec });
      const res = await request(app)
        .post('/api/query/mongo')
        .send({ command: 'db.employees.find({})' });

      expect(res.status).toBe(200);
      expect(res.body.documents).toEqual([{ name: 'Alice' }]);
    });

    it('returns 500 when mongo executor returns error', async () => {
      const mongoExec = {
        execute: vi.fn().mockResolvedValue({ error: 'parse error', duration: 1 }),
      };
      const app = buildApp({ mongoExecutor: mongoExec });
      const res = await request(app).post('/api/query/mongo').send({ command: 'bad command' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('parse error');
    });
  });
});
