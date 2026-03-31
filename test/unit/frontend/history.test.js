import { describe, it, expect, beforeEach } from 'vitest';
import { addEntry, getEntries, clearHistory, MAX_ENTRIES } from '../../../public/js/history.js';

describe('query history', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores an entry and retrieves it', () => {
    addEntry({ query: 'SELECT 1', type: 'sql', duration: 5, success: true });
    const entries = getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe('SELECT 1');
    expect(entries[0].type).toBe('sql');
  });

  it('returns newest entries first', () => {
    addEntry({ query: 'first', type: 'sql', duration: 1, success: true });
    addEntry({ query: 'second', type: 'sql', duration: 2, success: true });
    const entries = getEntries();
    expect(entries[0].query).toBe('second');
    expect(entries[1].query).toBe('first');
  });

  it('adds timestamp automatically', () => {
    addEntry({ query: 'SELECT 1', type: 'sql', duration: 1, success: true });
    const entries = getEntries();
    expect(entries[0].timestamp).toBeDefined();
  });

  it('caps at MAX_ENTRIES (50)', () => {
    for (let i = 0; i < 55; i++) {
      addEntry({ query: `q${i}`, type: 'sql', duration: 1, success: true });
    }
    const entries = getEntries();
    expect(entries).toHaveLength(MAX_ENTRIES);
    // newest should be q54
    expect(entries[0].query).toBe('q54');
  });

  it('clearHistory empties storage', () => {
    addEntry({ query: 'SELECT 1', type: 'sql', duration: 1, success: true });
    clearHistory();
    expect(getEntries()).toHaveLength(0);
  });

  it('returns empty array when no history', () => {
    expect(getEntries()).toEqual([]);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('queryHistory', 'not valid json{{{');
    expect(getEntries()).toEqual([]);
  });

  it('preserves existing entries when adding new one', () => {
    addEntry({ query: 'first', type: 'sql', duration: 1, success: true });
    addEntry({ query: 'second', type: 'js', duration: 2, success: false });
    const entries = getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('js');
    expect(entries[1].type).toBe('sql');
  });
});
