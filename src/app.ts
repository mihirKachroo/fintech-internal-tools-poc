import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Db } from './db/index.js';
import { recentAudit } from './kernel/audit.js';
import { SESSION_COOKIE, issueToken, loadUser, requirePermission, sessionMiddleware } from './kernel/auth.js';
import { AppError } from './kernel/errors.js';
import { flagsRouter } from './flows/flags/router.js';
import { refundsRouter } from './flows/refunds/router.js';

export function createApp(db: Db): express.Express {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(import.meta.dirname, 'views'));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(sessionMiddleware(db));

  app.use((_req, res, next) => {
    res.locals.demoUsers = db.prepare('SELECT id, name, role FROM users ORDER BY role').all();
    next();
  });

  app.get('/', (_req, res) => res.redirect('/refunds'));

  /**
   * Demo-only user switcher: mints a real signed JWT for the chosen seeded user.
   * The token is verified on every request, so authorization is not simulated -
   * only the identity provider is.
   */
  app.post('/switch-user', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const userId = typeof body.user_id === 'string' ? body.user_id : '';
    const user = loadUser(db, userId);
    res.cookie(SESSION_COOKIE, issueToken(user), { httpOnly: true, sameSite: 'lax' });
    const back = typeof body.return_to === 'string' && body.return_to.startsWith('/') ? body.return_to : '/refunds';
    res.redirect(back);
  });

  app.use(refundsRouter(db));
  app.use(flagsRouter(db));

  app.get('/audit', requirePermission('audit.read'), (_req, res) => {
    res.render('audit', { title: 'Audit log', entries: recentAudit(db, 200) });
  });

  app.use((_req, res) => {
    res.status(404).render('error', { title: 'Not found', status: 404, code: 'NOT_FOUND', message: 'No such page.' });
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const appError =
      error instanceof AppError
        ? error
        : new AppError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected error');
    if (appError.status >= 500) console.error(appError);
    if (req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json') {
      res.status(appError.status).json({ error: { code: appError.code, message: appError.message } });
      return;
    }
    res.status(appError.status).render('error', {
      title: appError.code,
      status: appError.status,
      code: appError.code,
      message: appError.message,
    });
  });

  return app;
}
