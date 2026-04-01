/**
 * SQL statement splitter.
 * Splits multi-statement SQL on semicolons, respecting string literals and comments.
 */

/**
 * Split a SQL string into individual statements.
 * @param {string} sql
 * @returns {string[]} Array of trimmed, non-empty statements
 */
export function splitStatements(sql) {
  if (!sql || !sql.trim()) return [];

  // Remove block comments
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Remove line comments
  cleaned = cleaned.replace(/--.*$/gm, '');

  const statements = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      // Check for escaped quote ('')
      if (cleaned[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inString = false;
        current += ch;
      }
    } else if (ch === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }

  // Last statement (no trailing semicolon)
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}
