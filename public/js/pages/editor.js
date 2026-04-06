import { api } from '../api.js';
import { renderHeader } from '../components.js';
import { renderTable, renderJson, renderError, renderDml } from '../results.js';
import { addEntry, getEntries, clearHistory } from '../history.js';
import { TabManager } from '../editor-setup.js';

const tabManager = new TabManager();

/**
 * Light SQL formatter — adds line breaks before major clauses.
 */
function formatSql(sql) {
  // Keywords that start a new line (not indented)
  const majorClauses =
    /\b(SELECT|FROM|WHERE|ORDER\s+BY|GROUP\s+BY|HAVING|FETCH|LIMIT|UNION|INSERT\s+INTO|UPDATE|DELETE\s+FROM|SET|VALUES|COMMIT)\b/gi;
  // Keywords that start a new indented line
  const subClauses = /\b(AND|OR|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|CROSS\s+JOIN|ON)\b/gi;

  let result = sql.trim();
  // Add newline before major clauses (but not at the very start)
  result = result.replace(majorClauses, (m, _kw, offset) => (offset === 0 ? m : '\n' + m));
  // Add newline + indent before sub-clauses
  result = result.replace(subClauses, (m, _kw, offset) => (offset === 0 ? m : '\n  ' + m));
  return result;
}

/**
 * Execute a query based on the active tab type.
 * @param {string} tab - 'sql' | 'js' | 'mongo'
 * @param {string} content - query/code/command text
 * @returns {Promise<object>} API response
 */
export async function executeQuery(tab, content) {
  const method = tabManager.getApiMethod(tab);
  return api[method](content);
}

/**
 * Render a query result into a container element.
 * @param {object} result - API response
 * @returns {HTMLElement}
 */
export function renderResult(result) {
  const wrapper = document.createElement('div');
  wrapper.className = 'result-wrapper';

  if (result.error) {
    wrapper.appendChild(renderError(result.error));
  } else if (result.resultType === 'dml') {
    wrapper.appendChild(renderDml(result));
  } else if (result.resultType === 'json') {
    const rows = result.rows || [];
    const docs = rows.map((r) => r.DATA || r);
    wrapper.appendChild(renderJson(docs.length === 1 ? docs[0] : docs));
  } else if (result.resultType === 'tabular') {
    const cols = result.columns || [];
    const rows = result.rows || [];
    if (cols.length === 1 && rows.length > 0) {
      const firstVal = rows[0][cols[0]];
      if (typeof firstVal === 'string' && firstVal.trimStart().startsWith('{')) {
        const container = document.createElement('div');
        for (const row of rows) {
          const pre = document.createElement('pre');
          pre.className = 'json-result';
          pre.textContent = row[cols[0]];
          container.appendChild(pre);
        }
        wrapper.appendChild(container);
      } else {
        wrapper.appendChild(renderTable(cols, rows));
      }
    } else {
      wrapper.appendChild(renderTable(cols, rows));
    }
  } else if (result.output !== undefined) {
    // JS executor result
    wrapper.appendChild(renderJson(result.output));
    if (result.logs?.length) {
      const logsEl = document.createElement('pre');
      logsEl.className = 'json-result';
      logsEl.textContent = result.logs.join('\n');
      wrapper.appendChild(logsEl);
    }
  } else if (result.documents !== undefined) {
    // Mongo executor result
    wrapper.appendChild(renderJson(result.documents));
  } else {
    wrapper.appendChild(renderJson(result));
  }

  // Duration badge
  if (result.duration !== undefined) {
    const badge = document.createElement('div');
    badge.className = 'result-meta';
    const parts = [];
    if (result.rowCount !== undefined) parts.push(`${result.rowCount} rows`);
    if (result.rowsAffected !== undefined) parts.push(`${result.rowsAffected} affected`);
    parts.push(`${result.duration}ms`);
    badge.textContent = parts.join(' · ');
    wrapper.prepend(badge);
  }

  return wrapper;
}

