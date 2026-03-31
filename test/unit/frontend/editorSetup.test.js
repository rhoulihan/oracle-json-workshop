import { describe, it, expect, beforeEach } from 'vitest';
import { TabManager } from '../../../public/js/editor-setup.js';

describe('TabManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TabManager();
  });

  it('starts with sql as active tab', () => {
    expect(manager.getActiveTab()).toBe('sql');
  });

  it('stores and retrieves content per tab', () => {
    manager.setContent('sql', 'SELECT 1 FROM dual');
    manager.setContent('js', 'console.log("hello")');
    expect(manager.getContent('sql')).toBe('SELECT 1 FROM dual');
    expect(manager.getContent('js')).toBe('console.log("hello")');
  });

  it('switching tabs preserves content', () => {
    manager.setContent('sql', 'SELECT 1');
    manager.switchTab('js');
    manager.setContent('js', 'const x = 1');
    manager.switchTab('sql');
    expect(manager.getContent('sql')).toBe('SELECT 1');
  });

  it('returns empty string for tab with no content', () => {
    expect(manager.getContent('mongo')).toBe('');
  });

  it('switchTab updates active tab', () => {
    manager.switchTab('js');
    expect(manager.getActiveTab()).toBe('js');
    manager.switchTab('mongo');
    expect(manager.getActiveTab()).toBe('mongo');
  });

  it('getApiMethod returns correct method name per tab', () => {
    expect(manager.getApiMethod('sql')).toBe('executeSql');
    expect(manager.getApiMethod('js')).toBe('executeJs');
    expect(manager.getApiMethod('mongo')).toBe('executeMongo');
  });

  it('getRequestBody wraps content correctly per tab', () => {
    expect(manager.getRequestBody('sql', 'SELECT 1')).toEqual({ sql: 'SELECT 1' });
    expect(manager.getRequestBody('js', 'x+1')).toEqual({ code: 'x+1' });
    expect(manager.getRequestBody('mongo', 'show collections')).toEqual({
      command: 'show collections',
    });
  });
});
