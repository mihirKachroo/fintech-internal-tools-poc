/**
 * The credibility tests: authorization, four-eyes, masking and audit are checked at
 * the API layer, not through the UI, because "the server enforces it" is the claim
 * a VP actually cares about.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { applySchema, openDatabase, type Db } from '../db/index.js';
import { seed } from '../db/seed.js';
import { createApp } from '../app.js';
import { issueToken, loadUser } from '../kernel/auth.js';
import { recentAudit } from '../kernel/audit.js';
import { REFUND_ENTITY, type Role } from '../kernel/config.js';
import { serializeRowToJson } from '../kernel/masking.js';
import { getRefund, listRefunds } from '../flows/refunds/service.js';

let db: Db;
let baseUrl: string;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

const tokens: Record<Role, string> = {} as Record<Role, string>;

before(async () => {
  db = openDatabase(':memory:');
  applySchema(db);
  seed(db);
  for (const [role, id] of Object.entries({
    viewer: 'u_viewer',
    reviewer: 'u_reviewer',
    approver: 'u_approver',
    admin: 'u_admin',
  })) {
    tokens[role as Role] = issueToken(loadUser(db, id));
  }
  server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  db.close();
});

async function call(
  method: string,
  path: string,
  role: Role,
  body?: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      authorization: `Bearer ${tokens[role]}`,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) json = parsed as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: response.status, json, text };
}

function flagIdByKey(key: string): number {
  const row = db.prepare('SELECT id FROM feature_flags WHERE key = ?').get(key) as { id: number } | undefined;
  assert.ok(row, `expected a seeded flag '${key}'`);
  return row.id;
}

function pendingRefundRequestedBy(requester: string): number {
  const row = db
    .prepare("SELECT id FROM refunds WHERE status = 'pending_approval' AND requested_by = ? LIMIT 1")
    .get(requester) as { id: number } | undefined;
  assert.ok(row, `expected a pending refund requested by ${requester}`);
  return row.id;
}

describe('authorization is enforced server-side', () => {
  it('rejects a refund request from a viewer', async () => {
    const response = await call('POST', '/refunds', 'viewer', {
      customer_name: 'Test Person',
      customer_email: 'test@example.com',
      card_last4: '4242',
      bank_account: 'DE00',
      amount: '10',
      reason: 'test',
    });
    assert.equal(response.status, 403);
    assert.equal((response.json.error as { code: string }).code, 'PERMISSION_DENIED');
  });

  it('rejects an approval from a reviewer, who may only request', async () => {
    const id = pendingRefundRequestedBy('u_admin');
    const response = await call('POST', `/refunds/${id}/approve`, 'reviewer', { reason: 'looks fine' });
    assert.equal(response.status, 403);
    assert.equal((response.json.error as { code: string }).code, 'PERMISSION_DENIED');
  });

  it('rejects a production flag toggle from a non-admin', async () => {
    const flagId = flagIdByKey('refunds.instant_payout');
    const response = await call('POST', `/flags/${flagId}/toggle`, 'approver', { environment: 'prod', enabled: 'true' });
    assert.equal(response.status, 403);
    assert.equal((response.json.error as { code: string }).code, 'PERMISSION_DENIED');
  });

  it('allows a non-admin to toggle a non-production flag', async () => {
    const flagId = flagIdByKey('refunds.instant_payout');
    const response = await call('POST', `/flags/${flagId}/toggle`, 'approver', { environment: 'dev', enabled: 'true' });
    assert.equal(response.status, 302);
  });

  it('rejects a forged session token', async () => {
    const response = await fetch(`${baseUrl}/api/refunds/1`, {
      headers: { authorization: 'Bearer not.a.real.token', accept: 'application/json' },
    });
    assert.equal(response.status, 403);
  });
});

describe('maker-checker on refunds', () => {
  it('parks refunds above the threshold in pending_approval', async () => {
    const response = await call('POST', '/refunds', 'reviewer', {
      customer_name: 'Big Spender',
      customer_email: 'big@example.com',
      card_last4: '4242',
      bank_account: 'DE00',
      amount: '900',
      reason: 'duplicate charge',
    });
    assert.equal(response.status, 302);
    const created = listRefunds(db, { query: 'Big Spender' }).rows[0];
    assert.ok(created);
    assert.equal(created.status, 'pending_approval');
    assert.equal(created.provider_reference, null, 'no provider call before approval');
  });

  it('settles refunds below the threshold immediately with an idempotency key', async () => {
    await call('POST', '/refunds', 'reviewer', {
      customer_name: 'Small Spender',
      customer_email: 'small@example.com',
      card_last4: '4242',
      bank_account: 'DE00',
      amount: '12.50',
      reason: 'price adjustment',
    });
    const created = listRefunds(db, { query: 'Small Spender' }).rows[0];
    assert.ok(created);
    assert.equal(created.status, 'processed');
    assert.match(String(created.idempotency_key), /^refund_\d+_settle$/);
    assert.match(String(created.provider_reference), /^mock_pi_/);
  });

  it('blocks the requester from approving their own refund', async () => {
    const id = pendingRefundRequestedBy('u_admin');
    const response = await call('POST', `/refunds/${id}/approve`, 'admin', { reason: 'I approve my own work' });
    assert.equal(response.status, 409);
    assert.equal((response.json.error as { code: string }).code, 'SELF_APPROVAL_BLOCKED');
    assert.equal(getRefund(db, id).status, 'pending_approval');
  });

  it('requires a reason on a decision', async () => {
    const id = pendingRefundRequestedBy('u_reviewer');
    const response = await call('POST', `/refunds/${id}/approve`, 'approver', { reason: '   ' });
    assert.equal(response.status, 400);
    assert.equal((response.json.error as { code: string }).code, 'REASON_REQUIRED');
  });

  it('lets a different approver approve, settles with the provider, and audits both steps', async () => {
    const id = pendingRefundRequestedBy('u_reviewer');
    const response = await call('POST', `/refunds/${id}/approve`, 'approver', { reason: 'verified against order' });
    assert.equal(response.status, 302);
    const refund = getRefund(db, id);
    assert.equal(refund.status, 'processed');
    assert.equal(refund.decided_by, 'u_approver');
    assert.match(String(refund.provider_reference), /^mock_pi_/);

    const actions = db
      .prepare("SELECT action, reason FROM audit_log WHERE entity_type = 'refund' AND entity_id = ? ORDER BY id")
      .all(String(id)) as { action: string; reason: string | null }[];
    assert.deepEqual(
      actions.map((entry) => entry.action),
      ['refund.approved', 'refund.provider_settled'],
    );
    assert.equal(actions[0]?.reason, 'verified against order');
  });

  it('refuses to decide a refund that is no longer pending', async () => {
    const settled = db
      .prepare("SELECT id FROM refunds WHERE status = 'processed' LIMIT 1")
      .get() as { id: number };
    const response = await call('POST', `/refunds/${settled.id}/reject`, 'approver', { reason: 'too late' });
    assert.equal(response.status, 409);
    assert.equal((response.json.error as { code: string }).code, 'NOT_PENDING');
  });
});

describe('field masking happens in the serializer', () => {
  it('never sends sensitive values to a viewer over the API', async () => {
    const response = await call('GET', '/api/refunds/1', 'viewer');
    assert.equal(response.status, 200);
    const refund = response.json.refund as Record<string, string>;
    const row = getRefund(db, 1);
    assert.ok(!response.text.includes(row.card_last4), 'card tail must not appear anywhere in the payload');
    assert.ok(!response.text.includes(row.bank_account), 'bank account must not appear in the payload');
    assert.ok(!response.text.includes(row.customer_email), 'customer email must not appear in the payload');
    assert.match(String(refund.card_last4), /^\u2022+$/);
  });

  it('sends the card tail to a reviewer but keeps the bank account admin-only', async () => {
    const row = getRefund(db, 1) as unknown as Record<string, unknown>;
    const asReviewer = serializeRowToJson(REFUND_ENTITY, row, 'reviewer');
    const asAdmin = serializeRowToJson(REFUND_ENTITY, row, 'admin');
    assert.equal(asReviewer.card_last4, String(row.card_last4));
    assert.match(String(asReviewer.bank_account), /^\u2022{4}/);
    assert.equal(asAdmin.bank_account, String(row.bank_account));
  });
});

describe('audit log', () => {
  it('is append-only at the storage layer', () => {
    const latest = recentAudit(db, 1)[0];
    assert.ok(latest);
    assert.throws(() => db.prepare('UPDATE audit_log SET action = ? WHERE id = ?').run('tampered', latest.id), /append-only/);
    assert.throws(() => db.prepare('DELETE FROM audit_log WHERE id = ?').run(latest.id), /append-only/);
  });

  it('records actor, role, reason and request id for flag toggles', async () => {
    const flagId = flagIdByKey('checkout.new_card_form');
    await call('POST', `/flags/${flagId}/toggle`, 'admin', { environment: 'prod', enabled: 'true' });
    const entry = db
      .prepare(
        `SELECT * FROM audit_log WHERE entity_type = 'feature_flag' AND entity_id = ? ORDER BY id DESC LIMIT 1`,
      )
      .get(String(flagId)) as { actor_id: string; actor_role: string; action: string; after_json: string; request_id: string };
    assert.equal(entry.actor_id, 'u_admin');
    assert.equal(entry.actor_role, 'admin');
    assert.equal(entry.action, 'flag.toggled');
    assert.deepEqual(JSON.parse(entry.after_json) as Record<string, unknown>, {
      environment: 'prod',
      enabled: true,
      key: 'checkout.new_card_form',
    });
    assert.ok(entry.request_id.length > 0);
  });
});

describe('flag read endpoint', () => {
  it('returns flag state for the requested environment', async () => {
    const response = await call('GET', '/api/flags?env=prod', 'viewer');
    assert.equal(response.status, 200);
    assert.equal(response.json.environment, 'prod');
    const flags = response.json.flags as Record<string, { enabled: boolean }>;
    assert.equal(flags['checkout.new_card_form']?.enabled, true);
  });

  it('rejects an unknown environment', async () => {
    const response = await call('GET', '/api/flags?env=production', 'viewer');
    assert.equal(response.status, 400);
    assert.equal((response.json.error as { code: string }).code, 'INVALID_ENVIRONMENT');
  });
});
