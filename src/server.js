import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import { createQueryRouter } from './routes/query.js';
import { createRateLimiter } from './middleware/rateLimit.js';

export function createApp(config, services = {}) {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(express.json());

  app.use(
    session({
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }),
  );

  app.use(express.static('public'));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Mount query routes if services are provided
  if (services.queryExecutor) {
    const rateLimiter = createRateLimiter();
    const queryRouter = createQueryRouter(services);
    app.use('/api/query', rateLimiter, queryRouter);
  }

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
