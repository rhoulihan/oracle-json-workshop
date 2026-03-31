import crypto from 'crypto';
import oracledb from 'oracledb';

export class WorkspaceService {
  #pool;

  constructor(pool) {
    this.#pool = pool;
  }

  generateSchemaName() {
    const id = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `WS_${id}`;
  }

  generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(16);
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars[bytes[i] % chars.length];
    }
    // Ensure at least one uppercase, lowercase, digit
    password = 'A' + 'a' + '1' + password.slice(3);
    return password;
  }

  async create({ displayName, email } = {}) {
    const schemaName = this.generateSchemaName();
    const password = this.generatePassword();

    const conn = await this.#pool.getConnection();
    try {
      await conn.execute(`BEGIN WORKSHOP_ADMIN.clone_schema(:username, :password); END;`, {
        username: schemaName,
        password,
      });

      // Update display name and email if provided
      if (displayName || email) {
        await conn.execute(
          `UPDATE workshop_users SET display_name = :dn, email = :em WHERE schema_name = :sn`,
          { dn: displayName || null, em: email || null, sn: schemaName },
        );
      }

      await conn.commit();
      return { schemaName, password };
    } finally {
      await conn.close();
    }
  }

  async teardown(schemaName) {
    const conn = await this.#pool.getConnection();
    try {
      await conn.execute(`BEGIN WORKSHOP_ADMIN.drop_workspace(:username); END;`, {
        username: schemaName,
      });
      await conn.commit();
    } finally {
      await conn.close();
    }
  }

  async list() {
    const conn = await this.#pool.getConnection();
    try {
      const result = await conn.execute(
        `SELECT schema_name, display_name, email, status, progress, created_at, last_active
         FROM workshop_users ORDER BY created_at DESC`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return (result.rows || []).map((r) => ({
        schemaName: r.SCHEMA_NAME,
        displayName: r.DISPLAY_NAME,
        email: r.EMAIL,
        status: r.STATUS,
        progress: r.PROGRESS,
        createdAt: r.CREATED_AT,
        lastActive: r.LAST_ACTIVE,
      }));
    } finally {
      await conn.close();
    }
  }

  async teardownAll() {
    const conn = await this.#pool.getConnection();
    try {
      const result = await conn.execute(`SELECT schema_name FROM workshop_users`);
      for (const row of result.rows || []) {
        await conn.execute(`BEGIN WORKSHOP_ADMIN.drop_workspace(:username); END;`, {
          username: row.SCHEMA_NAME,
        });
      }
      await conn.commit();
    } finally {
      await conn.close();
    }
  }
}
