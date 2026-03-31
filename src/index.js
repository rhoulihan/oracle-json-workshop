import oracledb from 'oracledb';
import { loadConfig } from './config.js';
import { createApp } from './server.js';
import { DatabaseService } from './services/database.js';
import { WorkspaceService } from './services/workspace.js';
import { QueryExecutor } from './services/queryExecutor.js';
import { JsExecutor } from './services/jsExecutor.js';
import { MongoExecutor } from './services/mongoExecutor.js';
import { LabLoader } from './services/labLoader.js';
import { Validator } from './services/validator.js';
import { ProgressService } from './services/progressService.js';

async function start() {
  const config = loadConfig();

  // Initialize database connection pool
  const dbService = new DatabaseService(oracledb);
  await dbService.initialize(config.db);
  const pool = dbService.getPool();

  console.log(`Database pool created (${config.db.user}@${config.db.connectString})`);

  // Instantiate services
  const workspaceService = new WorkspaceService(pool);
  const queryExecutor = new QueryExecutor();
  const jsExecutor = new JsExecutor();
  const mongoExecutor = new MongoExecutor(queryExecutor);
  const labLoader = new LabLoader();
  const validator = new Validator();
  const progressService = new ProgressService();

  // Helper to get a connection as a specific user (for login validation)
  async function getConnectionAs(user, password) {
    return oracledb.getConnection({
      user,
      password,
      connectString: config.db.connectString,
    });
  }

  // Helper to get a connection for the authenticated user's schema
  async function getConnection(user) {
    // User sessions store schemaName + password from registration/login
    if (user?.schemaName && user?.password) {
      return getConnectionAs(user.schemaName, user.password);
    }
    // Fallback to admin pool connection
    return pool.getConnection();
  }

  // Build and start the Express app
  const app = createApp(config, {
    workspaceService,
    queryExecutor,
    jsExecutor,
    mongoExecutor,
    labLoader,
    validator,
    progressService,
    getConnection,
    getConnectionAs,
    getAdminConnection: async () => pool.getConnection(),
  });

  const server = app.listen(config.server.port, () => {
    console.log(`Workshop app listening on port ${config.server.port} (${config.server.env})`);
    console.log(`Health check: http://localhost:${config.server.port}/health`);
  });

  // Graceful shutdown
  async function shutdown(signal) {
    console.log(`\n${signal} received — shutting down gracefully`);
    server.close(async () => {
      await dbService.close();
      console.log('Database pool closed');
      process.exit(0); // eslint-disable-line n/no-process-exit
    });

    // Force exit after 10s
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1); // eslint-disable-line n/no-process-exit
    }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1); // eslint-disable-line n/no-process-exit
});
