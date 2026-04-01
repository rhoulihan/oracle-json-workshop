import { api } from '../api.js';
import { renderHeader, renderExercise } from '../components.js';
import { isExerciseComplete } from '../progress.js';
import { runExercise } from '../exercise-runner.js';
import { renderTable, renderJson, renderError, renderDml } from '../results.js';

async function init() {
  // Auth guard
  const me = await api.getMe();
  if (!me) {
    window.location.href = '/';
    return;
  }

  document.getElementById('header').appendChild(renderHeader(me.schemaName));

  // Attach logout handler
  document.querySelector('.logout-link')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await api.logout();
    window.location.href = '/';
  });

  // Get module ID from URL
  const params = new URLSearchParams(window.location.search);
  const moduleId = params.get('module');

  if (!moduleId) {
    window.location.href = '/dashboard.html';
    return;
  }

  // Fetch module and progress
  const [mod, progress, modules] = await Promise.all([
    api.getModule(moduleId),
    api.getProgress(),
    api.getModules(),
  ]);

  if (mod.error) {
    document.getElementById('lab-content').innerHTML = `
      <div class="error-message">Module not found: ${moduleId}</div>
      <p style="margin-top:16px;"><a href="/dashboard.html">Back to Dashboard</a></p>
    `;
    return;
  }

  // Update page title
  document.title = `${mod.title} — Oracle JSON Workshop`;

  // Find prev/next modules
  const moduleIndex = modules.findIndex((m) => m.id === moduleId);
  const prevModule = moduleIndex > 0 ? modules[moduleIndex - 1] : null;
  const nextModule = moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : null;

  // Render lab content
  const content = document.getElementById('lab-content');
  content.innerHTML = '';

  // Breadcrumb
  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'lab-breadcrumb';
  breadcrumb.innerHTML = `<a href="/dashboard.html">Dashboard</a> / ${mod.title}`;
  content.appendChild(breadcrumb);

  // Title
  const title = document.createElement('h1');
  title.className = 'lab-title';
  title.textContent = mod.title;
  content.appendChild(title);

  // Description
  if (mod.description) {
    const desc = document.createElement('p');
    desc.className = 'lab-description';
    desc.textContent = mod.description;
    content.appendChild(desc);
  }

  // Exercises
  if (mod.exercises.length === 0) {
    // Read-only module (Module 0)
    if (mod.checkpoint) {
      const cp = document.createElement('div');
      cp.className = 'lab-checkpoint';
      cp.textContent = mod.checkpoint;
      content.appendChild(cp);
    }
  } else {
    for (const exercise of mod.exercises) {
      const complete = isExerciseComplete(progress, moduleId, exercise.id);
      const el = renderExercise(exercise, complete);
      content.appendChild(el);
    }
  }

  // Checkpoint (if exercises exist)
  if (mod.checkpoint && mod.exercises.length > 0) {
    const cp = document.createElement('div');
    cp.className = 'lab-checkpoint';
    cp.textContent = mod.checkpoint;
    content.appendChild(cp);
  }

  // Navigation
  const nav = document.createElement('div');
  nav.className = 'lab-nav';
  nav.innerHTML = `
    ${prevModule ? `<a href="/lab.html?module=${prevModule.id}" class="btn-secondary">&larr; ${prevModule.title}</a>` : '<span></span>'}
    <a href="/dashboard.html" class="btn-secondary">Dashboard</a>
    ${nextModule ? `<a href="/lab.html?module=${nextModule.id}" class="btn-secondary">${nextModule.title} &rarr;</a>` : '<span></span>'}
  `;
  content.appendChild(nav);

  // Event delegation for exercise actions
  content.addEventListener('click', async (e) => {
    // Run button — execute code inline and auto-validate
    if (e.target.classList.contains('btn-run')) {
      const exerciseEl = e.target.closest('.exercise');
      const exerciseId = e.target.dataset.exerciseId;
      const codeType = exerciseEl.dataset.codeType;
      const textarea = exerciseEl.querySelector('.exercise-textarea');
      const resultContainer = exerciseEl.querySelector('.exercise-result');
      const statusEl = e.target.closest('.exercise-actions').querySelector('.check-result');
      const code = textarea.value.trim();

      if (!code) return;

      e.target.disabled = true;
      e.target.textContent = 'Running...';
      statusEl.textContent = '';
      statusEl.className = 'check-result';
      resultContainer.innerHTML =
        '<div class="loading"><div class="spinner"></div> Executing...</div>';

      const { finalResult, error, totalDuration } = await runExercise(codeType, code);

      e.target.disabled = false;
      e.target.textContent = 'Run';
      resultContainer.innerHTML = '';

      if (error) {
        resultContainer.appendChild(renderError(error));
        statusEl.textContent = `Error (${totalDuration}ms)`;
        statusEl.className = 'check-result failure';
      } else if (finalResult) {
        // Render the final result
        if (finalResult.resultType === 'dml') {
          resultContainer.appendChild(renderDml(finalResult));
        } else if (finalResult.resultType === 'json') {
          const docs = (finalResult.rows || []).map((r) => r.DATA || r);
          resultContainer.appendChild(renderJson(docs.length === 1 ? docs[0] : docs));
        } else if (finalResult.resultType === 'tabular') {
          resultContainer.appendChild(
            renderTable(finalResult.columns || [], finalResult.rows || []),
          );
        } else if (finalResult.output !== undefined) {
          resultContainer.appendChild(renderJson(finalResult.output));
        } else if (finalResult.documents !== undefined) {
          resultContainer.appendChild(renderJson(finalResult.documents));
        } else {
          resultContainer.appendChild(renderJson(finalResult));
        }

        // Show duration
        const meta = document.createElement('div');
        meta.className = 'result-meta';
        const parts = [];
        if (finalResult.rowCount !== undefined) parts.push(`${finalResult.rowCount} rows`);
        if (finalResult.rowsAffected !== undefined)
          parts.push(`${finalResult.rowsAffected} affected`);
        parts.push(`${totalDuration}ms`);
        meta.textContent = parts.join(' · ');
        resultContainer.prepend(meta);

        // Auto-validate silently
        const validation = await api.checkExercise(moduleId, exerciseId);
        if (validation.valid) {
          statusEl.textContent = validation.message;
          statusEl.className = 'check-result success';
          if (!exerciseEl.querySelector('.exercise-complete')) {
            const titleEl = exerciseEl.querySelector('.exercise-title');
            const check = document.createElement('span');
            check.className = 'exercise-complete';
            check.setAttribute('aria-label', 'Complete');
            check.innerHTML = '&#10003;';
            titleEl.prepend(check);
            exerciseEl.classList.add('exercise-done');
          }
        }
      }
    }

    // Copy button
    if (e.target.classList.contains('btn-copy')) {
      const exerciseEl = e.target.closest('.exercise');
      const textarea = exerciseEl.querySelector('.exercise-textarea');
      const code = textarea ? textarea.value : decodeURIComponent(e.target.dataset.code);
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      e.target.textContent = 'Copied!';
      setTimeout(() => {
        e.target.textContent = 'Copy';
      }, 1500);
    }

    // Reset button — restore original code
    if (e.target.classList.contains('btn-reset')) {
      const exerciseEl = e.target.closest('.exercise');
      const textarea = exerciseEl.querySelector('.exercise-textarea');
      const original = decodeURIComponent(e.target.dataset.original);
      if (textarea) textarea.value = original;
    }
  });
}

init();
