# Architecture (as built)

![Internal tools kernel architecture](architecture-diagram.png)

<sub>Source: [architecture-diagram.svg](architecture-diagram.svg)</sub>

This records what the code actually does and where it diverges from
[prototype-scope.md](prototype-scope.md), which was written before implementation.

## Stack

TypeScript on Node 20, Express 4, `better-sqlite3`, EJS server-rendered templates, `tsx` for
running TS directly. No build step, no client-side framework: every authorization decision is
made on the server, and having no client state makes that easy to demonstrate.

## Shape

```
request
  └─ sessionMiddleware        verifies the JWT (cookie or Bearer), assigns a request id
      └─ requirePermission()  deny-by-default check from ROLE_PERMISSIONS
          └─ flow service     business rules; owns the transaction
              ├─ writeAudit() same transaction as the mutation
              └─ serializer   role-based masking on the way out
```

- **`src/kernel/config.ts`** — roles, permissions, and the entity configs (fields, types, which
  columns list, which roles may see which sensitive field). This is the "kernel" idea: screens,
  masking and audit are generic over this config, so a second flow is mostly declarative.
  Config is code and is reviewed in git; there is no runtime app designer.
- **`src/kernel/auth.ts`** — mints and verifies real signed JWTs for seeded users. Requests with
  no token fall back to the seeded reviewer so the demo needs no login. Only the IdP is faked.
- **`src/kernel/rbac.ts`** — `assertCan(role, permission)`. Every mutation route asserts a
  permission; the UI hides controls purely as a convenience.
- **`src/kernel/masking.ts`** — the only path from a database row to output. A field with
  `visibleTo` is replaced by a masked string for every other role, so masked values never enter
  a response body.
- **`src/kernel/audit.ts`** — one `writeAudit()` used by both flows, called inside the mutation's
  transaction so a failed audit insert fails the business change with it.
- **`src/flows/refunds/`** — `rules.ts` holds the maker-checker policy (threshold, self-decision
  check) so the policy is reviewable in isolation; `service.ts` owns transactions and the mock
  provider call; `router.ts` is HTTP only.
- **`src/flows/flags/`** — same pattern, with production toggles gated by a separate
  `flag.toggle.prod` permission.

## Decisions worth naming

- **Append-only enforced by the database, not convention.** `audit_log` has `BEFORE UPDATE` and
  `BEFORE DELETE` triggers that `RAISE(ABORT)`. A test asserts both. Real tamper-evidence
  (hash chaining, WORM storage, retention/legal hold) is out of scope.
- **The provider call happens outside the write transaction.** A mock returns instantly, but
  holding a transaction open across a network call is the wrong pattern to demonstrate. The
  refund is marked `processed` and audited in a transaction *after* the provider responds; the
  idempotency key (`refund_<id>_settle`) is what makes a retry safe, and the mock replays a
  stored result rather than paying twice.
- **Approval leaves the row `pending_approval` until the provider settles.** The approval and
  the settlement are two audit events (`refund.approved`, then `refund.provider_settled`) rather
  than one, because in production those are genuinely separate outcomes and can diverge.
- **Below-threshold refunds settle immediately** (`refund.auto_processed`) so the threshold rule
  is visible from both sides in one demo.
- **A rejection by the requester is blocked too.** The stated rule is "the requester cannot
  approve their own refund"; blocking self-*decisions* generally is the stricter, simpler
  invariant (`SELF_APPROVAL_BLOCKED`).
- **2,400 seeded refunds, deterministic (`mulberry32(42)`).** Deliberately above the 500/2,000
  row thresholds where Power Apps' non-delegable queries silently truncate, and identical on
  every run so the walkthrough never depends on random data.
- **`npm start` re-seeds.** Demos break when state accumulates; a reset is one command.

## Divergences from prototype-scope.md

| Plan | As built | Why |
| --- | --- | --- |
| Three configs: refunds, flags, KYC | Two flows: refunds, flags | KYC dropped by instruction, and it adds no new mechanics while implying the compliance-heavy part is solved. Rationale is in the README. |
| Postgres *or* SQLite | SQLite only | One-command start with no services to run. Schema is plain SQL and ports directly. |
| Global audit view with filters | Global audit view, no filters | Per-record history carries the demo; filters were the lower-value half. |
| Flag rollout % editable | Stored and shown, set implicitly by the toggle (0/100) | Cut to protect the core; the column exists so the seam is visible. |
| Approval-gated production flag flips | Not built | Explicitly last in priority. Production flips are admin-only and audited, which is the point that matters. |
| Notifications written to a log pane | Not built | Adds no argument the audit trail does not already make. |
| Field masking only | Masking, no just-in-time reveal | Reveal-with-reason plus read logging is the natural next step and is listed as production work in the README. |

## What a production version would need

Unchanged from the research brief: real IdP integration (SCIM, group→role sync, MFA),
tamper-evident audit with retention and read/export logging, compliance evidence and access
reviews, a real payment integration with reconciliation and dead-lettering, environment
promotion with approval gates, backups/DR, and the unglamorous on-call and patching work.
Those are the reasons the recommendation is *sequenced migration*, not a rip-out.
