/**
 * Shared UI components — DOM builders for Oracle-branded elements.
 */

/**
 * Render the site header with Oracle branding.
 * @param {string|null} schemaName - Current user's schema, or null if not logged in
 * @returns {HTMLElement}
 */
function labReturnUrl() {
  const pos = sessionStorage.getItem('labPosition');
  if (pos) {
    const parts = pos.split(':');
    const mod = parts[0];
    const ex = parts[1];
    const subtab = parts[2] || '';
    let url = `/lab.html?module=${mod}&exercise=${ex}&preserveData`;
    if (subtab) url += `&subtab=${subtab}`;
    return url;
  }
  return '/lab.html?module=module-1';
}

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
        ${schemaName ? `<a href="/dashboard.html">Dashboard</a><a href="${labReturnUrl()}" class="labs-link">Labs</a><a href="/editor.html">Editor</a>` : ''}
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

  const hasSteps = exercise.steps && exercise.steps.length > 0;
  const hasExplanation = !!exercise.explanation;
  const initialCode = hasSteps ? exercise.steps[0].code : exercise.code;
  const lineCount = initialCode.split('\n').length;
  const rows = Math.max(4, Math.min(lineCount + 1, 20));

  // Step label for step-through exercises
  const stepLabel = hasSteps
    ? `<div class="step-label" data-step-index="0">
        <span class="step-progress">Step 1 of ${exercise.steps.length}</span>
        <span class="step-name">${escapeHtml(exercise.steps[0].label)}</span>
      </div>`
    : '';

  // Run button text
  const runBtnText = hasSteps ? `Run Step 1/${exercise.steps.length}` : 'Run';
  const runBtnClass = hasSteps ? 'btn-primary btn-run btn-step' : 'btn-primary btn-run';

  div.innerHTML = `
    <div class="exercise-header">
      <h4 class="exercise-title">
        ${isComplete ? '<span class="exercise-complete" aria-label="Complete">&#10003;</span>' : ''}
        Exercise ${exercise.id}: ${exercise.title}
      </h4>
      ${
        hasExplanation
          ? `<div class="exercise-tabs">
        <button class="ex-tab active" data-tab="code">Code</button>
        <button class="ex-tab" data-tab="learn">Learn</button>
      </div>`
          : ''
      }
    </div>
    ${exercise.description ? `<p class="exercise-desc">${exercise.description}</p>` : ''}
    ${hasExplanation ? `<div class="exercise-explanation" style="display:none;">${formatExplanation(exercise.explanation)}</div>` : ''}
    <div class="exercise-code-panel">
      ${stepLabel}
      <div class="code-block">
        <div class="code-toolbar">
          <span class="code-lang">${exercise.codeType}</span>
          <button class="btn-copy" data-code="${encodeURIComponent(exercise.code)}">Copy All</button>
          <button class="btn-reset" data-original="${encodeURIComponent(initialCode)}">Reset</button>
        </div>
        <textarea class="exercise-textarea" rows="${rows}" spellcheck="false" autocomplete="off" autocapitalize="off">${escapeHtml(initialCode)}</textarea>
      </div>
      <div class="exercise-actions">
        <button class="${runBtnClass}" data-exercise-id="${exercise.id}" data-total-steps="${hasSteps ? exercise.steps.length : 0}">${runBtnText}</button>
        <span class="check-result"></span>
      </div>
      <div class="exercise-result"></div>
    </div>
    ${exercise.checkpoint ? `<div class="exercise-checkpoint" style="display:none;">${escapeHtml(exercise.checkpoint)}</div>` : ''}
  `;

  // Store steps data on the element for the event handler
  if (hasSteps) {
    div.dataset.steps = JSON.stringify(exercise.steps);
  }

  return div;
}

function formatExplanation(text) {
  const sqlPattern = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|WITH|ALTER)\b/i;
  const mongoPattern = /^(db\.|show )/i;

  return text
    .replace(/`([^`]+)`/g, (_match, code) => {
      const safe = escapeHtml(code);
      const encoded = encodeURIComponent(code);
      if (sqlPattern.test(code)) {
        return `<code class="explain-code explain-sql">${safe}</code><button class="btn-editor" data-code="${encoded}" data-tab="sql">\u2192 Editor</button>`;
      }
      if (mongoPattern.test(code)) {
        return `<code class="explain-code explain-mongo">${safe}</code><button class="btn-editor" data-code="${encoded}" data-tab="mongo">\u2192 Editor</button>`;
      }
      return `<code class="explain-code">${safe}</code>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
