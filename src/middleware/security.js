/**
 * SQL security classifier and Express middleware.
 * Blocks dangerous DDL/DCL while allowing safe DML and workshop DDL.
 */

// Patterns that are always blocked (matched against normalized SQL)
const BLOCKED_PATTERNS = [
  { pattern: /\bDROP\s+USER\b/, label: 'DROP USER' },
  { pattern: /\bALTER\s+SYSTEM\b/, label: 'ALTER SYSTEM' },
  { pattern: /\bCREATE\s+DIRECTORY\b/, label: 'CREATE DIRECTORY' },
  { pattern: /\bGRANT\b.*\bTO\b/, label: 'GRANT ... TO' },
  { pattern: /\bREVOKE\b/, label: 'REVOKE' },
  { pattern: /\bCREATE\s+USER\b/, label: 'CREATE USER' },
  { pattern: /\bTRUNCATE\b/, label: 'TRUNCATE' },
];

// Whitelisted PL/SQL calls
const PLSQL_WHITELIST = [/\bCTX_DDL\.SYNC_INDEX\b/i];

/**
 * Strip string literals from SQL so content inside quotes doesn't trigger false positives.
 * Replaces 'anything' with '' (empty string literal placeholder).
 */
function stripStringLiterals(sql) {
  return sql.replace(/'[^']*'/g, "''");
}

/**
 * Check if SQL contains multiple statements separated by semicolons.
 * Ignores semicolons inside string literals and trailing semicolons.
 */
function hasMultipleStatements(sql) {
  const stripped = stripStringLiterals(sql).replace(/;\s*$/, '');
  return stripped.includes(';');
}

/**
 * Check if SQL contains suspicious content in comments.
 */
function hasSuspiciousComments(sql) {
  const comments = [];
  // Block comments
  const blockPattern = /\/\*[\s\S]*?\*\//g;
  let match;
  while ((match = blockPattern.exec(sql)) !== null) {
    comments.push(match[0]);
  }
  // Line comments
  const linePattern = /--.*$/gm;
  while ((match = linePattern.exec(sql)) !== null) {
    comments.push(match[0]);
  }

  const commentText = comments.join(' ').toUpperCase();
  return BLOCKED_PATTERNS.some((b) => b.pattern.test(commentText));
}

/**
 * Classify a SQL statement as allowed or blocked.
 * @param {string} sql - The SQL to classify
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function classifySQL(sql) {
  if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
    return { allowed: false, reason: 'Empty or invalid SQL' };
  }

  const trimmed = sql.trim();

  // Check for suspicious comments first
  if (hasSuspiciousComments(trimmed)) {
    return { allowed: false, reason: 'Blocked: suspicious content in SQL comments' };
  }

  // Strip string literals for pattern matching
  const normalized = stripStringLiterals(trimmed).toUpperCase();

  // Check PL/SQL blocks (BEGIN/DECLARE) before multi-statement check
  // since PL/SQL naturally contains semicolons
  if (/^\s*(BEGIN|DECLARE)\b/.test(normalized)) {
    const isWhitelisted = PLSQL_WHITELIST.some((wl) => wl.test(trimmed));
    if (!isWhitelisted) {
      return { allowed: false, reason: 'Blocked: PL/SQL blocks not allowed' };
    }
    return { allowed: true };
  }

  // Check for multiple statements (after PL/SQL check)
  if (hasMultipleStatements(trimmed)) {
    return { allowed: false, reason: 'Blocked: multiple statements not allowed' };
  }

  // Check blocked patterns
  for (const { pattern, label } of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return { allowed: false, reason: `Blocked: ${label} not allowed` };
    }
  }

  return { allowed: true };
}

/**
 * Express middleware that guards SQL endpoints.
 * Expects `req.body.sql` to contain the SQL statement.
 */
export function sqlGuard(req, res, next) {
  const { sql } = req.body || {};
  const result = classifySQL(sql);

  if (!result.allowed) {
    return res.status(403).json({ error: result.reason });
  }

  next();
}
