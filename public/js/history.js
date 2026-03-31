/**
 * Query history — localStorage wrapper.
 * Stores last 50 queries with metadata.
 */

const STORAGE_KEY = 'queryHistory';
export const MAX_ENTRIES = 50;

/**
 * Get all history entries, newest first.
 * @returns {Array<{ query, type, timestamp, duration, success }>}
 */
export function getEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Add a query to history.
 * @param {{ query, type, duration, success }} entry
 */
export function addEntry(entry) {
  const entries = getEntries();
  entries.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/**
 * Clear all history.
 */
export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
