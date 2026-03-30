import oracledb from 'oracledb';

const DB_CONFIG = {
  user: process.env.DB_USER || 'WORKSHOP_ADMIN',
  password: process.env.DB_PASSWORD || 'WorkshopApp2026',
  connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/FREEPDB1',
};

let pool = null;

export async function getPool() {
  if (!pool) {
    pool = await oracledb.createPool({
      ...DB_CONFIG,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
  }
  return pool;
}

export async function getConnection() {
  const p = await getPool();
  return p.getConnection();
}

export async function execute(sql, binds = [], opts = {}) {
  const conn = await getConnection();
  try {
    return await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, ...opts });
  } finally {
    await conn.close();
  }
}

export async function closePool() {
  if (pool) {
    await pool.close(0);
    pool = null;
  }
}

export async function getConnectionAs(user, password) {
  return oracledb.getConnection({
    user,
    password,
    connectString: DB_CONFIG.connectString,
  });
}
