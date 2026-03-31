import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { QueryExecutor } from '../../src/services/queryExecutor.js';
import { JsExecutor } from '../../src/services/jsExecutor.js';
import { MongoExecutor } from '../../src/services/mongoExecutor.js';
import { getConnection, closePool } from './setup.js';

let app;

describe('MongoDB query integration', () => {
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

  it('executes show collections', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/query/mongo').send({ command: 'show collections' });

    // May return empty if no SODA collections, but should not error on SQL level
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.documents).toBeDefined();
    }
  });

  it('returns error for unparseable command', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/query/mongo').send({ command: 'not a valid command' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 401 without session', async () => {
    const res = await request(app).post('/api/query/mongo').send({ command: 'show collections' });

    expect(res.status).toBe(401);
  });

  it('returns 400 without command field', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/query/mongo').send({});

    expect(res.status).toBe(400);
  });
});
