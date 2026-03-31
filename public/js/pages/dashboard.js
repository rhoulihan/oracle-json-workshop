import { api } from '../api.js';
import { renderHeader, renderModuleCard } from '../components.js';
import { calculateOverall, getModuleStatus } from '../progress.js';

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

  // Fetch data
  const [modules, progress] = await Promise.all([api.getModules(), api.getProgress()]);

  // Overall progress
  const overall = calculateOverall(progress, modules);
  document.getElementById('progress-pct').textContent = `${overall}%`;
  document.getElementById('progress-fill').style.width = `${overall}%`;

  // Render module cards
  const grid = document.getElementById('module-grid');
  grid.innerHTML = '';

  for (const mod of modules) {
    const status = getModuleStatus(progress, mod.id, mod.exerciseCount);
    const card = renderModuleCard(mod, status);
    grid.appendChild(card);
  }
}

init();
