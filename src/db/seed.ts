import type { Db } from './index.js';
import { ENVIRONMENTS } from '../kernel/config.js';
import { APPROVAL_THRESHOLD_CENTS } from '../flows/refunds/rules.js';

export const DEMO_USERS = [
  { id: 'u_viewer', name: 'Val Viewer', email: 'val@example.com', role: 'viewer' },
  { id: 'u_reviewer', name: 'Rae Reviewer', email: 'rae@example.com', role: 'reviewer' },
  { id: 'u_approver', name: 'Ada Approver', email: 'ada@example.com', role: 'approver' },
  { id: 'u_admin', name: 'Ali Admin', email: 'ali@example.com', role: 'admin' },
] as const;

const FLAGS = [
  { key: 'refunds.instant_payout', name: 'Instant payout', description: 'Pay refunds out immediately instead of nightly batch.', owner: 'payments' },
  { key: 'kyc.auto_approve_low_risk', name: 'Auto-approve low risk KYC', description: 'Skip manual review for low-risk cases.', owner: 'risk' },
  { key: 'checkout.new_card_form', name: 'New card form', description: 'Redesigned checkout card entry.', owner: 'growth' },
  { key: 'billing.retry_dunning_v2', name: 'Dunning retries v2', description: 'Smarter retry schedule for failed charges.', owner: 'billing' },
  { key: 'support.macros_beta', name: 'Support macros beta', description: 'Canned response macros in the support console.', owner: 'support' },
];

const REASONS = [
  'Duplicate charge',
  'Customer cancelled order',
  'Product never delivered',
  'Fraudulent transaction',
  'Price adjustment',
  'Subscription cancelled mid-cycle',
];

const FIRST = ['Alex', 'Blair', 'Casey', 'Devon', 'Emery', 'Frankie', 'Gray', 'Harper', 'Indigo', 'Jules'];
const LAST = ['Alvarez', 'Brooks', 'Chen', 'Dubois', 'Egan', 'Fischer', 'Gupta', 'Haddad', 'Ibrahim', 'Jensen'];

/** Deterministic PRNG so every demo run shows identical data. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('empty pick list');
  return item;
}

export const REFUND_COUNT = 2400;

/**
 * Seeds users, refunds and flags. 2,400 refunds is deliberate: it is past the row
 * count where Power Apps' non-delegable queries silently truncate (500, max 2,000),
 * so the list view can be shown filtering and paginating correctly over the full set.
 */
export function seed(db: Db, now: Date = new Date('2026-08-14T12:00:00Z')): void {
  const rng = mulberry32(42);
  const insertUser = db.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)');
  for (const user of DEMO_USERS) insertUser.run(user.id, user.name, user.email, user.role);

  const insertRefund = db.prepare(`
    INSERT INTO refunds (customer_name, customer_email, card_last4, bank_account, amount_cents,
                         currency, reason, status, requested_by, requested_at, decided_by, decided_at,
                         decision_reason, idempotency_key, provider_reference, provider_status)
    VALUES (@customer_name, @customer_email, @card_last4, @bank_account, @amount_cents,
            'USD', @reason, @status, @requested_by, @requested_at, @decided_by, @decided_at,
            @decision_reason, @idempotency_key, @provider_reference, @provider_status)
  `);

  db.transaction(() => {
    for (let i = 0; i < REFUND_COUNT; i++) {
      const first = pick(rng, FIRST);
      const last = pick(rng, LAST);
      // Skew towards amounts around the threshold so both paths are visible in the queue.
      const amount = Math.floor(rng() * 180000) + 500;
      const requestedAt = new Date(now.getTime() - Math.floor(rng() * 45) * 86400000 - Math.floor(rng() * 86400000));
      const requester = rng() < 0.5 ? 'u_reviewer' : 'u_admin';
      const needsApproval = amount > APPROVAL_THRESHOLD_CENTS;
      // Leave the newest high-value requests pending so the demo always has work to approve.
      const stillPending = needsApproval && rng() < 0.45;
      const decided = !stillPending;
      const rejected = decided && rng() < 0.12;
      const decider = needsApproval ? (rng() < 0.5 ? 'u_approver' : 'u_admin') : requester;
      insertRefund.run({
        customer_name: `${first} ${last}`,
        customer_email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        card_last4: String(1000 + Math.floor(rng() * 8999)).slice(-4),
        bank_account: `DE${String(10 + Math.floor(rng() * 89))}${String(Math.floor(rng() * 1e10)).padStart(10, '0')}`,
        amount_cents: amount,
        reason: pick(rng, REASONS),
        status: stillPending ? 'pending_approval' : rejected ? 'rejected' : 'processed',
        requested_by: requester,
        requested_at: requestedAt.toISOString(),
        decided_by: decided ? decider : null,
        decided_at: decided ? new Date(requestedAt.getTime() + 3600000).toISOString() : null,
        decision_reason: decided ? (rejected ? 'Outside refund window' : 'Verified against order record') : null,
        idempotency_key: decided && !rejected ? `seed_refund_${i}` : null,
        provider_reference: decided && !rejected ? `mock_pi_${100000 + i}` : null,
        provider_status: decided && !rejected ? 'succeeded' : null,
      });
    }
  })();

  const insertFlag = db.prepare('INSERT INTO feature_flags (key, name, description, owner) VALUES (?, ?, ?, ?)');
  const insertState = db.prepare(`
    INSERT INTO flag_states (flag_id, environment, enabled, rollout_pct, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const flag of FLAGS) {
      const flagId = Number(insertFlag.run(flag.key, flag.name, flag.description, flag.owner).lastInsertRowid);
      for (const env of ENVIRONMENTS) {
        const enabled = env === 'prod' ? rng() < 0.4 : rng() < 0.7;
        insertState.run(flagId, env, enabled ? 1 : 0, enabled ? 100 : 0, now.toISOString(), 'u_admin');
      }
    }
  })();
}
