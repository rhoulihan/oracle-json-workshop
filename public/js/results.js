/**
 * Results renderer — creates DOM elements for query results.
 */

/**
 * Render a tabular result set.
 * @param {string[]} columns
 * @param {object[]} rows
 * @returns {HTMLElement}
 */
export function renderTable(columns, rows) {
  const table = document.createElement('table');
  table.className = 'results-table';

  if (rows.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'no-results';
    msg.textContent = 'No results returned';
    table.appendChild(msg);
    return table;
  }

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const col of columns) {
    const th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const col of columns) {
      const td = document.createElement('td');
      const val = row[col];
      td.textContent = val !== null && val !== undefined ? String(val) : '';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  return table;
}

/**
 * Render JSON data as formatted pre block.
 * @param {*} data
 * @returns {HTMLElement}
 */
export function renderJson(data) {
  const pre = document.createElement('pre');
  pre.className = 'json-result';
  pre.textContent = JSON.stringify(data, null, 2);
  return pre;
}

/**
 * Render an error message.
 * @param {string} message
 * @returns {HTMLElement}
 */
export function renderError(message) {
  const div = document.createElement('div');
  div.className = 'error-message';
  div.textContent = message;
  return div;
}

/**
 * Render a DML result (INSERT/UPDATE/DELETE).
 * @param {{ rowsAffected: number, duration: number }} result
 * @returns {HTMLElement}
 */
export function renderDml(result) {
  const div = document.createElement('div');
  div.className = 'dml-result';
  div.textContent = `${result.rowsAffected} row(s) affected in ${result.duration}ms`;
  return div;
}
