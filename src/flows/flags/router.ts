import { Router } from 'express';
import type { Db } from '../../db/index.js';
import { requirePermission } from '../../kernel/auth.js';
import { historyFor } from '../../kernel/audit.js';
import { ENVIRONMENTS } from '../../kernel/config.js';
import { badRequest } from '../../kernel/errors.js';
import { can, flagTogglePermission } from '../../kernel/rbac.js';
import { flagsForEnvironment, getFlag, isEnvironment, listFlags, setFlagState } from './service.js';

export function flagsRouter(db: Db): Router {
  const router = Router();

  router.get('/flags', requirePermission('flag.read'), (req, res) => {
    res.render('flags/list', {
      title: 'Feature flag admin',
      environments: ENVIRONMENTS,
      flags: listFlags(db),
      canToggle: Object.fromEntries(
        ENVIRONMENTS.map((env) => [env, can(req.user.role, flagTogglePermission(env))]),
      ),
    });
  });

  router.get('/flags/:id', requirePermission('flag.read'), (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('INVALID_ID', 'Flag id must be an integer.');
    const flag = getFlag(db, id);
    res.render('flags/detail', {
      title: flag.key,
      flag,
      history: historyFor(db, 'feature_flag', flag.id),
    });
  });

  router.post('/flags/:id/toggle', requirePermission('flag.read'), (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as Record<string, unknown>;
    const environment = body.environment;
    if (!Number.isInteger(id)) throw badRequest('INVALID_ID', 'Flag id must be an integer.');
    if (!isEnvironment(environment)) throw badRequest('INVALID_ENVIRONMENT', 'Unknown environment.');
    setFlagState(db, req.user, req.requestId, id, environment, body.enabled === 'true' || body.enabled === true);
    res.redirect('/flags');
  });

  /**
   * The seam where a real flag SDK/service would read state. Mocked deliberately:
   * no caching, streaming, or edge distribution.
   */
  router.get('/api/flags', requirePermission('flag.read'), (req, res) => {
    const env = req.query.env ?? 'dev';
    if (!isEnvironment(env)) throw badRequest('INVALID_ENVIRONMENT', 'env must be dev, staging or prod.');
    res.json({ environment: env, flags: flagsForEnvironment(db, env), source: 'mock-flag-service' });
  });

  return router;
}
