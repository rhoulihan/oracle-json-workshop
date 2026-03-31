import { describe, it, expect, vi } from 'vitest';
import { requireAuth, requireAdmin } from '../../src/middleware/auth.js';

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe('requireAuth', () => {
  it('calls next when session.user exists', () => {
    const req = { session: { user: { schemaName: 'WS_ABC123' } } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it('returns 401 when session has no user', () => {
    const req = { session: {} };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/auth/i);
  });

  it('returns 401 when session is missing entirely', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

describe('requireAdmin', () => {
  it('calls next when session.admin is true', () => {
    const req = { session: { admin: true } };
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when session.admin is not set', () => {
    const req = { session: { user: { schemaName: 'WS_ABC' } } };
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/admin|forbidden/i);
  });

  it('returns 403 when no session at all', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
