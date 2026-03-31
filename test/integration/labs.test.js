import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { LabLoader } from '../../src/services/labLoader.js';
import { Validator } from '../../src/services/validator.js';
import { ProgressService } from '../../src/services/progressService.js';
import { QueryExecutor } from '../../src/services/queryExecutor.js';
import { JsExecutor } from '../../src/services/jsExecutor.js';
import { MongoExecutor } from '../../src/services/mongoExecutor.js';
import { getConnection, closePool } from './setup.js';

let app;

describe('labs integration', () => {
  beforeAll(() => {
    const labLoader = new LabLoader();
    const validator = new Validator();
    const progressService = new ProgressService();
    const queryExecutor = new QueryExecutor();
    const jsExecutor = new JsExecutor();
    const mongoExecutor = new MongoExecutor(queryExecutor);

    app = createApp(
      {
        session: { secret: 'integration-test-secret' },
        admin: { password: 'test-admin-pass' },
      },
      {
        labLoader,
        validator,
        progressService,
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
          req.session.user = { schemaName: 'WORKSHOP_ADMIN', password: 'x' };
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

  it('GET /api/labs returns all 6 modules', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.get('/api/labs');

    expect(res.status).toBe(200);
    expect(res.body.modules).toHaveLength(6);
    expect(res.body.modules[0].id).toBe('module-0');
  });

  it('GET /api/labs/module-1 returns full module content', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.get('/api/labs/module-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('module-1');
    expect(res.body.exercises).toHaveLength(6);
    expect(res.body.exercises[0].id).toBe('1.1');
  });

  it('GET /api/labs/module-99 returns 404', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.get('/api/labs/module-99');

    expect(res.status).toBe(404);
  });

  it('POST /api/labs/module-1/check/1.1 validates exercise against real DB', async () => {
    const agent = request.agent(app);
    await agent.post('/test-login');
    const res = await agent.post('/api/labs/module-1/check/1.1');

    // Exercise 1.1 validation: SELECT COUNT(*) FROM client_interactions → rowCount:>0
    expect(res.status).toBe(200);
    expect(res.body.exerciseId).toBe('1.1');
    expect(res.body.valid).toBe(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/labs');
    expect(res.status).toBe(401);
  });
});
