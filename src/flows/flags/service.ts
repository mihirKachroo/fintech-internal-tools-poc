import type { Db } from '../../db/index.js';
import { writeAudit } from '../../kernel/audit.js';
import type { SessionUser } from '../../kernel/auth.js';
import { ENVIRONMENTS, type Environment } from '../../kernel/config.js';
import { badRequest, notFound } from '../../kernel/errors.js';
import { assertCan, flagTogglePermission } from '../../kernel/rbac.js';

export interface FlagRow {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly owner: string;
}

export interface FlagStateRow {
  readonly flag_id: number;
  readonly environment: Environment;
  readonly enabled: number;
  readonly rollout_pct: number;
  readonly updated_at: string;
  readonly updated_by: string | null;
}

export interface FlagWithStates extends FlagRow {
  readonly states: Record<Environment, FlagStateRow>;
}

export function isEnvironment(value: unknown): value is Environment {
  return typeof value === 'string' && (ENVIRONMENTS as readonly string[]).includes(value);
}

export function listFlags(db: Db): FlagWithStates[] {
  const flags = db.prepare('SELECT * FROM feature_flags ORDER BY key').all() as FlagRow[];
  const states = db.prepare('SELECT * FROM flag_states').all() as FlagStateRow[];
  return flags.map((flag) => {
    const byEnv = {} as Record<Environment, FlagStateRow>;
    for (const state of states) {
      if (state.flag_id === flag.id) byEnv[state.environment] = state;
    }
    return { ...flag, states: byEnv };
  });
}

export function getFlag(db: Db, id: number): FlagRow {
  const row = db.prepare('SELECT * FROM feature_flags WHERE id = ?').get(id);
  if (!row) throw notFound('FLAG_NOT_FOUND', `Feature flag ${id} does not exist.`);
  return row as FlagRow;
}

function getState(db: Db, flagId: number, environment: Environment): FlagStateRow {
  const row = db
    .prepare('SELECT * FROM flag_states WHERE flag_id = ? AND environment = ?')
    .get(flagId, environment);
  if (!row) throw notFound('FLAG_STATE_NOT_FOUND', `Flag ${flagId} has no '${environment}' state.`);
  return row as FlagStateRow;
}

/** Toggles one flag in one environment. Production requires the admin-only permission. */
export function setFlagState(
  db: Db,
  actor: SessionUser,
  requestId: string,
  flagId: number,
  environment: Environment,
  enabled: boolean,
): FlagStateRow {
  if (!isEnvironment(environment)) throw badRequest('INVALID_ENVIRONMENT', 'Unknown environment.');
  assertCan(actor.role, flagTogglePermission(environment));
  const flag = getFlag(db, flagId);
  const before = getState(db, flagId, environment);
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `UPDATE flag_states SET enabled = @enabled, rollout_pct = @rollout, updated_at = @now, updated_by = @actor
       WHERE flag_id = @flag_id AND environment = @environment`,
    ).run({
      enabled: enabled ? 1 : 0,
      rollout: enabled ? 100 : 0,
      now,
      actor: actor.id,
      flag_id: flagId,
      environment,
    });
    writeAudit(db, {
      actorId: actor.id,
      actorRole: actor.role,
      action: 'flag.toggled',
      entityType: 'feature_flag',
      entityId: flagId,
      before: { environment, enabled: before.enabled === 1 },
      after: { environment, enabled, key: flag.key },
      reason: `${flag.key} ${environment} -> ${enabled ? 'on' : 'off'}`,
      requestId,
    });
  })();

  return getState(db, flagId, environment);
}

/** Shape a real flag SDK would read. Mocked: no caching, streaming or edge delivery. */
export function flagsForEnvironment(db: Db, environment: Environment): Record<string, { enabled: boolean; rollout_pct: number }> {
  const rows = db
    .prepare(
      `SELECT f.key AS key, s.enabled AS enabled, s.rollout_pct AS rollout_pct
       FROM feature_flags f JOIN flag_states s ON s.flag_id = f.id
       WHERE s.environment = ? ORDER BY f.key`,
    )
    .all(environment) as { key: string; enabled: number; rollout_pct: number }[];
  return Object.fromEntries(
    rows.map((row) => [row.key, { enabled: row.enabled === 1, rollout_pct: row.rollout_pct }]),
  );
}
