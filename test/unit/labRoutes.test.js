import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { createLabRouter } from '../../src/routes/labs.js';

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

  // Simulate authenticated session
  app.use((req, _res, next) => {
    if (req.headers['x-test-auth'] !== 'skip') {
      req.session.user = { schemaName: 'WS_TEST01', password: 'pass' };
    }
    next();
  });

  const defaults = {
    labLoader: {
      listModules: vi.fn().mockReturnValue([
        { id: 'module-0', title: 'Big Picture', estimatedTime: 5, exerciseCount: 0 },
        { id: 'module-1', title: 'JSON Collections', estimatedTime: 15, exerciseCount: 6 },
      ]),
      getModule: vi.fn().mockImplementation((id) => {
        if (id === 'module-1') {
          return {
            id: 'module-1',
            title: 'JSON Collections',
            exercises: [
              {
                id: '1.1',
                title: 'Explore',
                validationQuery: 'SELECT 1',
                expectedResultPattern: 'rowCount:>0',
              },
            ],
          };
        }
        return null;
      }),
      getExercise: vi.fn().mockImplementation((modId, exId) => {
        if (modId === 'module-1' && exId === '1.1') {
          return {
            id: '1.1',
            title: 'Explore',
            validationQuery: 'SELECT 1 FROM dual',
            expectedResultPattern: 'rowCount:>0',
          };
        }
        return null;
      }),
    },
    validator: {
      validate: vi.fn().mockResolvedValue({ valid: true, message: 'Found 1 row' }),
    },
    progressService: {
      getProgress: vi.fn().mockResolvedValue({}),
      markComplete: vi.fn().mockResolvedValue(undefined),
    },
    getConnection: vi.fn().mockResolvedValue({ close: vi.fn() }),
    getAdminConnection: vi.fn().mockResolvedValue({ close: vi.fn() }),
  };

  const router = createLabRouter({ ...defaults, ...deps });
  app.use('/api/labs', router);
  return app;
}

describe('lab routes', () => {
  describe('GET /api/labs', () => {
    it('returns module list', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/labs');

      expect(res.status).toBe(200);
      expect(res.body.modules).toHaveLength(2);
      expect(res.body.modules[0].id).toBe('module-0');
    });

    it('returns 401 without auth', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/labs').set('x-test-auth', 'skip');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/labs/:moduleId', () => {
    it('returns module content for valid ID', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/labs/module-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('module-1');
      expect(res.body.exercises).toHaveLength(1);
    });

    it('returns 404 for unknown module', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/labs/module-99');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/labs/:moduleId/check/:exerciseId', () => {
    it('validates exercise and returns result', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/labs/module-1/check/1.1');

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.exerciseId).toBe('1.1');
    });

    it('marks progress on successful validation', async () => {
      const progressService = {
        getProgress: vi.fn().mockResolvedValue({}),
        markComplete: vi.fn().mockResolvedValue(undefined),
      };
      const app = buildApp({ progressService });
      await request(app).post('/api/labs/module-1/check/1.1');

      expect(progressService.markComplete).toHaveBeenCalledWith(
        expect.anything(),
        'WS_TEST01',
        'module-1',
        '1.1',
      );
    });

    it('does not mark progress on failed validation', async () => {
      const progressService = {
        getProgress: vi.fn().mockResolvedValue({}),
        markComplete: vi.fn().mockResolvedValue(undefined),
      };
      const validator = {
        validate: vi.fn().mockResolvedValue({ valid: false, message: 'No rows' }),
      };
      const app = buildApp({ progressService, validator });
      const res = await request(app).post('/api/labs/module-1/check/1.1');

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(progressService.markComplete).not.toHaveBeenCalled();
    });

    it('returns 404 for unknown exercise', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/labs/module-1/check/99.99');

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/labs/module-1/check/1.1')
        .set('x-test-auth', 'skip');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/labs/progress', () => {
    it('returns user progress', async () => {
      const progressService = {
        getProgress: vi.fn().mockResolvedValue({
          'module-1': { exercises: { 1.1: { completedAt: '2026-03-30T20:00:00Z' } } },
        }),
        markComplete: vi.fn(),
      };
      const app = buildApp({ progressService });
      const res = await request(app).get('/api/labs/progress');

      expect(res.status).toBe(200);
      expect(res.body.progress).toBeDefined();
      expect(res.body.progress['module-1']).toBeDefined();
    });

    it('returns 401 without auth', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/labs/progress').set('x-test-auth', 'skip');

      expect(res.status).toBe(401);
    });
  });
});
