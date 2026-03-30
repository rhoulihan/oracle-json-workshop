const REQUIRED_VARS = [
  'DB_USER',
  'DB_PASSWORD',
  'DB_CONNECT_STRING',
  'SESSION_SECRET',
  'ADMIN_PASSWORD',
];

export function loadConfig() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  if (process.env.PORT && (isNaN(port) || port < 1 || port > 65535)) {
    throw new Error(`PORT must be a number between 1 and 65535, got: ${process.env.PORT}`);
  }

  return {
    server: {
      port,
      env: process.env.NODE_ENV || 'development',
    },
    db: {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    },
    ords: {
      baseUrl: process.env.ORDS_BASE_URL || 'http://localhost:8181/ords',
    },
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    },
    session: {
      secret: process.env.SESSION_SECRET,
    },
    admin: {
      password: process.env.ADMIN_PASSWORD,
    },
  };
}
