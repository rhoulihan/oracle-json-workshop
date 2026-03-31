import { describe, it, expect } from 'vitest';
import { renderTable, renderJson, renderError, renderDml } from '../../../public/js/results.js';

describe('results renderer', () => {
  describe('renderTable', () => {
    it('creates a table with headers and rows', () => {
      const el = renderTable(['ID', 'NAME'], [{ ID: 1, NAME: 'Alice' }]);
      expect(el.tagName).toBe('TABLE');
      expect(el.querySelector('thead th').textContent).toBe('ID');
      expect(el.querySelector('tbody td').textContent).toBe('1');
    });

    it('handles empty rows', () => {
      const el = renderTable(['ID'], []);
      expect(el.querySelector('.no-results')).toBeTruthy();
    });

    it('renders multiple rows', () => {
      const el = renderTable(['VAL'], [{ VAL: 'a' }, { VAL: 'b' }, { VAL: 'c' }]);
      expect(el.querySelectorAll('tbody tr').length).toBe(3);
    });
  });

  describe('renderJson', () => {
    it('creates a pre element with formatted JSON', () => {
      const el = renderJson({ name: 'Alice', age: 30 });
      expect(el.tagName).toBe('PRE');
      expect(el.textContent).toContain('"name"');
      expect(el.textContent).toContain('Alice');
    });
  });

  describe('renderError', () => {
    it('creates an error div with message', () => {
      const el = renderError('ORA-00942: table does not exist');
      expect(el.classList.contains('error-message')).toBe(true);
      expect(el.textContent).toContain('ORA-00942');
    });
  });

  describe('renderDml', () => {
    it('creates a DML result message', () => {
      const el = renderDml({ rowsAffected: 3, duration: 12 });
      expect(el.textContent).toContain('3');
      expect(el.textContent).toContain('12');
    });
  });
});
