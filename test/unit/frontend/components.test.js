import { describe, it, expect } from 'vitest';
import {
  renderHeader,
  renderModuleCard,
  renderProgressBar,
  renderExercise,
} from '../../../public/js/components.js';

describe('shared components', () => {
  describe('renderHeader', () => {
    it('renders header with Oracle branding', () => {
      const el = renderHeader('WS_ABC123');
      expect(el.tagName).toBe('HEADER');
      expect(el.classList.contains('site-header')).toBe(true);
    });

    it('includes nav links', () => {
      const el = renderHeader('WS_ABC123');
      const links = el.querySelectorAll('a');
      expect(links.length).toBeGreaterThanOrEqual(2);
    });

    it('shows schema name when provided', () => {
      const el = renderHeader('WS_ABC123');
      expect(el.textContent).toContain('WS_ABC123');
    });

    it('omits user info when no schema', () => {
      const el = renderHeader(null);
      expect(el.textContent).not.toContain('WS_');
    });
  });

  describe('renderModuleCard', () => {
    it('renders card with title and time', () => {
      const el = renderModuleCard(
        { id: 'module-1', title: 'JSON Collections', estimatedTime: 15, exerciseCount: 6 },
        { completed: 2, total: 6, percentage: 33 },
      );
      expect(el.classList.contains('module-card')).toBe(true);
      expect(el.textContent).toContain('JSON Collections');
      expect(el.textContent).toContain('15');
    });

    it('shows progress percentage', () => {
      const el = renderModuleCard(
        { id: 'module-1', title: 'Test', estimatedTime: 5, exerciseCount: 3 },
        { completed: 1, total: 3, percentage: 33 },
      );
      expect(el.textContent).toContain('33');
    });
  });

  describe('renderProgressBar', () => {
    it('renders with correct width', () => {
      const el = renderProgressBar(75);
      const fill = el.querySelector('.progress-fill');
      expect(fill.style.width).toBe('75%');
    });

    it('has aria attributes', () => {
      const el = renderProgressBar(50);
      expect(el.getAttribute('role')).toBe('progressbar');
      expect(el.getAttribute('aria-valuenow')).toBe('50');
    });
  });

  describe('renderExercise', () => {
    it('renders exercise with title and editable textarea', () => {
      const exercise = {
        id: '1.1',
        title: 'Explore the Collection',
        description: 'Test desc',
        code: 'SELECT 1 FROM dual;',
        codeType: 'sql',
      };
      const el = renderExercise(exercise, false);
      expect(el.textContent).toContain('Explore the Collection');
      expect(el.querySelector('.exercise-textarea').value).toContain('SELECT 1');
    });

    it('has Run button instead of Check Answer', () => {
      const exercise = { id: '1.1', title: 'Test', description: '', code: 'x', codeType: 'sql' };
      const el = renderExercise(exercise, false);
      expect(el.querySelector('.btn-run')).toBeTruthy();
      expect(el.querySelector('.btn-check')).toBeNull();
    });

    it('has Copy and Reset buttons', () => {
      const exercise = { id: '1.1', title: 'Test', description: '', code: 'x', codeType: 'sql' };
      const el = renderExercise(exercise, false);
      expect(el.querySelector('.btn-copy')).toBeTruthy();
      expect(el.querySelector('.btn-reset')).toBeTruthy();
    });

    it('has result container', () => {
      const exercise = { id: '1.1', title: 'Test', description: '', code: 'x', codeType: 'sql' };
      const el = renderExercise(exercise, false);
      expect(el.querySelector('.exercise-result')).toBeTruthy();
    });

    it('shows checkmark when complete', () => {
      const exercise = { id: '1.1', title: 'Test', description: '', code: 'x', codeType: 'sql' };
      const el = renderExercise(exercise, true);
      expect(el.querySelector('.exercise-complete')).toBeTruthy();
    });

    it('shows Learn tab when explanation is present', () => {
      const exercise = {
        id: '1.1',
        title: 'Test',
        description: '',
        code: 'x',
        codeType: 'sql',
        explanation: 'JSON_SERIALIZE converts JSON to text.',
      };
      const el = renderExercise(exercise, false);
      expect(el.querySelector('.ex-tab[data-tab="learn"]')).toBeTruthy();
      expect(el.querySelector('.exercise-explanation')).toBeTruthy();
      expect(el.querySelector('.exercise-explanation').textContent).toContain('JSON_SERIALIZE');
    });

    it('does not show Learn tab without explanation', () => {
      const exercise = { id: '1.1', title: 'Test', description: '', code: 'x', codeType: 'sql' };
      const el = renderExercise(exercise, false);
      expect(el.querySelector('.ex-tab[data-tab="learn"]')).toBeNull();
    });

    it('shows step counter for step-through exercises', () => {
      const exercise = {
        id: '1.1',
        title: 'Test',
        description: '',
        code: 'SELECT 1; SELECT 2',
        codeType: 'sql',
        steps: [
          { label: 'First query', code: 'SELECT 1' },
          { label: 'Second query', code: 'SELECT 2' },
        ],
      };
      const el = renderExercise(exercise, false);
      expect(el.querySelector('.step-label')).toBeTruthy();
      expect(el.querySelector('.step-progress').textContent).toContain('Step 1 of 2');
      expect(el.querySelector('.btn-run').textContent).toContain('Run Step 1/2');
    });

    it('loads first step code in textarea for step exercises', () => {
      const exercise = {
        id: '1.1',
        title: 'Test',
        description: '',
        code: 'SELECT 1; SELECT 2',
        codeType: 'sql',
        steps: [
          { label: 'First', code: 'SELECT 1 FROM dual' },
          { label: 'Second', code: 'SELECT 2 FROM dual' },
        ],
      };
      const el = renderExercise(exercise, false);
      expect(el.querySelector('.exercise-textarea').value).toBe('SELECT 1 FROM dual');
    });
  });
});
