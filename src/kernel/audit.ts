import type { Db } from '../db/index.js';
import type { Role } from './config.js';

export interface AuditEntry {
  readonly actorId: string;
  readonly actorRole: Role;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | number;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string | null;
  readonly requestId: string;
}

export interface AuditRow {
  readonly id: number;
  readonly actor_id: string;
  readonly actor_role: string;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly before_json: string | null;
  readonly after_json: string | null;
  readonly reason: string | null;
  readonly request_id: string;
  readonly created_at: string;
}

const INSERT = `
  INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id,
                         before_json, after_json, reason, request_id, created_at)
  VALUES (@actor_id, @actor_role, @action, @entity_type, @entity_id,
          @before_json, @after_json, @reason, @request_id, @created_at)
`;

/**
 * Shared audit writer. Call it inside the same transaction as the mutation it
 * describes: if the audit insert fails the business change must fail with it.
 */
export function writeAudit(db: Db, entry: AuditEntry): void {
  db.prepare(INSERT).run({
    actor_id: entry.actorId,
    actor_role: entry.actorRole,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: String(entry.entityId),
    before_json: entry.before === undefined ? null : JSON.stringify(entry.before),
    after_json: entry.after === undefined ? null : JSON.stringify(entry.after),
    reason: entry.reason ?? null,
    request_id: entry.requestId,
    created_at: new Date().toISOString(),
  });
}

export function historyFor(db: Db, entityType: string, entityId: string | number): AuditRow[] {
  return db
    .prepare('SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC')
    .all(entityType, String(entityId)) as AuditRow[];
}

export function recentAudit(db: Db, limit = 100): AuditRow[] {
  return db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit) as AuditRow[];
}
