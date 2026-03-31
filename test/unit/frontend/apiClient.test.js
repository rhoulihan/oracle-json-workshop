import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../../public/js/api.js';

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }),
    );
  });

  describe('get', () => {
    it('calls fetch with correct URL', async () => {
      await api.get('/api/health');
      expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET' }));
    });

    it('returns parsed JSON on success', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
      });
      const result = await api.get('/api/health');
      expect(result).toEqual({ status: 'ok' });
    });

    it('returns error object on non-2xx', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });
      const result = await api.get('/api/auth/me');
      expect(result).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('post', () => {
    it('sends JSON body with correct headers', async () => {
      await api.post('/api/auth/register', { displayName: 'Alice' });
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: 'Alice' }),
        }),
      );
    });
  });

  describe('auth methods', () => {
    it('register calls POST /api/auth/register', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ schemaName: 'WS_ABC123' }),
      });
      const result = await api.register('Alice', 'alice@test.com');
      expect(result.schemaName).toBe('WS_ABC123');
    });

    it('getMe calls GET /api/auth/me', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ schemaName: 'WS_ABC123' }),
      });
      const result = await api.getMe();
      expect(result.schemaName).toBe('WS_ABC123');
    });

    it('getMe returns null on 401', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Not authenticated' }),
      });
      const result = await api.getMe();
      expect(result).toBeNull();
    });

    it('logout calls POST /api/auth/logout', async () => {
      await api.logout();
      expect(fetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('lab methods', () => {
    it('getModules returns modules array', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ modules: [{ id: 'module-0' }] }),
      });
      const result = await api.getModules();
      expect(result).toEqual([{ id: 'module-0' }]);
    });

    it('getModule returns full module', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'module-1', exercises: [] }),
      });
      const result = await api.getModule('module-1');
      expect(result.id).toBe('module-1');
    });

    it('checkExercise calls correct endpoint', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ valid: true, message: 'OK' }),
      });
      const result = await api.checkExercise('module-1', '1.1');
      expect(fetch).toHaveBeenCalledWith(
        '/api/labs/module-1/check/1.1',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.valid).toBe(true);
    });

    it('getProgress returns progress object', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ progress: { 'module-1': {} } }),
      });
      const result = await api.getProgress();
      expect(result).toEqual({ 'module-1': {} });
    });
  });

  describe('query methods', () => {
    it('executeSql sends SQL and returns result', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ rows: [{ ID: 1 }], duration: 5 }),
      });
      const result = await api.executeSql('SELECT 1 FROM dual');
      expect(fetch).toHaveBeenCalledWith(
        '/api/query/sql',
        expect.objectContaining({
          body: JSON.stringify({ sql: 'SELECT 1 FROM dual' }),
        }),
      );
      expect(result.rows).toEqual([{ ID: 1 }]);
    });
  });

  describe('admin methods', () => {
    it('adminLogin calls POST /api/admin/login', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
      const result = await api.adminLogin('instructor2026');
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/login',
        expect.objectContaining({
          body: JSON.stringify({ password: 'instructor2026' }),
        }),
      );
      expect(result.ok).toBe(true);
    });

    it('adminLogout calls POST /api/admin/logout', async () => {
      await api.adminLogout();
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/logout',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('getWorkspaces returns workspaces array', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            workspaces: [{ schemaName: 'WS_ABC123', displayName: 'Alice' }],
          }),
      });
      const result = await api.getWorkspaces();
      expect(result).toEqual([{ schemaName: 'WS_ABC123', displayName: 'Alice' }]);
    });

    it('teardownWorkspace calls DELETE with schema name', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
      await api.teardownWorkspace('WS_ABC123');
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/workspaces/WS_ABC123',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('teardownAll calls DELETE /api/admin/workspaces', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
      await api.teardownAll();
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/workspaces',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
