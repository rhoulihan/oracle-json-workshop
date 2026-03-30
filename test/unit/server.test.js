import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';

describe('server', () => {
  let app;

  beforeEach(() => {
    app = createApp({ session: { secret: 'test-secret' } });
  });

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /unknown returns 404', async () => {
    const res = await request(app).get('/unknown');
    expect(res.status).toBe(404);
  });

  it('sets security headers via helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
