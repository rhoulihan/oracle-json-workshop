import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';

export function createApp(config) {
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

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
