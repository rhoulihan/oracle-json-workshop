import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DB_USER = 'WORKSHOP_ADMIN';
    process.env.DB_PASSWORD = 'testpass';
    process.env.DB_CONNECT_STRING = 'localhost:1521/FREEPDB1';
    process.env.SESSION_SECRET = 'test-secret';
    process.env.ADMIN_PASSWORD = 'admin123';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads valid configuration from environment', () => {
    const config = loadConfig();
    expect(config.db.user).toBe('WORKSHOP_ADMIN');
    expect(config.db.password).toBe('testpass');
    expect(config.db.connectString).toBe('localhost:1521/FREEPDB1');
    expect(config.session.secret).toBe('test-secret');
    expect(config.admin.password).toBe('admin123');
  });

  it('applies default values for optional vars', () => {
    const config = loadConfig();
    expect(config.server.port).toBe(3000);
    expect(config.ords.baseUrl).toBe('http://localhost:8181/ords');
    expect(config.mongodb.uri).toBe('mongodb://localhost:27017');
  });

  it('respects custom port from environment', () => {
    process.env.PORT = '4000';
    const config = loadConfig();
    expect(config.server.port).toBe(4000);
  });

  it('throws on missing DB_USER', () => {
    delete process.env.DB_USER;
    expect(() => loadConfig()).toThrow('DB_USER');
  });

  it('throws on missing DB_PASSWORD', () => {
    delete process.env.DB_PASSWORD;
    expect(() => loadConfig()).toThrow('DB_PASSWORD');
  });

  it('throws on missing DB_CONNECT_STRING', () => {
    delete process.env.DB_CONNECT_STRING;
    expect(() => loadConfig()).toThrow('DB_CONNECT_STRING');
  });

  it('throws on missing SESSION_SECRET', () => {
    delete process.env.SESSION_SECRET;
    expect(() => loadConfig()).toThrow('SESSION_SECRET');
  });

  it('throws on missing ADMIN_PASSWORD', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(() => loadConfig()).toThrow('ADMIN_PASSWORD');
  });

  it('throws on non-numeric PORT', () => {
    process.env.PORT = 'abc';
    expect(() => loadConfig()).toThrow('PORT');
  });

  it('throws on out-of-range PORT', () => {
    process.env.PORT = '99999';
    expect(() => loadConfig()).toThrow('PORT');
  });
});
