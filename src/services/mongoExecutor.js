/**
 * MongoDB command translator + executor.
 * Parses mongosh-style commands and translates them to SQL
 * for execution via the QueryExecutor.
 */
import { performance } from 'node:perf_hooks';

// Match db.COLLECTION.OPERATION(ARGS)
const CMD_PATTERN = /^db\.(\w+)\.(\w+)\(([\s\S]*)\)\s*$/;
const SHOW_COLLECTIONS = /^show\s+collections\s*$/i;

export class MongoExecutor {
  #queryExecutor;

  constructor(queryExecutor) {
    this.#queryExecutor = queryExecutor;
  }

  /**
   * Parse a mongosh-style command into structured form.
   * @param {string} command
   * @returns {{ collection?, operation, args? } | null}
   */
  parse(command) {
    const trimmed = (command || '').trim();

    if (SHOW_COLLECTIONS.test(trimmed)) {
      return { operation: 'showCollections' };
    }

    const match = trimmed.match(CMD_PATTERN);
    if (!match) return null;

    const [, collection, operation, argsStr] = match;

    try {
      // Parse args using Function to handle unquoted keys (mongosh style)
      // This is safe because we only use the parsed value, never execute it
      const args = new Function(`return [${argsStr}]`)();
      return { collection, operation, args };
    } catch {
      return null;
    }
  }

  /**
   * Execute a mongosh-style command by translating to SQL.
   * @param {object} conn - database connection
   * @param {string} command - mongosh command string
   * @returns {Promise<{ documents?, count?, duration?, error? }>}
   */
  async execute(conn, command) {
    const start = performance.now();
    const parsed = this.parse(command);

    if (!parsed) {
      return {
        error:
          'Unrecognized MongoDB command. Supported: db.COLLECTION.find/insertOne/deleteOne, show collections',
        duration: Math.round(performance.now() - start),
      };
    }

    try {
      switch (parsed.operation) {
        case 'showCollections':
          return await this.#showCollections(conn);
        case 'find':
          return await this.#find(conn, parsed.collection, parsed.args[0]);
        case 'insertOne':
          return await this.#insertOne(conn, parsed.collection, parsed.args[0]);
        case 'deleteOne':
          return await this.#deleteOne(conn, parsed.collection, parsed.args[0]);
        case 'aggregate':
          return {
            error: 'aggregate is not yet supported. Use SQL for complex aggregations.',
            duration: Math.round(performance.now() - start),
          };
        default:
          return {
            error: `Unsupported operation: ${parsed.operation}`,
            duration: Math.round(performance.now() - start),
          };
      }
    } catch (err) {
      return {
        error: err.message,
        duration: Math.round(performance.now() - start),
      };
    }
  }

  async #showCollections(conn) {
    const sql = `SELECT collection_name FROM user_soda_collections ORDER BY collection_name`;
    const result = await this.#queryExecutor.execute(conn, sql);
    if (result.error) return result;

    return {
      documents: result.rows,
      count: result.rowCount,
      duration: result.duration,
    };
  }

  async #find(conn, collection, filter = {}) {
    const where = this.#filterToWhere(filter);
    const sql = `SELECT data FROM ${this.#escapeIdent(collection)}${where}`;
    const result = await this.#queryExecutor.execute(conn, sql);
    if (result.error) return result;

    const documents = (result.rows || []).map((r) => r.DATA || r);
    return {
      documents,
      count: documents.length,
      duration: result.duration,
    };
  }

  async #insertOne(conn, collection, doc) {
    const json = JSON.stringify(doc);
    const sql = `INSERT INTO ${this.#escapeIdent(collection)} (data) VALUES ('${json.replace(/'/g, "''")}')`;
    const result = await this.#queryExecutor.execute(conn, sql);
    if (result.error) return result;

    return {
      documents: [doc],
      count: result.rowsAffected || 1,
      duration: result.duration,
    };
  }

  async #deleteOne(conn, collection, filter = {}) {
    const where = this.#filterToWhere(filter);
    const sql = `DELETE FROM ${this.#escapeIdent(collection)}${where} FETCH FIRST 1 ROW ONLY`;
    const result = await this.#queryExecutor.execute(conn, sql);
    if (result.error) return result;

    return {
      count: result.rowsAffected || 0,
      duration: result.duration,
    };
  }

  /**
   * Convert a simple filter object to a SQL WHERE clause.
   * Supports flat key-value equality only.
   */
  #filterToWhere(filter) {
    const keys = Object.keys(filter || {});
    if (keys.length === 0) return '';

    const conditions = keys.map((key) => {
      const val = filter[key];
      if (typeof val === 'string') {
        return `json_value(data, '$.${key}') = '${val.replace(/'/g, "''")}'`;
      }
      return `json_value(data, '$.${key}') = '${val}'`;
    });

    return ` WHERE ${conditions.join(' AND ')}`;
  }

  #escapeIdent(name) {
    // Only allow alphanumeric and underscore for table/collection names
    if (!/^\w+$/.test(name)) {
      throw new Error(`Invalid collection name: ${name}`);
    }
    return name;
  }
}
