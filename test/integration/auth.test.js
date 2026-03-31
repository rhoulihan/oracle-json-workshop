import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { WorkspaceService } from '../../src/services/workspace.js';
import { QueryExecutor } from '../../src/services/queryExecutor.js';
import { JsExecutor } from '../../src/services/jsExecutor.js';
import { MongoExecutor } from '../../src/services/mongoExecutor.js';
import { getPool, getConnectionAs, closePool } from './setup.js';

let app;
let workspaceService;
let createdSchemas = [];

describe('auth integration', () => {
  beforeAll(async () => {
    const pool = await getPool();
    workspaceService = new WorkspaceService(pool);
    const queryExecutor = new QueryExecutor();
    const jsExecutor = new JsExecutor();
    const mongoExecutor = new MongoExecutor(queryExecutor);

    app = createApp(
      {
        session: { secret: 'integration-test-secret' },
        admin: { password: 'test-admin-pass' },
      },
      {
        workspaceService,
        queryExecutor,
        jsExecutor,
        mongoExecutor,
        getConnectionAs,
        getConnection: async (user) => getConnectionAs(user.schemaName, user.password),
      },
    );
  });

  afterAll(async () => {
    // Clean up any created workspaces
    for (const schema of createdSchemas) {
      try {
        await workspaceService.teardown(schema);
      } catch {
        // ignore cleanup errors
      }
    }
    await closePool();
  });

  it('full lifecycle: register → me → query → logout → login → me', async () => {
    const agent = request.agent(app);

    // Register
    const reg = await agent
      .post('/api/auth/register')
      .send({ displayName: 'Integration Test', email: 'test@example.com' });

    expect(reg.status).toBe(201);
    expect(reg.body.schemaName).toMatch(/^WS_[A-F0-9]{6}$/);
    createdSchemas.push(reg.body.schemaName);

    // Me — should be authenticated
    const me1 = await agent.get('/api/auth/me');
    expect(me1.status).toBe(200);
    expect(me1.body.schemaName).toBe(reg.body.schemaName);

    // Execute a query while authenticated
    const query = await agent.post('/api/query/sql').send({ sql: 'SELECT 1 AS val FROM dual' });
    expect(query.status).toBe(200);

    // Logout
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    // Me — should be 401
    const me2 = await agent.get('/api/auth/me');
    expect(me2.status).toBe(401);
  });

  it('admin lifecycle: login → list → teardown → logout', async () => {
    // First create a workspace to manage
    const pool = await getPool();
    const ws = new WorkspaceService(pool);
    const { schemaName } = await ws.create({ displayName: 'Admin Test' });
    createdSchemas.push(schemaName);

    const agent = request.agent(app);

    // Admin login
    const login = await agent.post('/api/admin/login').send({ password: 'test-admin-pass' });
    expect(login.status).toBe(200);

    // List workspaces
    const list = await agent.get('/api/admin/workspaces');
    expect(list.status).toBe(200);
    expect(list.body.workspaces.length).toBeGreaterThanOrEqual(1);

    // Teardown the workspace we created
    const teardown = await agent.delete(`/api/admin/workspaces/${schemaName}`);
    expect(teardown.status).toBe(200);
    // Remove from cleanup list since we already tore it down
    createdSchemas = createdSchemas.filter((s) => s !== schemaName);

    // Admin logout
    const logout = await agent.post('/api/admin/logout');
    expect(logout.status).toBe(200);

    // Should no longer have admin access
    const check = await agent.get('/api/admin/workspaces');
    expect(check.status).toBe(403);
  });

  it('rejects admin login with wrong password', async () => {
    const res = await request(app).post('/api/admin/login').send({ password: 'wrong' });
    expect(res.status).toBe(403);
  });
});
