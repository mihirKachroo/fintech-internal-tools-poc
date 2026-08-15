# Prototype scope (2-hour build)

> Planning document, written before implementation. What was actually built — two flows,
> KYC dropped — and every divergence from this plan is recorded in
> [architecture.md](architecture.md).

## Concept

**"Internal Tools Kernel"** — a small, config-driven internal-tools app that demonstrates the *replicable core* of Power Apps for a fintech: a data-backed work queue, role-enforced actions, maker-checker approval, an append-only audit trail, and role-based field masking.

Instantiate it as **two working apps from the same kernel**:
1. **Refunds dashboard** — the risk-bearing app: refunds above a threshold require a second approver.
2. **Feature-flag admin** — the low-risk app: toggle flags per environment, every change audited.
3. **KYC review queue** — shipped as a **third config only** (schema + fields + actions declared, screens render, decisions recorded), explicitly labeled as demonstrating generalization rather than a production KYC tool.

Why two-and-a-half rather than three complete apps: the argument to a VP is not "we can build a screen", it's "the second app cost 15 minutes because the platform pieces are shared". A config-driven kernel makes that visible; three hand-built apps do not.

## Exact features to build

**Data & schema**
- SQLite/Postgres with migrations, seeded demo data (~200 refunds, ~30 flags, ~40 KYC cases).
- Entity config in code (fields, types, list columns, filters, allowed actions, masking rules, approval rules).

**Auth & RBAC (server-enforced)**
- Seeded users with roles: `viewer`, `reviewer`, `approver`, `admin`.
- Session/JWT-based; **every** API route checks role + action permission; UI hiding is a convenience only.
- Demo user switcher to show the same record rendering differently per role.

**Maker-checker approval**
- Refund > $500 → status `pending_approval`; only an `approver` who is *not* the requester can approve; self-approval rejected with a visible error.
- Approve/reject captures actor, timestamp, and a required reason.

**Audit trail**
- Append-only `audit_log` (actor, role, action, entity type/id, before JSON, after JSON, reason, request id, created_at), written in the same DB transaction as the mutation; no update/delete path exposed.
- Per-record "History" panel + a global audit view with filters.

**Field-level masking**
- Masking declared per field per role (e.g. `card_last4`, `ssn_last4`, `bank_account`), applied in the serializer so masked values never leave the server.

**Feature-flag app specifics**
- Flags with per-environment state (dev/staging/prod), optional rollout %, `GET /flags?env=` read endpoint to show the flag-service seam, prod flips audited (and optionally approval-gated to reuse the same rule engine).

**Demo hygiene**
- Seed script, one-command start, and a 6-step scripted walkthrough (reviewer requests refund → cannot self-approve → approver approves → audit trail → masked field as viewer → flag flip audited).

## What to fake / mock

- **Auth:** no real Entra/Okta; seeded users + a role switcher. Show where OIDC/SCIM would plug in.
- **Payment provider:** a stub `PaymentProvider.refund()` that logs an idempotency key and returns success/failure deterministically. No real money movement, no retries/reconciliation.
- **Identity/KYC vendor:** static case fixtures with fake document thumbnails; no vendor API, no document storage.
- **Flag SDK:** a JSON/HTTP read endpoint plus a snippet showing SDK usage; no caching layer, streaming, or edge distribution.
- **Notifications:** approval "emails" written to a table/log pane instead of sent.
- **Deploy/infra:** local run only; a note on where CI/CD and environments would go.

Every mock should be visibly labeled in the UI or README as mocked — the credibility of the recommendation depends on not blurring this.

## What NOT to build

- Any Power-Automate-style visual workflow designer, or a drag-and-drop app builder.
- Real SSO/SCIM, access reviews, or session management.
- Tamper-evident audit storage, retention/legal hold, read/export auditing, compliance evidence export.
- Governance layer (DLP-equivalent policies, environment isolation, sharing limits, app quarantine).
- Multi-environment promotion pipelines, backups/DR.
- Mobile app, offline mode, document/PII storage, connector framework.
- Polished design-system work — clean and legible, not pretty.

## Why this is the right 2-hour scope

- **It targets the parts Power Apps actually sells** (authz, approvals, audit, masking) rather than the part it's famous for (drag-and-drop), so the demo speaks to the VP's real risk questions.
- **It is honest about the gap.** The features deliberately omitted map 1:1 to the "long-term platform work" section of the research brief, which makes the recommendation defensible rather than promotional.
- **It shows marginal cost, not just first-app cost** — the strongest quantitative argument in a build-vs-buy conversation.
- **It sequences risk correctly.** Feature flags (no PII, internal users) is the credible first migration; KYC stays config-only precisely because CIP recordkeeping and PII handling are not 2-hour problems.
- **It is provable in a demo** in under 5 minutes, with the two most persuasive moments — blocked self-approval and a masked field — visible on screen.

## Timeboxing (target 120 min)

| Minutes | Work |
| --- | --- |
| 0–15 | Schema, migrations, seed data, entity configs |
| 15–40 | API: list/detail, role guard, masking serializer, audit writer |
| 40–65 | Refund action + maker-checker rule engine + reason capture |
| 65–85 | UI: queue, detail, history panel, role switcher |
| 85–100 | Feature-flag config instance + read endpoint; KYC config instance |
| 100–115 | Seed/demo script, README with mocked-vs-real table |
| 115–120 | Walkthrough rehearsal |

Cut order if behind: KYC config → global audit view → flag rollout % → approval reason free-text.
