import { Router } from 'express';
import type { Db } from '../../db/index.js';
import { historyFor } from '../../kernel/audit.js';
import { REFUND_ENTITY } from '../../kernel/config.js';
import { badRequest } from '../../kernel/errors.js';
import { serializeRow, serializeRowToJson } from '../../kernel/masking.js';
import { can } from '../../kernel/rbac.js';
import { requirePermission } from '../../kernel/auth.js';
import { APPROVAL_THRESHOLD_CENTS } from './rules.js';
import { decideRefund, getRefund, listRefunds, requestRefund, type Decision } from './service.js';

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('INVALID_ID', 'Refund id must be a positive integer.');
  return id;
}

function parseAmountToCents(raw: unknown): number {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest('INVALID_AMOUNT', 'Amount must be a positive dollar value.');
  }
  return Math.round(amount * 100);
}

function str(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest('MISSING_FIELD', `Field '${field}' is required.`);
  }
  return value.trim();
}

export function refundsRouter(db: Db): Router {
  const router = Router();

  router.get('/refunds', requirePermission('refund.read'), (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const page = Number(req.query.page ?? 1);
    const result = listRefunds(db, { status, query, page: Number.isFinite(page) ? page : 1 });
    res.render('refunds/list', {
      title: 'Refunds dashboard',
      columns: REFUND_ENTITY.fields.filter((field) => field.inList === true),
      rows: result.rows.map((row) => ({
        id: row.id,
        cells: serializeRow(REFUND_ENTITY, row as unknown as Record<string, unknown>, req.user.role, {
          listOnly: true,
        }),
      })),
      result,
      status,
      query,
      canRequest: can(req.user.role, 'refund.request'),
      thresholdDollars: APPROVAL_THRESHOLD_CENTS / 100,
    });
  });

  router.get('/refunds/new', requirePermission('refund.request'), (_req, res) => {
    res.render('refunds/new', {
      title: 'Request refund',
      thresholdDollars: APPROVAL_THRESHOLD_CENTS / 100,
    });
  });

  router.post('/refunds', requirePermission('refund.request'), (req, res) => {
    const body = req.body as Record<string, unknown>;
    const result = requestRefund(db, req.user, req.requestId, {
      customerName: str(body.customer_name, 'customer_name'),
      customerEmail: str(body.customer_email, 'customer_email'),
      cardLast4: str(body.card_last4, 'card_last4').slice(-4),
      bankAccount: str(body.bank_account, 'bank_account'),
      amountCents: parseAmountToCents(body.amount),
      reason: str(body.reason, 'reason'),
    });
    res.redirect(`/refunds/${result.refund.id}`);
  });

  router.get('/refunds/:id', requirePermission('refund.read'), (req, res) => {
    const refund = getRefund(db, parseId(req.params.id));
    res.render('refunds/detail', {
      title: `Refund #${refund.id}`,
      refund,
      fields: serializeRow(REFUND_ENTITY, refund as unknown as Record<string, unknown>, req.user.role),
      history: historyFor(db, 'refund', refund.id),
      canDecide: can(req.user.role, 'refund.approve'),
      isRequester: refund.requested_by === req.user.id,
      thresholdDollars: APPROVAL_THRESHOLD_CENTS / 100,
    });
  });

  router.post('/refunds/:id/:decision', requirePermission('refund.approve'), (req, res) => {
    const decision = req.params.decision;
    if (decision !== 'approve' && decision !== 'reject') {
      throw badRequest('INVALID_DECISION', "Decision must be 'approve' or 'reject'.");
    }
    const body = req.body as Record<string, unknown>;
    const reason = typeof body.reason === 'string' ? body.reason : '';
    const id = parseId(req.params.id);
    decideRefund(db, req.user, req.requestId, id, decision as Decision, reason);
    res.redirect(`/refunds/${id}`);
  });

  // JSON view of a record, to show masking happens server-side rather than in the UI.
  router.get('/api/refunds/:id', requirePermission('refund.read'), (req, res) => {
    const refund = getRefund(db, parseId(req.params.id));
    res.json({
      viewer_role: req.user.role,
      refund: serializeRowToJson(REFUND_ENTITY, refund as unknown as Record<string, unknown>, req.user.role),
    });
  });

  return router;
}
