/**
 * Shared UI components — DOM builders for Oracle-branded elements.
 */

/**
 * Render the site header with Oracle branding.
 * @param {string|null} schemaName - Current user's schema, or null if not logged in
 * @returns {HTMLElement}
 */
export function renderHeader(schemaName) {
  const header = document.createElement('header');
  header.className = 'site-header';

  header.innerHTML = `
    <div class="header-inner">
      <a href="/" class="header-logo">
        <img src="/img/oracle-logo.svg" alt="Oracle" height="20">
        <span class="header-title">JSON Workshop</span>
      </a>
      <nav class="header-nav">
        ${schemaName ? `<a href="/dashboard.html">Dashboard</a><a href="/lab.html?module=module-1">Labs</a><a href="/editor.html">Editor</a>` : ''}
      </nav>
      <div class="header-user">
        ${schemaName ? `<span class="schema-badge">${schemaName}</span><a href="#" class="logout-link">Logout</a>` : ''}
      </div>
    </div>
  `;

  return header;
}

/**
 * Render a module card for the dashboard.
 * @param {object} module - { id, title, estimatedTime, exerciseCount }
 * @param {{ completed, total, percentage }} status
 * @returns {HTMLElement}
 */
export function renderModuleCard(module, status) {
  const card = document.createElement('a');
  card.className = 'module-card';
  card.href = `/lab.html?module=${module.id}`;

  const statusClass =
    status.percentage === 100 ? 'complete' : status.percentage > 0 ? 'in-progress' : 'not-started';

  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${module.title}</h3>
      <span class="card-time">${module.estimatedTime} min</span>
    </div>
    <div class="card-progress">
      ${renderProgressBar(status.percentage).outerHTML}
      <span class="card-status ${statusClass}">${status.completed}/${status.total} exercises &middot; ${status.percentage}%</span>
    </div>
  `;

  return card;
}

/**
 * Render a progress bar.
 * @param {number} percentage - 0-100
 * @returns {HTMLElement}
 */
export function renderProgressBar(percentage) {
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuenow', String(percentage));
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');

  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = `${percentage}%`;
  bar.appendChild(fill);

  return bar;
}

/**
 * Render an exercise block with code, description, and action buttons.
 * @param {object} exercise - { id, title, description, code, codeType }
 * @param {boolean} isComplete
 * @returns {HTMLElement}
 */
export function renderExercise(exercise, isComplete) {
  const div = document.createElement('div');
  div.className = `exercise ${isComplete ? 'exercise-done' : ''}`;
  div.dataset.exerciseId = exercise.id;
  div.dataset.codeType = exercise.codeType;

  const lineCount = exercise.code.split('\n').length;
  const rows = Math.max(4, Math.min(lineCount + 1, 20));

  div.innerHTML = `
    <div class="exercise-header">
      <h4 class="exercise-title">
        ${isComplete ? '<span class="exercise-complete" aria-label="Complete">&#10003;</span>' : ''}
        Exercise ${exercise.id}: ${exercise.title}
      </h4>
    </div>
    ${exercise.description ? `<p class="exercise-desc">${exercise.description}</p>` : ''}
    <div class="code-block">
      <div class="code-toolbar">
        <span class="code-lang">${exercise.codeType}</span>
        <button class="btn-copy" data-code="${encodeURIComponent(exercise.code)}">Copy</button>
        <button class="btn-reset" data-original="${encodeURIComponent(exercise.code)}">Reset</button>
      </div>
      <textarea class="exercise-textarea" rows="${rows}" spellcheck="false" autocomplete="off" autocapitalize="off">${escapeHtml(exercise.code)}</textarea>
    </div>
    <div class="exercise-actions">
      <button class="btn-primary btn-run" data-exercise-id="${exercise.id}">Run</button>
      <span class="check-result"></span>
    </div>
    <div class="exercise-result"></div>
  `;

  return div;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
