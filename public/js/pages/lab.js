import { api } from '../api.js';
import { renderHeader, renderExercise } from '../components.js';
import { isExerciseComplete } from '../progress.js';

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
    // Copy button
    if (e.target.classList.contains('btn-copy')) {
      const code = decodeURIComponent(e.target.dataset.code);
      try {
        await navigator.clipboard.writeText(code);
        const original = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => {
          e.target.textContent = original;
        }, 1500);
      } catch {
        // Fallback for non-HTTPS
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        e.target.textContent = 'Copied!';
        setTimeout(() => {
          e.target.textContent = 'Copy';
        }, 1500);
      }
    }

    // Check Answer button
    if (e.target.classList.contains('btn-check')) {
      const exerciseId = e.target.dataset.exerciseId;
      const resultEl = e.target.closest('.exercise-actions').querySelector('.check-result');

      e.target.disabled = true;
      e.target.textContent = 'Checking...';
      resultEl.textContent = '';
      resultEl.className = 'check-result';

      const result = await api.checkExercise(moduleId, exerciseId);

      e.target.disabled = false;
      e.target.textContent = 'Check Answer';

      if (result.valid) {
        resultEl.textContent = result.message;
        resultEl.className = 'check-result success';

        // Add checkmark to exercise header
        const exercise = e.target.closest('.exercise');
        if (!exercise.querySelector('.exercise-complete')) {
          const titleEl = exercise.querySelector('.exercise-title');
          const check = document.createElement('span');
          check.className = 'exercise-complete';
          check.setAttribute('aria-label', 'Complete');
          check.innerHTML = '&#10003;';
          titleEl.prepend(check);
          exercise.classList.add('exercise-done');
        }
      } else {
        resultEl.textContent = result.message || 'Not yet complete';
        resultEl.className = 'check-result failure';
      }
    }
  });
}

init();
