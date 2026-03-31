import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { QueryExecutor } from '../../src/services/queryExecutor.js';
import { JsExecutor } from '../../src/services/jsExecutor.js';
import { MongoExecutor } from '../../src/services/mongoExecutor.js';
import { getConnection, closePool } from './setup.js';

let app;

function buildApp() {
  const queryExecutor = new QueryExecutor();
  const jsExecutor = new JsExecutor();
  const mongoExecutor = new MongoExecutor(queryExecutor);

  return createApp(
    { session: { secret: 'integration-test-secret' } },
    {
      queryExecutor,
      jsExecutor,
      mongoExecutor,
      getConnection: async () => getConnection(),
    },
  );
}

describe('SQL query integration', () => {
  beforeAll(() => {
    app = buildApp();
    // Add a test-only login route
    app._router.stack.splice(-1, 0, {
      name: 'testLogin',
      handle: (req, res, next) => {
        if (req.path === '/test-login' && req.method === 'POST') {
          req.session.user = { schema: 'WORKSHOP_ADMIN' };
          return res.json({ ok: true });
        }
        next();
      },
      route: undefined,
      regexp: /.*/,
      keys: [],
    });
  });

  afterAll(async () => {
    await closePool();
  });

  it('executes SELECT against real database', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/query/sql').send({ sql: 'SELECT 1 AS val FROM dual' });

    expect(res.status).toBe(200);
    expect(res.body.rows).toBeDefined();
    expect(res.body.rowCount).toBeGreaterThanOrEqual(1);
    expect(res.body.resultType).toBe('tabular');
  });

  it('rejects DROP USER via security middleware', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/query/sql').send({ sql: 'DROP USER hacker CASCADE' });

    expect(res.status).toBe(403);
  });

  it('returns error for invalid SQL', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent
      .post('/api/query/sql')
      .send({ sql: 'SELECT * FROM this_table_does_not_exist_xyz' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 401 without session', async () => {
    const res = await request(app).post('/api/query/sql').send({ sql: 'SELECT 1 FROM dual' });

    expect(res.status).toBe(401);
  });
});
