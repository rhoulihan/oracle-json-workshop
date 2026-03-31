import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { QueryExecutor } from '../../src/services/queryExecutor.js';
import { JsExecutor } from '../../src/services/jsExecutor.js';
import { MongoExecutor } from '../../src/services/mongoExecutor.js';
import { getConnection, closePool } from './setup.js';

let app;

describe('JS query integration', () => {
  beforeAll(() => {
    const queryExecutor = new QueryExecutor();
    const jsExecutor = new JsExecutor();
    const mongoExecutor = new MongoExecutor(queryExecutor);

    app = createApp(
      { session: { secret: 'integration-test-secret' } },
      {
        queryExecutor,
        jsExecutor,
        mongoExecutor,
        getConnection: async () => getConnection(),
      },
    );

    // Test-only login route
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

  it('executes JavaScript with connection and returns result', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/query/js').send({
      code: `
        const result = await connection.execute("SELECT 1 AS val FROM dual");
        result;
      `,
    });

    expect(res.status).toBe(200);
    expect(res.body.output).toBeDefined();
  });

  it('captures console.log output', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/query/js').send({
      code: 'console.log("integration test"); 42',
    });

    expect(res.status).toBe(200);
    expect(res.body.logs).toContain('integration test');
    expect(res.body.output).toBe(42);
  });

  it('blocks process access', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/query/js').send({
      code: 'process.exit(1)',
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 401 without session', async () => {
    const res = await request(app).post('/api/query/js').send({ code: '1 + 1' });

    expect(res.status).toBe(401);
  });
});
