/**
 * Exercise answer validator.
 * Runs a validation query and compares the result against an expected pattern.
 */

const PATTERN_TYPES = {
  rowCount: /^rowCount:(>=?|<=?|=)?(\d+)$/,
  exact: /^exact:(.+)$/,
  contains: /^contains:(.+)$/,
  columnExists: /^columnExists:(\w+)$/,
};

export class Validator {
  /**
   * Parse a pattern string into a structured descriptor.
   * @param {string} pattern
   * @returns {{ type: string, ... } | null}
   */
  parsePattern(pattern) {
    if (!pattern) return null;

    const rowMatch = pattern.match(PATTERN_TYPES.rowCount);
    if (rowMatch) {
      const op = rowMatch[1] || '=';
      const value = parseInt(rowMatch[2], 10);
      return { type: 'rowCount', op, value };
    }

    const exactMatch = pattern.match(PATTERN_TYPES.exact);
    if (exactMatch) {
      try {
        const expected = JSON.parse(exactMatch[1]);
        return { type: 'exact', expected };
      } catch {
        return null;
      }
    }

    const containsMatch = pattern.match(PATTERN_TYPES.contains);
    if (containsMatch) {
      return { type: 'contains', value: containsMatch[1] };
    }

    const colMatch = pattern.match(PATTERN_TYPES.columnExists);
    if (colMatch) {
      return { type: 'columnExists', column: colMatch[1] };
    }

    return null;
  }

  /**
   * Validate by running a query and checking the result against a pattern.
   * @param {object} conn - Database connection
   * @param {string} validationQuery - SQL to execute
   * @param {string} expectedPattern - Pattern string
   * @returns {Promise<{ valid: boolean, message: string }>}
   */
  async validate(conn, validationQuery, expectedPattern) {
    const parsed = this.parsePattern(expectedPattern);
    if (!parsed) {
      return { valid: false, message: `Invalid validation pattern: ${expectedPattern}` };
    }

    let result;
    try {
      result = await conn.execute(validationQuery, [], {
        outFormat: 2, // OUT_FORMAT_OBJECT
        maxRows: 1000,
      });
    } catch (err) {
      return { valid: false, message: `Validation query failed: ${err.message}` };
    }

    const rows = result.rows || [];
    const columns = (result.metaData || []).map((m) => m.name);

    switch (parsed.type) {
      case 'rowCount':
        return this.#checkRowCount(rows.length, parsed.op, parsed.value);
      case 'exact':
        return this.#checkExact(rows, parsed.expected);
      case 'contains':
        return this.#checkContains(rows, parsed.value);
      case 'columnExists':
        return this.#checkColumnExists(columns, parsed.column);
      default:
        return { valid: false, message: `Unknown pattern type: ${parsed.type}` };
    }
  }

  #checkRowCount(actual, op, expected) {
    const ops = {
      '>': actual > expected,
      '>=': actual >= expected,
      '<': actual < expected,
      '<=': actual <= expected,
      '=': actual === expected,
    };
    const valid = ops[op] ?? actual === expected;

    return {
      valid,
      message: valid
        ? `Found ${actual} row${actual !== 1 ? 's' : ''}`
        : `Expected row count ${op} ${expected}, got ${actual}`,
    };
  }

  #checkExact(rows, expected) {
    if (rows.length === 0) {
      return { valid: false, message: 'No rows returned for exact match check' };
    }

    const firstRow = rows[0];
    for (const [key, val] of Object.entries(expected)) {
      if (firstRow[key] !== val) {
        return {
          valid: false,
          message: `Expected ${key}=${val}, got ${key}=${firstRow[key]}`,
        };
      }
    }

    return { valid: true, message: 'Result matches expected values' };
  }

  #checkContains(rows, value) {
    const found = rows.some((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(value.toLowerCase())),
    );

    return {
      valid: found,
      message: found ? `Found "${value}" in results` : `"${value}" not found in results`,
    };
  }

  #checkColumnExists(columns, column) {
    const found = columns.includes(column);
    return {
      valid: found,
      message: found
        ? `Column ${column} exists in result`
        : `Column ${column} not found. Available: ${columns.join(', ')}`,
    };
  }
}
