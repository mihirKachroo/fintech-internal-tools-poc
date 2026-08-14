# Internal Tools Kernel (prototype)

A small, config-driven internal-tools app for the Power Apps **build-vs-buy** conversation
described in [docs/research-brief.md](docs/research-brief.md). It is deliberately not a
Power Apps clone: it implements the parts a fintech VP actually asks about — server-enforced
authorization, maker-checker approval, an append-only audit trail, and role-based field
masking — and instantiates them as **two** flows from one shared kernel.

| Flow | What it shows |
| --- | --- |
| **Refunds dashboard** | The risk-bearing app: refunds over $500 require a second, different approver; decisions need a reason; every step is audited; sensitive fields are masked per role. |
| **Feature flag admin** | The low-risk app, built almost entirely from config: per-environment state, production toggles restricted to admins, every toggle audited, plus a read endpoint where a real flag SDK would plug in. |

The argument is the **marginal cost**: the second flow reuses the same RBAC, audit writer,
masking serializer and screens. The kernel plus the refunds flow is ~900 lines;
the entire flag admin flow (service + router + views) is ~215.

## Run it

```bash
npm install
npm start            # re-seeds the demo database, then serves http://localhost:3000
```

`npm start` runs `npm run reset` first, so every demo begins from identical, deterministic
data (seed 42). Use `npm run dev` to keep an existing database and watch for changes.

```bash
npm test             # typecheck + 17 API-level tests (authz, four-eyes, masking, audit)
npm run reset        # wipe and re-seed the demo database
```

Requires Node 20+. Data lives in `data/app.db` (SQLite, gitignored).

## Demo walkthrough

Every step below is exercised by `npm test` as well, so the demo is not the only evidence.

