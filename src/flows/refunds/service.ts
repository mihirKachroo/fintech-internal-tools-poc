import type { Db } from '../../db/index.js';
import { writeAudit } from '../../kernel/audit.js';
import type { SessionUser } from '../../kernel/auth.js';
import { badRequest, conflict, notFound } from '../../kernel/errors.js';
import { assertCan } from '../../kernel/rbac.js';
import * as paymentProvider from '../../mocks/paymentProvider.js';
import { isSelfDecision, requiresSecondApproval } from './rules.js';

export interface RefundRow {
  readonly id: number;
  readonly customer_name: string;
  readonly customer_email: string;
  readonly card_last4: string;
  readonly bank_account: string;
  readonly amount_cents: number;
  readonly currency: string;
  readonly reason: string;
  readonly status: 'pending_approval' | 'processed' | 'rejected' | 'failed';
  readonly requested_by: string;
  readonly requested_at: string;
  readonly decided_by: string | null;
  readonly decided_at: string | null;
  readonly decision_reason: string | null;
  readonly idempotency_key: string | null;
  readonly provider_reference: string | null;
  readonly provider_status: string | null;
}

export interface ListOptions {
  readonly status?: string;
  readonly query?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ListResult {
  readonly rows: RefundRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

const STATUSES = ['pending_approval', 'processed', 'rejected', 'failed'] as const;

export function listRefunds(db: Db, options: ListOptions = {}): ListResult {
  const pageSize = options.pageSize ?? 25;
  const page = Math.max(1, options.page ?? 1);
  const filters: string[] = [];
  const params: Record<string, string | number> = {};
  if (options.status && (STATUSES as readonly string[]).includes(options.status)) {
    filters.push('status = @status');
    params.status = options.status;
  }
  if (options.query) {
    filters.push('(customer_name LIKE @q OR CAST(id AS TEXT) = @exact)');
    params.q = `%${options.query}%`;
    params.exact = options.query;
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS n FROM refunds ${where}`).get(params) as { n: number }).n,
  );
  const rows = db
    .prepare(`SELECT * FROM refunds ${where} ORDER BY requested_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as RefundRow[];
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getRefund(db: Db, id: number): RefundRow {
  const row = db.prepare('SELECT * FROM refunds WHERE id = ?').get(id);
  if (!row) throw notFound('REFUND_NOT_FOUND', `Refund ${id} does not exist.`);
  return row as RefundRow;
}

export interface CreateRefundInput {
  readonly customerName: string;
  readonly customerEmail: string;
  readonly cardLast4: string;
  readonly bankAccount: string;
  readonly amountCents: number;
  readonly reason: string;
}

export interface CreateRefundResult {
  readonly refund: RefundRow;
  readonly pendingApproval: boolean;
}

/**
 * Requests a refund. Below the threshold it is paid straight away through the mock
 * provider; above it, the refund parks in pending_approval for a second person.
 */
export function requestRefund(
  db: Db,
  actor: SessionUser,
  requestId: string,
  input: CreateRefundInput,
): CreateRefundResult {
  assertCan(actor.role, 'refund.request');
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw badRequest('INVALID_AMOUNT', 'Amount must be a positive number of cents.');
  }
  if (input.reason.trim() === '') throw badRequest('REASON_REQUIRED', 'A reason is required.');

  const pendingApproval = requiresSecondApproval(input.amountCents);
  const now = new Date().toISOString();

  const id = db.transaction((): number => {
    const insert = db
      .prepare(
        `INSERT INTO refunds (customer_name, customer_email, card_last4, bank_account, amount_cents,
                              currency, reason, status, requested_by, requested_at)
         VALUES (@customer_name, @customer_email, @card_last4, @bank_account, @amount_cents,
                 'USD', @reason, @status, @requested_by, @requested_at)`,
      )
      .run({
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        card_last4: input.cardLast4,
        bank_account: input.bankAccount,
        amount_cents: input.amountCents,
        reason: input.reason,
        status: pendingApproval ? 'pending_approval' : 'processed',
        requested_by: actor.id,
        requested_at: now,
      });
    const newId = Number(insert.lastInsertRowid);
    writeAudit(db, {
      actorId: actor.id,
      actorRole: actor.role,
      action: 'refund.requested',
      entityType: 'refund',
      entityId: newId,
      after: { amount_cents: input.amountCents, status: pendingApproval ? 'pending_approval' : 'processed' },
      reason: input.reason,
      requestId,
    });
    return newId;
  })();

  if (!pendingApproval) {
    settleWithProvider(db, actor, requestId, id, 'refund.auto_processed');
  }
  return { refund: getRefund(db, id), pendingApproval };
}

/** Calls the mock provider and records the result plus an audit entry. */
function settleWithProvider(
  db: Db,
  actor: SessionUser,
  requestId: string,
  refundId: number,
  action: string,
): RefundRow {
  const before = getRefund(db, refundId);
  const idempotencyKey = `refund_${refundId}_settle`;
  const result = paymentProvider.refund({
    idempotencyKey,
    amountCents: before.amount_cents,
    customerReference: before.customer_email,
  });
  db.transaction(() => {
    db.prepare(
      `UPDATE refunds SET status = 'processed', idempotency_key = @key, provider_reference = @ref,
                          provider_status = @status WHERE id = @id`,
    ).run({ key: idempotencyKey, ref: result.reference, status: result.status, id: refundId });
    writeAudit(db, {
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'refund',
      entityId: refundId,
      before: { status: before.status, provider_reference: before.provider_reference },
      after: {
        status: 'processed',
        provider_reference: result.reference,
        idempotency_key: idempotencyKey,
        provider_replayed: result.replayed,
      },
      requestId,
    });
  })();
  return getRefund(db, refundId);
}

export type Decision = 'approve' | 'reject';

/**
 * Second-approver decision. Enforces four-eyes: the requester cannot decide their
 * own refund, and a reason is mandatory either way.
 */
export function decideRefund(
  db: Db,
  actor: SessionUser,
  requestId: string,
  refundId: number,
  decision: Decision,
  reason: string,
): RefundRow {
  assertCan(actor.role, 'refund.approve');
  const refund = getRefund(db, refundId);
  if (refund.status !== 'pending_approval') {
    throw conflict('NOT_PENDING', `Refund ${refundId} is '${refund.status}', not awaiting a decision.`);
  }
  if (isSelfDecision(refund.requested_by, actor.id)) {
    throw conflict(
      'SELF_APPROVAL_BLOCKED',
      'You requested this refund; a different approver must decide it (four-eyes rule).',
    );
  }
  if (reason.trim() === '') {
    throw badRequest('REASON_REQUIRED', 'A reason is required for approve and reject.');
  }

  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(
      `UPDATE refunds SET status = @status, decided_by = @actor, decided_at = @now, decision_reason = @reason
       WHERE id = @id AND status = 'pending_approval'`,
    ).run({
      status: decision === 'approve' ? 'pending_approval' : 'rejected',
      actor: actor.id,
      now,
      reason,
      id: refundId,
    });
    writeAudit(db, {
      actorId: actor.id,
      actorRole: actor.role,
      action: decision === 'approve' ? 'refund.approved' : 'refund.rejected',
      entityType: 'refund',
      entityId: refundId,
      before: { status: refund.status, decided_by: refund.decided_by },
      after: { status: decision === 'approve' ? 'approved' : 'rejected', decided_by: actor.id },
      reason,
      requestId,
    });
  })();

  if (decision === 'reject') return getRefund(db, refundId);
  return settleWithProvider(db, actor, requestId, refundId, 'refund.provider_settled');
}
