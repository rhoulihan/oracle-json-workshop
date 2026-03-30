import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceService } from '../../src/services/workspace.js';

describe('WorkspaceService', () => {
  let mockPool;
  let mockConnection;
  let service;

  beforeEach(() => {
    mockConnection = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      commit: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockPool = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };
    service = new WorkspaceService(mockPool);
  });

  it('generates a schema name with WS_ prefix', () => {
    const name = service.generateSchemaName();
    expect(name).toMatch(/^WS_[A-Z0-9]{6}$/);
  });

  it('generates unique schema names', () => {
    const names = new Set(Array.from({ length: 100 }, () => service.generateSchemaName()));
    expect(names.size).toBe(100);
  });

  it('creates workspace by calling clone_schema', async () => {
    const result = await service.create({ displayName: 'Test User', email: 'test@example.com' });

    expect(result).toHaveProperty('schemaName');
    expect(result).toHaveProperty('password');
    expect(result.schemaName).toMatch(/^WS_/);
    expect(result.password).toHaveLength(16);

    // Verify clone_schema was called
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('clone_schema'),
      expect.objectContaining({ username: result.schemaName }),
    );
    expect(mockConnection.commit).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();
  });

  it('tears down workspace by calling drop_workspace', async () => {
    await service.teardown('WS_ABC123');

    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('drop_workspace'),
      expect.objectContaining({ username: 'WS_ABC123' }),
    );
    expect(mockConnection.commit).toHaveBeenCalled();
  });

  it('lists active workspaces', async () => {
    mockConnection.execute.mockResolvedValueOnce({
      rows: [
        { SCHEMA_NAME: 'WS_AAA', DISPLAY_NAME: 'Alice', STATUS: 'active' },
        { SCHEMA_NAME: 'WS_BBB', DISPLAY_NAME: 'Bob', STATUS: 'active' },
      ],
    });

    const list = await service.list();
    expect(list).toHaveLength(2);
    expect(list[0].schemaName).toBe('WS_AAA');
  });

  it('teardownAll drops all active workspaces', async () => {
    mockConnection.execute
      .mockResolvedValueOnce({
        rows: [{ SCHEMA_NAME: 'WS_AAA' }, { SCHEMA_NAME: 'WS_BBB' }],
      })
      .mockResolvedValue({ rows: [] });

    await service.teardownAll();

    // Should have called drop_workspace for each
    const dropCalls = mockConnection.execute.mock.calls.filter((c) =>
      c[0].includes('drop_workspace'),
    );
    expect(dropCalls).toHaveLength(2);
  });

  it('generates a random 16-char password', () => {
    const pw = service.generatePassword();
    expect(pw).toHaveLength(16);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[0-9]/);
  });
});