1. **Start** — `npm start`, open <http://localhost:3000>. You land on the refunds queue as
   *Rae Reviewer*. 2,400 seeded refunds, filterable and paginated. (2,400 is deliberate: it
   is past the point where Power Apps' non-delegable queries silently truncate at 500/2,000 rows.)
2. **Request a refund over the threshold** — *Request refund* → submit $820. It lands in
   `pending_approval` and **no** provider call is made yet.
3. **Try to self-approve** — switch the header dropdown to *Ali Admin* and request another
   refund, then try to approve your own request: the server returns `409 SELF_APPROVAL_BLOCKED`.
   As *Rae Reviewer* an approval attempt returns `403 PERMISSION_DENIED` — the reviewer role
   has no approve permission at all.
4. **Approve as a second person** — switch to *Ada Approver*, open the pending refund, enter a
   reason and approve. The mock provider settles it and the status becomes `processed`.
5. **Read the history** — the refund's *History* panel shows `refund.requested`,
   `refund.approved`, `refund.provider_settled` with actor, role, reason, before → after JSON
   and request id. `/audit` shows the same log across both flows.
6. **See masking** — switch to *Val Viewer*. The card tail, customer email and bank account
   render as `••••`. Open `JSON as viewer` (`/api/refunds/<id>`) to confirm the masked values
   are absent from the response body, not merely hidden in the page.
7. **Feature flags** — open *Feature flags*. As *Ada Approver* you can toggle dev/staging; the
   production column says *admin only* (and posting the form directly still returns 403).
   Switch to *Ali Admin* to flip production.
8. **Audit the toggle** — the flag's *History* link (or `/audit`) shows `flag.toggled` with the
   before/after state and who did it.
9. **Read endpoint** — `curl 'http://localhost:3000/api/flags?env=prod'` returns the flag map a
   real SDK would consume.

To prove authorization is server-side rather than UI-deep, call the API with a token:

```bash
# from the repo root, mint a token for the seeded viewer
TOKEN=$(node -e "process.stdout.write(require('jsonwebtoken').sign({sub:'u_viewer',role:'viewer',name:'Val Viewer'},'dev-only-demo-secret'))")

curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/refunds/1
# -> "card_last4":"••••","bank_account":"••••7342"  (masked in the payload itself)

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'accept: application/json' \
  --data 'reason=approved by me' localhost:3000/refunds/1/approve
# -> {"error":{"code":"PERMISSION_DENIED", ...}}
```

## Seeded users and roles

The role switcher in the header mints a **real signed JWT** for the selected user; it is
verified on every request. Only the identity provider is faked, not the authorization.

| User | Role | Permissions |
| --- | --- | --- |
| Val Viewer | `viewer` | read refunds and flags only; sensitive fields masked |
| Rae Reviewer | `reviewer` | request refunds, toggle dev/staging flags, read audit |
| Ada Approver | `approver` | approve/reject refunds, toggle dev/staging flags, read audit |
| Ali Admin | `admin` | everything, including production flag toggles and unmasked bank details |

Permissions are deny-by-default and declared in one place
([`src/kernel/config.ts`](src/kernel/config.ts)); every mutation route asserts one.

## Mocked vs. real

| Area | In this prototype | What production needs |
| --- | --- | --- |
| Identity | Seeded users; role switcher issues a signed JWT | OIDC/SAML via Entra or Okta, SCIM provisioning, group→role sync, MFA |
| Authorization | Real: server-side, deny-by-default, per-route permission checks | Same model, plus record-level scoping and access reviews |
| Audit trail | Real: append-only table written in the mutation's transaction; SQLite triggers reject UPDATE/DELETE | Tamper-evident storage, retention/legal hold, read/export auditing, shipping into the log/warehouse pipeline |
| Field masking | Real: applied in the serializer, so masked values never leave the server | Same, plus just-in-time reveal with reason capture and read logging |
| Payment provider | **Mock** `paymentProvider.refund()`: deterministic success, records and replays idempotency keys | Real provider API, retries, dead-lettering, reconciliation, partial refunds |
| Feature flag delivery | **Mock**: `GET /api/flags?env=` read endpoint | SDK with local cache, streaming updates, edge delivery, kill-switch SLOs |
| Notifications | **None** | Approval requests to email/Slack with deep links |
| Deploy/infra | Local SQLite, single process | Postgres, migrations in CI, environment promotion, backups/DR |
| Governance | **None** | DLP-equivalent policies, environment isolation, sharing limits |

Anything mocked is labelled in the UI as well as here — the credibility of the
recommendation depends on not blurring that line.

## This is not a Power Apps clone

Power Apps' durable value is not the screen builder; it is auth + audit + governance +
release control that auditors already accept (see
[docs/research-brief.md](docs/research-brief.md)). This prototype rebuilds the *enforcement
mechanics* of that list and openly omits the rest. In particular there is **no** drag-and-drop
designer and **no** runtime app authoring: entity configuration lives in TypeScript and is
reviewed in git. The claim is "a small platform makes each additional internal tool cheap",
not "low-code is solved in an afternoon".

## Why KYC was intentionally omitted

The research phase scoped a third flow (a KYC review queue) as config-only, and it was cut
from the build entirely. Two reasons:

1. **It is the one app that should not move first.** CIP records carry a five-year retention
   obligation, and KYC review handles SSN/DOB and identity documents. That needs tamper-evident
   audit, retention and legal hold, read/export auditing, and compliance sign-off — platform
   work, not screen work. Shipping a KYC-shaped demo invites the conclusion that the hard part
   is done.
2. **It would add no new mechanics.** KYC exercises the same queue, RBAC, masking and audit
   already demonstrated by refunds. The generalization argument is carried by the flag admin,
   which is genuinely a different domain.

The recommendation therefore stays: migrate feature flags first, refunds second under explicit
audit requirements, keep KYC on the incumbent platform until compliance signs off. See
[docs/recommendation-outline.md](docs/recommendation-outline.md).

## Layout

```
src/kernel/     config (entities, roles, permissions), auth/JWT, RBAC, masking, audit writer
src/flows/      refunds/ (rules, service, router) and flags/ (service, router)
src/mocks/      payment provider stub
src/db/         schema.sql, deterministic seed, reset script
src/views/      EJS templates (generic list/detail rendering driven by entity config)
src/tests/      API-level tests for authz, four-eyes, masking and audit
docs/           research brief, prototype scope, recommendation outline, architecture, evaluation
```

Design decisions and deviations from the plan: [docs/architecture.md](docs/architecture.md).
What this prototype does and does not prove, and the build-vs-buy call:
[docs/evaluation.md](docs/evaluation.md).
