import { api } from '../api.js';
import { renderHeader, renderExercise } from '../components.js';
import { isExerciseComplete } from '../progress.js';
import { runExercise } from '../exercise-runner.js';
import { StepRunner } from '../step-runner.js';
import { renderTable, renderJson, renderError, renderDml } from '../results.js';

// Map of exercise ID → StepRunner instance (for step-through exercises)
const stepRunners = new Map();

/**
 * Render a single query result into a DOM element.
 */
function renderOneResult(r) {
  if (r.error) return renderError(r.error);
  if (r.resultType === 'dml') return renderDml(r);
  if (r.resultType === 'json') {
    const docs = (r.rows || []).map((row) => row.DATA || row);
    return renderJson(docs.length === 1 ? docs[0] : docs);
  }
  if (r.resultType === 'tabular') {
    // Detect single-column JSON text results (e.g., json_serialize PRETTY)
    const cols = r.columns || [];
    const rows = r.rows || [];
    if (cols.length === 1 && rows.length > 0) {
      const firstVal = rows[0][cols[0]];
      if (typeof firstVal === 'string' && firstVal.trimStart().startsWith('{')) {
        // Render as pretty-printed JSON text blocks
        const container = document.createElement('div');
        for (const row of rows) {
          const pre = document.createElement('pre');
          pre.className = 'json-result';
          pre.textContent = row[cols[0]];
          container.appendChild(pre);
        }
        return container;
      }
    }
    return renderTable(cols, rows);
  }
  if (r.output !== undefined) return renderJson(r.output);
  if (r.documents !== undefined) return renderJson(r.documents);
  return renderJson(r);
}

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

  // Get module ID and options from URL
  const params = new URLSearchParams(window.location.search);
  const moduleId = params.get('module');
  const preserveData = params.has('preserveData');

  if (!moduleId) {
    window.location.href = '/dashboard.html';
    return;
  }

  // Reset workspace to fresh state unless preserveData is set
  if (!preserveData) {
    const labContent = document.getElementById('lab-content');
    labContent.innerHTML =
      '<div class="loading"><div class="spinner"></div> Resetting workspace to fresh state...</div>';
    await api.resetWorkspace();
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

  // Introduction (detailed module overview)
  if (mod.introduction) {
    const intro = document.createElement('div');
    intro.className = 'lab-introduction';
    // Render paragraphs and [diagram]...[/diagram] blocks
    intro.innerHTML = mod.introduction
      .replace(/\[diagram\]([\s\S]*?)\[\/diagram\]/g, '</p><pre class="intro-diagram">$1</pre><p>')
      .split('\n\n')
      .map((p) => {
        if (p.includes('<pre class="intro-diagram">')) return p;
        return `<p>${p}</p>`;
      })
      .join('');
    intro.id = 'lab-introduction';
    content.appendChild(intro);
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
    // Hide introduction when exercises are shown
    const introEl = document.getElementById('lab-introduction');
    if (introEl) introEl.style.display = 'none';

    // Exercise tab bar
    const exerciseTabBar = document.createElement('div');
    exerciseTabBar.className = 'exercise-tab-bar';
    for (let i = 0; i < mod.exercises.length; i++) {
      const ex = mod.exercises[i];
      const complete = isExerciseComplete(progress, moduleId, ex.id);
      const tab = document.createElement('button');
      tab.className = `exercise-tab ${i === 0 ? 'active' : ''}`;
      tab.dataset.exerciseIndex = String(i);
      tab.innerHTML = `${complete ? '<span class="tab-check">&#10003;</span>' : ''}${ex.id}`;
      tab.title = ex.title;
      exerciseTabBar.appendChild(tab);
    }
    content.appendChild(exerciseTabBar);

    // Exercise panels container
    const panelsContainer = document.createElement('div');
    panelsContainer.className = 'exercise-panels';
    for (let i = 0; i < mod.exercises.length; i++) {
      const exercise = mod.exercises[i];
      const complete = isExerciseComplete(progress, moduleId, exercise.id);
      const el = renderExercise(exercise, complete);
      el.style.display = i === 0 ? '' : 'none';
      el.dataset.panelIndex = String(i);
      panelsContainer.appendChild(el);
    }
    content.appendChild(panelsContainer);

    // Tab switching
    exerciseTabBar.addEventListener('click', (e) => {
      const tab = e.target.closest('.exercise-tab');
      if (!tab) return;
      const idx = tab.dataset.exerciseIndex;
      exerciseTabBar.querySelectorAll('.exercise-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      panelsContainer.querySelectorAll('.exercise').forEach((p) => {
        p.style.display = p.dataset.panelIndex === idx ? '' : 'none';
      });
    });
  }

  // Checkpoint — hidden until all exercises complete
  if (mod.checkpoint && mod.exercises.length > 0) {
    const cp = document.createElement('div');
    cp.className = 'lab-checkpoint';
    cp.style.display = 'none';
    cp.id = 'module-checkpoint';
    cp.textContent = mod.checkpoint;
    content.appendChild(cp);
  }

  // Track which exercises have had all their code fully executed
  const exercisesRun = new Set();

  function markExerciseRun(exerciseId) {
    exercisesRun.add(exerciseId);

    // Show per-exercise checkpoint
    const exerciseEl = content.querySelector(`.exercise[data-exercise-id="${exerciseId}"]`);
    if (exerciseEl) {
      const cp = exerciseEl.querySelector('.exercise-checkpoint');
      if (cp) cp.style.display = '';
    }

    // Show module checkpoint if ALL exercises have been run
    if (exercisesRun.size === mod.exercises.length) {
      const checkpoint = document.getElementById('module-checkpoint');
      if (checkpoint) checkpoint.style.display = '';
    }
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

  // Helper: mark exercise as complete in the UI + update tab checkmark
  function markExerciseComplete(exerciseEl, statusEl, message) {
    statusEl.textContent = message;
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

    // Update tab checkmark
    const panelIndex = exerciseEl.dataset.panelIndex;
    const tab = content.querySelector(`.exercise-tab[data-exercise-index="${panelIndex}"]`);
    if (tab && !tab.querySelector('.tab-check')) {
      const tabCheck = document.createElement('span');
      tabCheck.className = 'tab-check';
      tabCheck.innerHTML = '&#10003;';
      tab.prepend(tabCheck);
    }
  }

  // Event delegation for exercise actions
  content.addEventListener('click', async (e) => {
    // Tab switching (Code / Learn)
    if (e.target.classList.contains('ex-tab')) {
      const exerciseEl = e.target.closest('.exercise');
      const tab = e.target.dataset.tab;
      exerciseEl
        .querySelectorAll('.ex-tab')
        .forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
      const codePanel = exerciseEl.querySelector('.exercise-code-panel');
      const learnPanel = exerciseEl.querySelector('.exercise-explanation');
      if (codePanel) codePanel.style.display = tab === 'code' ? '' : 'none';
      if (learnPanel) learnPanel.style.display = tab === 'learn' ? '' : 'none';
      return;
    }

    // Run / Run Step button
    if (e.target.classList.contains('btn-run')) {
      const exerciseEl = e.target.closest('.exercise');
      const exerciseId = e.target.dataset.exerciseId;
      const codeType = exerciseEl.dataset.codeType;
      const textarea = exerciseEl.querySelector('.exercise-textarea');
      const resultContainer = exerciseEl.querySelector('.exercise-result');
      const statusEl = e.target.closest('.exercise-actions').querySelector('.check-result');
      const totalSteps = parseInt(e.target.dataset.totalSteps || '0', 10);

      // Step-through mode
      if (totalSteps > 0) {
        // Initialize StepRunner on first click
        if (!stepRunners.has(exerciseId)) {
          const steps = JSON.parse(exerciseEl.dataset.steps);
          stepRunners.set(exerciseId, new StepRunner(steps, codeType));
        }
        const runner = stepRunners.get(exerciseId);

        if (runner.isComplete()) {
          // Reset for re-run
          runner.reset();
          resultContainer.innerHTML = '';
          const firstStep = runner.getCurrentStep();
          textarea.value = firstStep.code;
          const stepLabel = exerciseEl.querySelector('.step-label');
          if (stepLabel) {
            stepLabel.querySelector('.step-progress').textContent = runner.getProgress();
            stepLabel.querySelector('.step-name').textContent = firstStep.label;
          }
          e.target.textContent = `Run Step 1/${totalSteps}`;
          statusEl.textContent = '';
          statusEl.className = 'check-result';
          return;
        }

        e.target.disabled = true;
        e.target.textContent = 'Running...';

        const result = await runner.executeNext();

        e.target.disabled = false;

        // Clear previous result and show current
        resultContainer.innerHTML = '';
        if (result) {
          if (result.error) {
            resultContainer.appendChild(renderError(result.error));
            statusEl.textContent = `Error (${result.duration || 0}ms)`;
            statusEl.className = 'check-result failure';
          } else {
            resultContainer.appendChild(renderOneResult(result));
          }
        }

        if (runner.isComplete()) {
          e.target.textContent = 'Run Again';
          markExerciseRun(exerciseId);
          // Auto-validate
          const validation = await api.checkExercise(moduleId, exerciseId);
          if (validation.valid) {
            markExerciseComplete(exerciseEl, statusEl, validation.message);
          }
        } else {
          // Advance to next step
          const nextStep = runner.getCurrentStep();
          textarea.value = nextStep.code;
          const idx = runner.getStepIndex();
          e.target.textContent = `Run Step ${idx + 1}/${totalSteps}`;
          const stepLabel = exerciseEl.querySelector('.step-label');
          if (stepLabel) {
            stepLabel.querySelector('.step-progress').textContent = runner.getProgress();
            stepLabel.querySelector('.step-name').textContent = nextStep.label;
          }
        }
        return;
      }

      // Single-run mode (no steps)
      const code = textarea.value.trim();
      if (!code) return;

      e.target.disabled = true;
      e.target.textContent = 'Running...';
      statusEl.textContent = '';
      statusEl.className = 'check-result';
      resultContainer.innerHTML =
        '<div class="loading"><div class="spinner"></div> Executing...</div>';

      const { results, error, totalDuration } = await runExercise(codeType, code);

      e.target.disabled = false;
      e.target.textContent = 'Run';
      resultContainer.innerHTML = '';

      if (error) {
        for (const r of results) {
          if (!r.error) resultContainer.appendChild(renderOneResult(r));
        }
        resultContainer.appendChild(renderError(error));
        statusEl.textContent = `Error (${totalDuration}ms)`;
        statusEl.className = 'check-result failure';
      } else if (results.length > 0) {
        for (const r of results) {
          resultContainer.appendChild(renderOneResult(r));
        }
        const meta = document.createElement('div');
        meta.className = 'result-meta';
        meta.textContent = `${results.length} statement${results.length > 1 ? 's' : ''} · ${totalDuration}ms`;
        resultContainer.prepend(meta);

        markExerciseRun(exerciseId);
        const validation = await api.checkExercise(moduleId, exerciseId);
        if (validation.valid) {
          markExerciseComplete(exerciseEl, statusEl, validation.message);
        }
      }
    }

    // Copy button
    if (e.target.classList.contains('btn-copy')) {
      const code = decodeURIComponent(e.target.dataset.code);
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
      const original = e.target.textContent;
      e.target.textContent = 'Copied!';
      setTimeout(() => {
        e.target.textContent = original;
      }, 1500);
    }

    // Reset button
    if (e.target.classList.contains('btn-reset')) {
      const exerciseEl = e.target.closest('.exercise');
      const exerciseId = exerciseEl.dataset.exerciseId;
      const textarea = exerciseEl.querySelector('.exercise-textarea');
      const original = decodeURIComponent(e.target.dataset.original);
      if (textarea) textarea.value = original;
      // Reset step runner if exists
      if (stepRunners.has(exerciseId)) {
        const runner = stepRunners.get(exerciseId);
        runner.reset();
        const resultContainer = exerciseEl.querySelector('.exercise-result');
        resultContainer.innerHTML = '';
        const btn = exerciseEl.querySelector('.btn-run');
        const totalSteps = parseInt(btn.dataset.totalSteps || '0', 10);
        if (totalSteps > 0) {
          btn.textContent = `Run Step 1/${totalSteps}`;
          const stepLabel = exerciseEl.querySelector('.step-label');
          if (stepLabel) {
            stepLabel.querySelector('.step-progress').textContent = runner.getProgress();
            stepLabel.querySelector('.step-name').textContent = runner.getCurrentStep().label;
          }
        }
      }
    }
  });
}

init();
