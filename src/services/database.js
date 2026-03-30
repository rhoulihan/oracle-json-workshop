export class DatabaseService {
  #pool = null;
  #oracledb;

  constructor(oracledb) {
    this.#oracledb = oracledb;
  }

  async initialize(config) {
    if (this.#pool) {
      throw new Error('Database already initialized');
    }

    this.#pool = await this.#oracledb.createPool({
      user: config.user,
      password: config.password,
      connectString: config.connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1,
    });
  }

  getPool() {
    if (!this.#pool) {
      throw new Error('Database not initialized — call initialize() first');
    }
    return this.#pool;
  }

  async close() {
    if (this.#pool) {
      await this.#pool.close({ drainTime: 10 });
      this.#pool = null;
    }
  }
}
