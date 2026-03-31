import { api } from '../api.js';
import { renderHeader } from '../components.js';
import { getModuleStatus } from '../progress.js';

/**
 * Format an ISO timestamp for display.
 * @param {string|null} ts
 * @returns {string}
 */
export function formatTimestamp(ts) {
  if (!ts) return '\u2014';
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

/**
 * Render the workspace table.
 * @param {Array} workspaces
 * @returns {HTMLElement}
 */
export function renderWorkspaceTable(workspaces) {
  const table = document.createElement('table');
  table.className = 'admin-table';

  if (workspaces.length === 0) {
    table.innerHTML = '<tr><td class="no-results" colspan="6">No active workspaces</td></tr>';
    return table;
  }

  table.innerHTML = `
    <thead>
      <tr>
        <th>Schema</th>
        <th>Name</th>
        <th>Email</th>
        <th>Status</th>
        <th>Created</th>
        <th></th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  for (const ws of workspaces) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${ws.schemaName}</td>
      <td>${ws.displayName || '\u2014'}</td>
      <td>${ws.email || '\u2014'}</td>
      <td><span class="status-badge status-${ws.status}">${ws.status}</span></td>
      <td class="text-muted">${formatTimestamp(ws.createdAt)}</td>
      <td><button class="btn-teardown" data-schema="${ws.schemaName}">Teardown</button></td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  return table;
}

/**
 * Render a progress heatmap grid.
 * @param {Array} workspaces
 * @param {Array} modules - Module list with exerciseCount
 * @returns {HTMLElement}
 */
export function renderHeatmap(workspaces, modules) {
  const grid = document.createElement('div');
  grid.className = 'heatmap';

  // Only show modules with exercises
  const exerciseModules = modules.filter((m) => m.exerciseCount > 0);

  // Header
  const header = document.createElement('div');
  header.className = 'heatmap-row heatmap-header';
  header.innerHTML = `<div class="heatmap-label"></div>`;
  for (const mod of exerciseModules) {
    header.innerHTML += `<div class="heatmap-col-label" title="${mod.title}">M${mod.id.split('-')[1]}</div>`;
  }
  grid.appendChild(header);

  // User rows
  for (const ws of workspaces) {
    const row = document.createElement('div');
    row.className = 'heatmap-row';
    row.innerHTML = `<div class="heatmap-label" title="${ws.schemaName}">${ws.displayName || ws.schemaName}</div>`;

    for (const mod of exerciseModules) {
      const status = getModuleStatus(ws.progress || {}, mod.id, mod.exerciseCount);
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.title = `${mod.title}: ${status.completed}/${status.total}`;

      if (status.percentage === 100) {
        cell.classList.add('heatmap-complete');
      } else if (status.percentage > 0) {
        cell.classList.add('heatmap-partial');
        cell.style.opacity = 0.4 + (status.percentage / 100) * 0.6;
      }

      row.appendChild(cell);
    }
    grid.appendChild(row);
  }

  return grid;
}

// --- Page init ---
async function init() {
  const loginSection = document.getElementById('admin-login');
  const dashSection = document.getElementById('admin-dashboard');
  if (!loginSection) return; // not in browser

  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const tableContainer = document.getElementById('workspace-table');
  const heatmapContainer = document.getElementById('heatmap');
  const countEl = document.getElementById('workspace-count');
  const teardownAllBtn = document.getElementById('teardown-all-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');

  // Check if already admin-authenticated by trying to fetch workspaces
  // The raw response includes { workspaces: [...] } on success or { error: ... } on 403
  const checkRes = await api.get('/api/admin/workspaces');
  if (checkRes.workspaces) {
    await showDashboard();
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.innerHTML = '';
    const password = document.getElementById('admin-password').value;

    const result = await api.adminLogin(password);
    if (result.error || !result.ok) {
      loginError.innerHTML = `<div class="error-message">${result.error || 'Invalid password'}</div>`;
      return;
    }

    const ws = await api.getWorkspaces();
    showDashboard(ws);
  });

  async function showDashboard() {
    loginSection.style.display = 'none';
    dashSection.style.display = 'block';

    // Render header
    const headerEl = document.getElementById('header');
    if (headerEl && !headerEl.hasChildNodes()) {
      const header = renderHeader(null);
      // Override nav for admin
      const nav = header.querySelector('.header-nav');
      if (nav) nav.innerHTML = '<a href="/admin.html">Admin Dashboard</a>';
      const user = header.querySelector('.header-user');
      if (user) user.innerHTML = '<span class="schema-badge">INSTRUCTOR</span>';
      headerEl.appendChild(header);
    }

    await refreshWorkspaces();

    // Auto-refresh every 15 seconds
    setInterval(refreshWorkspaces, 15000);
  }

  // Module definitions for heatmap (hardcoded to avoid requiring user auth)
  const MODULES = [
    { id: 'module-0', title: 'The Big Picture', exerciseCount: 0 },
    { id: 'module-1', title: 'JSON Collections', exerciseCount: 6 },
    { id: 'module-2', title: 'Duality Views', exerciseCount: 7 },
    { id: 'module-3', title: 'Single-Table Design', exerciseCount: 5 },
    { id: 'module-4', title: 'Hybrid Queries', exerciseCount: 4 },
    { id: 'module-5', title: 'Multi-Protocol', exerciseCount: 2 },
  ];

  async function refreshWorkspaces() {
    const workspaces = await api.getWorkspaces();

    countEl.textContent = `${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`;

    // Table
    tableContainer.innerHTML = '';
    tableContainer.appendChild(renderWorkspaceTable(workspaces));

    // Heatmap
    heatmapContainer.innerHTML = '';
    if (workspaces.length > 0) {
      heatmapContainer.appendChild(renderHeatmap(workspaces, MODULES));
    }

    // Attach teardown handlers
    tableContainer.querySelectorAll('.btn-teardown').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const schema = btn.dataset.schema;
        if (!confirm(`Tear down workspace ${schema}? This cannot be undone.`)) return;
        btn.disabled = true;
        btn.textContent = '...';
        await api.teardownWorkspace(schema);
        await refreshWorkspaces();
      });
    });
  }

  // Tear down all
  teardownAllBtn?.addEventListener('click', async () => {
    if (!confirm('Tear down ALL workspaces? This cannot be undone.')) return;
    teardownAllBtn.disabled = true;
    teardownAllBtn.textContent = 'Tearing down...';
    await api.teardownAll();
    teardownAllBtn.disabled = false;
    teardownAllBtn.textContent = 'Tear Down All';
    await refreshWorkspaces();
  });

  // Logout
  logoutBtn?.addEventListener('click', async () => {
    await api.adminLogout();
    dashSection.style.display = 'none';
    loginSection.style.display = 'block';
  });
}

init();
