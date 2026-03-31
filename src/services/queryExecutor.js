/**
 * SQL query executor with timeout and row limits.
 */
import oracledb from 'oracledb';
import { performance } from 'node:perf_hooks';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_ROWS = 1000;

export class QueryExecutor {
  #timeout;
  #maxRows;

  constructor({ timeout = DEFAULT_TIMEOUT, maxRows = DEFAULT_MAX_ROWS } = {}) {
    this.#timeout = timeout;
    this.#maxRows = maxRows;
  }

  /**
   * Execute SQL against a connection.
   * @param {object} conn - oracledb connection
   * @param {string} sql - SQL statement
   * @returns {Promise<object>} Result object
   */
  async execute(conn, sql) {
    const start = performance.now();

    try {
      const result = await conn.execute(sql, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
        callTimeout: this.#timeout,
        maxRows: this.#maxRows,
      });

      const duration = Math.round(performance.now() - start);

      // DML statement (INSERT/UPDATE/DELETE) — no metaData
      if (!result.metaData) {
        return {
          rowsAffected: result.rowsAffected || 0,
          duration,
          resultType: 'dml',
        };
      }

      const rows = (result.rows || []).slice(0, this.#maxRows);
      const columns = result.metaData.map((m) => m.name);
      const resultType = this.#detectResultType(rows, columns);

      return {
        rows,
        columns,
        rowCount: rows.length,
        duration,
        resultType,
      };
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      return { error: err.message, duration };
    }
  }

  #detectResultType(rows, columns) {
    if (rows.length === 0) return 'tabular';
    // If there's a DATA column and its values are objects → JSON result
    if (columns.includes('DATA') && typeof rows[0].DATA === 'object' && rows[0].DATA !== null) {
      return 'json';
    }
    return 'tabular';
  }
}
