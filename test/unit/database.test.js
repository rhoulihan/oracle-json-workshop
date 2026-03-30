import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '../../src/services/database.js';

describe('DatabaseService', () => {
  let mockOracledb;
  let mockPool;

  beforeEach(() => {
    mockPool = {
      close: vi.fn().mockResolvedValue(undefined),
      getConnection: vi.fn().mockResolvedValue({ close: vi.fn() }),
    };
    mockOracledb = {
      createPool: vi.fn().mockResolvedValue(mockPool),
      POOL_STATUS_OPEN: 1,
    };
  });

  it('throws if getPool called before initialize', () => {
    const db = new DatabaseService(mockOracledb);
    expect(() => db.getPool()).toThrow('not initialized');
  });

  it('initializes connection pool with correct config', async () => {
    const db = new DatabaseService(mockOracledb);
    const config = {
      user: 'ADMIN',
      password: 'pass',
      connectString: 'localhost:1521/FREEPDB1',
    };
    await db.initialize(config);

    expect(mockOracledb.createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'ADMIN',
        password: 'pass',
        connectString: 'localhost:1521/FREEPDB1',
      }),
    );
  });

  it('returns pool after initialization', async () => {
    const db = new DatabaseService(mockOracledb);
    await db.initialize({ user: 'A', password: 'B', connectString: 'C' });
    expect(db.getPool()).toBe(mockPool);
  });

  it('closes pool on shutdown', async () => {
    const db = new DatabaseService(mockOracledb);
    await db.initialize({ user: 'A', password: 'B', connectString: 'C' });
    await db.close();
    expect(mockPool.close).toHaveBeenCalledWith({ drainTime: 10 });
  });

  it('close is safe to call when not initialized', async () => {
    const db = new DatabaseService(mockOracledb);
    await expect(db.close()).resolves.toBeUndefined();
  });

  it('prevents double initialization', async () => {
    const db = new DatabaseService(mockOracledb);
    await db.initialize({ user: 'A', password: 'B', connectString: 'C' });
    await expect(db.initialize({ user: 'A', password: 'B', connectString: 'C' })).rejects.toThrow(
      'already initialized',
    );
  });
});
