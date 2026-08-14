-- Internal Tools Kernel schema (SQLite).
-- Everything the two flows (refunds, feature flags) need, plus the shared audit log.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('viewer', 'reviewer', 'approver', 'admin'))
);

CREATE TABLE refunds (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name      TEXT NOT NULL,
  customer_email     TEXT NOT NULL,
  card_last4         TEXT NOT NULL,
  bank_account       TEXT NOT NULL,
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  currency           TEXT NOT NULL DEFAULT 'USD',
  reason             TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('pending_approval', 'processed', 'rejected', 'failed')),
  requested_by       TEXT NOT NULL REFERENCES users(id),
  requested_at       TEXT NOT NULL,
  decided_by         TEXT REFERENCES users(id),
  decided_at         TEXT,
  decision_reason    TEXT,
  idempotency_key    TEXT,
  provider_reference TEXT,
  provider_status    TEXT
);

CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_requested_at ON refunds(requested_at DESC);

CREATE TABLE feature_flags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  owner       TEXT NOT NULL
);

CREATE TABLE flag_states (
  flag_id     INTEGER NOT NULL REFERENCES feature_flags(id),
  environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'prod')),
  enabled     INTEGER NOT NULL DEFAULT 0,
  rollout_pct INTEGER NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  updated_at  TEXT NOT NULL,
  updated_by  TEXT REFERENCES users(id),
  PRIMARY KEY (flag_id, environment)
);

-- Append-only: the triggers below make "who changed what" non-repudiable at the
-- storage layer, not just by convention in application code.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    TEXT NOT NULL,
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  before_json TEXT,
  after_json  TEXT,
  reason      TEXT,
  request_id  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, id DESC);

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;

CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;
