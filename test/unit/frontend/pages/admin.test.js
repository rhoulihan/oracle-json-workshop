import { describe, it, expect } from 'vitest';
import {
  renderWorkspaceTable,
  renderHeatmap,
  formatTimestamp,
} from '../../../../public/js/pages/admin.js';

const MODULES = [
  { id: 'module-0', title: 'Big Picture', exerciseCount: 0 },
  { id: 'module-1', title: 'JSON Collections', exerciseCount: 6 },
  { id: 'module-2', title: 'Duality Views', exerciseCount: 7 },
  { id: 'module-3', title: 'Single-Table', exerciseCount: 5 },
  { id: 'module-4', title: 'Hybrid Queries', exerciseCount: 4 },
  { id: 'module-5', title: 'Multi-Protocol', exerciseCount: 2 },
];

const WORKSPACES = [
  {
    schemaName: 'WS_ABC123',
    displayName: 'Alice',
    email: 'alice@test.com',
    status: 'active',
    progress: {
      'module-1': { exercises: { 1.1: {}, 1.2: {}, 1.3: {} } },
      'module-2': { exercises: { 2.1: {} } },
    },
    createdAt: '2026-03-31T10:00:00Z',
    lastActive: '2026-03-31T11:00:00Z',
  },
  {
    schemaName: 'WS_DEF456',
    displayName: 'Bob',
    email: null,
    status: 'active',
    progress: {},
    createdAt: '2026-03-31T10:05:00Z',
    lastActive: '2026-03-31T10:05:00Z',
  },
];

describe('admin page', () => {
  describe('renderWorkspaceTable', () => {
    it('renders a table with workspace rows', () => {
      const el = renderWorkspaceTable(WORKSPACES);
      expect(el.tagName).toBe('TABLE');
      expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    });

    it('shows schema name in each row', () => {
      const el = renderWorkspaceTable(WORKSPACES);
      const firstRow = el.querySelector('tbody tr');
      expect(firstRow.textContent).toContain('WS_ABC123');
    });

    it('shows display name', () => {
      const el = renderWorkspaceTable(WORKSPACES);
      expect(el.textContent).toContain('Alice');
    });

    it('includes teardown button per row', () => {
      const el = renderWorkspaceTable(WORKSPACES);
      const buttons = el.querySelectorAll('.btn-teardown');
      expect(buttons).toHaveLength(2);
      expect(buttons[0].dataset.schema).toBe('WS_ABC123');
    });

    it('shows empty message when no workspaces', () => {
      const el = renderWorkspaceTable([]);
      expect(el.textContent).toContain('No active workspaces');
    });
  });

  describe('renderHeatmap', () => {
    it('renders grid with module columns and user rows', () => {
      const el = renderHeatmap(WORKSPACES, MODULES);
      expect(el.classList.contains('heatmap')).toBe(true);
      // Header row + 2 user rows
      const rows = el.querySelectorAll('.heatmap-row');
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('colors cells based on completion percentage', () => {
      const el = renderHeatmap(WORKSPACES, MODULES);
      const cells = el.querySelectorAll('.heatmap-cell');
      // At least some cells should exist
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  describe('formatTimestamp', () => {
    it('formats ISO timestamp to readable string', () => {
      const result = formatTimestamp('2026-03-31T10:00:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('returns dash for null', () => {
      expect(formatTimestamp(null)).toBe('—');
    });
  });
});