// --- Page init (only runs in browser, not in test) ---
async function init() {
  const me = await api.getMe();
  if (!me) {
    window.location.href = '/';
    return;
  }

  document.getElementById('header').appendChild(renderHeader(me.schemaName));

  // Logout handler
  document.querySelector('.logout-link')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await api.logout();
    window.location.href = '/';
  });

  const editorArea = document.getElementById('editor-textarea');
  const resultsPanel = document.getElementById('results-panel');
  const executeBtn = document.getElementById('execute-btn');
  const clearBtn = document.getElementById('clear-btn');
  const historyList = document.getElementById('history-list');
  const historyToggle = document.getElementById('history-toggle');
  const historyPanel = document.getElementById('history-panel');
  const tabButtons = document.querySelectorAll('.tab-btn');

  // Set initial placeholder
  editorArea.placeholder = tabManager.getPlaceholder('sql');

  // Pre-load code from URL parameters (from "→ Editor" buttons in Learn tab)
  const params = new URLSearchParams(window.location.search);
  const preloadCode = params.get('code');
  const preloadTab = params.get('tab');
  if (preloadCode) {
    const targetTab =
      preloadTab && ['sql', 'js', 'mongo'].includes(preloadTab) ? preloadTab : 'sql';
    const formatted = targetTab === 'sql' ? formatSql(preloadCode) : preloadCode;
    tabManager.switchTab(targetTab);
    editorArea.value = formatted;
    tabManager.setContent(targetTab, formatted);
    editorArea.placeholder = tabManager.getPlaceholder(targetTab);
    tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === targetTab));
  }

  // Tab switching
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      // Save current content
      tabManager.setContent(tabManager.getActiveTab(), editorArea.value);
      // Switch
      tabManager.switchTab(tab);
      editorArea.value = tabManager.getContent(tab);
      editorArea.placeholder = tabManager.getPlaceholder(tab);
      // Update active tab UI
      tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    });
  });

  // Execute
  async function doExecute() {
    const tab = tabManager.getActiveTab();
    const content = editorArea.value.trim();
    if (!content) return;

    executeBtn.disabled = true;
    executeBtn.textContent = 'Running...';
    resultsPanel.innerHTML = '<div class="loading"><div class="spinner"></div> Executing...</div>';

    const result = await executeQuery(tab, content);

    executeBtn.disabled = false;
    executeBtn.textContent = 'Execute';

    resultsPanel.innerHTML = '';
    resultsPanel.appendChild(renderResult(result));

    // Add to history
    addEntry({
      query: content,
      type: tab,
      duration: result.duration,
      success: !result.error,
    });
    refreshHistory();
  }

  executeBtn.addEventListener('click', doExecute);

  // Ctrl+Enter / Cmd+Enter to execute
  editorArea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doExecute();
    }
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    editorArea.value = '';
    resultsPanel.innerHTML = '<div class="no-results">Results will appear here</div>';
  });

  // History toggle
  historyToggle?.addEventListener('click', () => {
    historyPanel.classList.toggle('collapsed');
    historyToggle.textContent = historyPanel.classList.contains('collapsed')
      ? 'History +'
      : 'History -';
  });

  // History clear
  document.getElementById('history-clear')?.addEventListener('click', () => {
    clearHistory();
    refreshHistory();
  });

  function refreshHistory() {
    const entries = getEntries();
    if (!historyList) return;
    historyList.innerHTML = '';
    if (entries.length === 0) {
      historyList.innerHTML = '<div class="no-results">No queries yet</div>';
      return;
    }
    for (const entry of entries.slice(0, 20)) {
      const item = document.createElement('div');
      item.className = `history-item ${entry.success ? '' : 'history-error'}`;
      item.innerHTML = `
        <span class="history-type">${entry.type}</span>
        <span class="history-query">${escapeHtml(entry.query.substring(0, 80))}${entry.query.length > 80 ? '...' : ''}</span>
        <span class="history-duration">${entry.duration || 0}ms</span>
      `;
      item.addEventListener('click', () => {
        // Switch to matching tab
        const targetTab = entry.type;
        tabManager.setContent(tabManager.getActiveTab(), editorArea.value);
        tabManager.switchTab(targetTab);
        tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === targetTab));
        editorArea.value = entry.query;
        editorArea.placeholder = tabManager.getPlaceholder(targetTab);
      });
      historyList.appendChild(item);
    }
  }

  refreshHistory();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Only init in browser (skip in test environment)
if (typeof document !== 'undefined' && document.getElementById('editor-textarea')) {
  init();
}
