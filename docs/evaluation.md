# Evaluation: can an in-house kernel replace Power Apps here?

Audience: VP Engineering. Basis: the prototype in this repo, plus
[research-brief.md](research-brief.md) and [architecture.md](architecture.md).

## 1. Executive summary

The prototype demonstrates one thing clearly: the *mechanics* your internal tools depend on —
server-side action authorization, role-based field masking, maker-checker approval, and an
append-only audit trail written in the same transaction as the mutation — are ordinary
application code, and they are shared code. Two tools (refunds, feature flags) run on one
kernel: the kernel plus the refunds flow is ~900 lines; the entire feature-flag flow is ~215.
The marginal cost of the second tool was small and measurable. That is the strongest fact in
this evaluation, and it is a fact about *screens and rules*, not about running a platform.

It does not demonstrate that you can replace Power Apps. Everything durable that you are
actually paying Microsoft for is absent by design: Entra SSO/SCIM, environment isolation and
DLP-style policy, promotion pipelines with approval gates, tamper-evident audit with retention
and legal hold, read/export auditing, backups/DR, and — most importantly — third-party
attestations your auditors already accept. The prototype runs on local SQLite with a mocked
payment provider and a demo role switcher. It is a working argument about feasibility, not a
migration artifact, and none of it has been through a security review.

Two numbers decide this, and neither is in the prototype. First: what the ~$250K/year actually
buys. At Power Apps Premium list pricing ($20/user/month annually) that figure implies roughly
1,000 seats, which is not plausible for three tools and ~60 engineers — so it very likely
bundles Power Automate, premium connectors, Dataverse capacity, Managed Environment
entitlements, an M365/ELA commitment, or partner services. Retiring three apps may retire
surprisingly little of that spend. Second: your true steady-state ownership cost. Three
in-house internal tools plus the platform substrate beneath them is realistically 0.25–0.5 of an
engineer indefinitely — dependency and CVE patching, auth changes, audit requests, on-call. At
loaded cost that is six figures a year, so the honest comparison is *net* savings, not gross
license savings.

The defensible recommendation is neither "build a Power Apps replacement" nor "renew as is". It
is a per-app decision, sequenced by risk: pilot the feature-flag admin in-house, treat refunds
as a candidate only after a security and design review because it moves money, and leave KYC on
the vendor platform until you have production audit, retention, and evidence capability you can
show an examiner. If non-engineers must keep building tools, or if Microsoft governance and
connectors are load-bearing for you, keep Power Apps regardless of what this prototype shows.

## 2. What we successfully replicated

Verified end to end in a browser walkthrough as four seeded users, plus API-level tests
(17 passing) that assert the same properties without a UI:

| Capability | Status | Evidence |
| --- | --- | --- |
| Internal tool list/detail/queue flows | Replicated | Refund queue with filters and pagination over 2,400 seeded rows — deliberately past the 500/2,000-row point where Power Apps' non-delegable queries silently truncate |
| Action-level RBAC, server-enforced | Replicated | `assertCan(role, permission)` on every mutation, deny-by-default; UI hiding is cosmetic. Viewer POST → 403; reviewer approve → 403; approver prod flag toggle → 403 |
| Maker-checker approval | Replicated | Refunds over $500 park in `pending_approval`; a different approver must decide; self-decision → 409 `SELF_APPROVAL_BLOCKED`; empty/whitespace reason → 400 |
| Audit logging + per-record history | Replicated | One shared `writeAudit()` inside the mutation's transaction; actor, role, before→after JSON, reason, request id; per-record History panel and a global `/audit` view; `UPDATE`/`DELETE` on `audit_log` rejected by database triggers |
| Field masking | Replicated | Applied in the serializer, so masked values never enter a response body — a viewer's `GET /api/refunds/1` returns `"card_last4":"••••"`, the same call as admin returns the real value |
| Shared kernel reuse across two tools | Replicated, and measured | Second tool = ~215 lines against ~900 lines of kernel + first tool |
| Mocked external boundaries | Replicated as boundaries | Deterministic payment provider that records and replays by idempotency key; `GET /api/flags?env=` as the flag-SDK seam; JWT-based sessions as the IdP seam |

Two details are worth more than they look. The demo role switcher mints a **real signed JWT**,
so a forged or downgraded token is rejected by the same middleware that serves the browser —
the authorization being demonstrated is not UI state. And the audit log's immutability is
enforced by the database, not by convention or code review.

## 3. What we did not replicate

Not partially, not approximately — absent:

- **Visual app builder.** No canvas/model-driven designer. Configuration is TypeScript reviewed
  in git. A non-engineer cannot build or change a tool here.
- **Workflow designer.** No Power Automate equivalent: no visual flows, no approval inbox, no
  email/Teams/mobile approval tasks, no scheduled or event-triggered automation.
- **Connector ecosystem.** No connector framework, no credential broker, no on-prem gateway.
  Each integration is bespoke code.
- **Microsoft ecosystem integration.** No Entra, Teams, Purview, Dataverse, or Dynamics
  interoperability.
- **Real identity.** No OIDC/SSO, no MFA or conditional access, no SCIM provisioning,
  no group→role sync, no deprovisioning path. Seeded users only.
- **Governance.** No environment isolation, no DLP-equivalent data policy, no sharing limits,
  no app quarantine, no admin console, no access reviews.
- **Deployment and lifecycle.** Local run only. No CI/CD, no dev→QA→prod promotion with gates,
  no artifact immutability, no backups/DR, no restore testing, no observability, no on-call.
- **Compliance-grade audit evidence.** Append-only ≠ tamper-evident. No hash chaining or WORM
  storage, no retention policy or legal hold, no auditing of reads/exports, no auditor-facing
  evidence export, no SOC 2 control mapping, no data-residency controls. (Worth knowing: Power
  Apps does not audit retrieve/export operations through Dataverse auditing either — that needs
  Purview, with its own licensing prerequisites. Your inherited baseline is not as complete as
  the marketing implies.)
- **KYC production requirements.** Intentionally not built: PII and document handling, vendor
  integration, and CIP recordkeeping with 5-year retention (31 CFR 1020.220(a)(3)). The
  prototype would add no new mechanics while implying the hard part was solved.
- **Mobile/offline.** None. Relevant only if any current app is used on phones or in the field —
  worth checking, because Power Apps gives that away and rebuilding it is not cheap.
- **Production payment integration.** The provider is a mock: no real API, retries,
  dead-lettering, reconciliation, or partial-failure handling.

## 4. Build cost and maintenance analysis

**Cheap to continue.** More of what the prototype already does: additional entities, list/detail
screens, new actions on the existing permission model, additional audited mutations, new
approval thresholds, more tests. This is the part where AI assistance compounds — a third tool
of the same shape is days of work, not a quarter, and the kernel absorbs most of it.

**Becomes ongoing platform work.** Everything in §3, and it does not stop:

- Real IdP integration and its lifecycle (role mapping drift, deprovisioning SLAs).
- Audit you can defend to an examiner: integrity guarantees, retention, read/export logging,
  evidence export.
- Deployment, environments, promotion gates, backups and tested restores.
- Observability, alerting, and an actual on-call rotation for tools that block operational work.
- The upgrade treadmill: dependency and CVE patching, framework majors, database upgrades.
- Authorization correctness as the tool grows — the failure mode is silent and it is the one
  that hurts a fintech most.

**Ownership required.** A pilot needs one named owning team, one engineer as primary (not
20% of four people), plus real security review time. Steady state for a small portfolio of
internal tools is 0.25–0.5 FTE, and it is not optional or deferrable — internal tools that
compliance depends on cannot be unowned.

**Likely hidden costs.** An in-house tool becomes a system of record for decisions: audit
requests land on your team, not on Microsoft's. Add: security review and pen-test cycles;
onboarding new engineers to a bespoke platform; the incentive to say yes to internal feature
requests once building is easy; the bus-factor risk of a kernel one person understands; and, if
data has to be copied anywhere, a second system of record with sync and residency implications.

**Opportunity cost.** Every engineer-hour on internal tooling is off the revenue product — and
0.25–0.5 FTE loaded is a meaningful fraction of $250K before you count review and incident time.
The counterweight is real: Power Apps' delegation limits and Power Fx debugging are a recurring
tax on engineers who are fast in code, and co-locating the flag admin with the flag service is
a genuine capability, not a preference. But if you cannot confirm that retiring these three apps
retires most of the $250K, the financial case is weak on its own, and the argument has to rest on
control and fit instead.

## 5. Security and compliance implications

**Fintech-specific concerns.** Refund tooling moves money: authorization gaps, missing
idempotency, or a weak approval rule are direct financial loss, and the tool is very likely to
be pulled into audit scope. KYC decisions are regulated records with retention obligations. In
both cases the expensive part is not the screens — it is proving *who* could see and do *what*,
and being able to show it later. Buying inherits that evidence; building means producing it.

**Why feature flags and refunds are plausible first migrations.** Feature flags: users are your
own engineers, there is no customer PII, no external approval chain, the tool is latency
sensitive on the read path, and it belongs next to the flag service you already run. Blast radius
is real (a bad prod flip) but it is contained by admin-only prod toggles, audit, and your normal
incident process. Note the honest complication from the brief: flag admin is arguably a buy
decision against LaunchDarkly/Unleash, not against Power Apps.

Refunds: the mechanics are exactly what the prototype exercises, and the rules are legible and
testable in code — which is an advantage over rules buried in a canvas app. But it moves money,
so it should follow a security and design review covering authorization, idempotency and
reconciliation with the provider, and audit retention. Not first, and not without that review.

**Why KYC should be treated cautiously.** Highest PII sensitivity (SSN/DOB, ID documents),
vendor integration, and CIP recordkeeping with 5-year retention. Custom audit storage and
custom masking on that data are where a mistake is most expensive and hardest to detect. Move
it, if ever, only once production audit, retention, evidence export, and access reviews exist
and have been reviewed.

**Risk of replacing vendor-managed governance with custom code.** Power Apps' governance is
partly a constraint *on your own people*: environment isolation, DLP policy, sharing limits,
app quarantine. Rebuilding that is a platform project. If only engineers build tools and code
review plus CI is your control, much of it is redundant — that is a defensible position, but
state it explicitly and get your security and compliance owners to agree in writing, because
"code review is our governance" is the claim an auditor will test. Also note the loss of
inherited attestations: SOC/ISO evidence for Microsoft's platform stops applying to code you own.

## 6. Devin-specific assessment

**Where it helped, concretely, in this exercise.** The research brief (Microsoft's licensing,
audit, and governance behavior, with primary sources) and this prototype — kernel, two flows,
seeded data, 17 API-level tests, README, and architecture notes — came from a small number of
sessions rather than a sprint. That is representative of where the leverage is real: vendor
research and source gathering; scaffolding a service; repetitive CRUD, list/detail and admin
screens; test suites that assert properties rather than snapshots; documentation kept in sync
with code; and reviewing a diff for obvious authorization or masking mistakes. For a portfolio
of internal tools that are structurally similar, this changes the economics of *building* them
materially — that is the honest core of the build case.

**Where it does not transfer responsibility.** Architecture and security decisions still need
an owner who can be argued with. Compliance interpretation — what satisfies your examiner, what
retention applies, what counts as evidence — is a human judgment with legal consequences.
Production ownership, on-call, and incident response require accountable people. Access-control
correctness needs adversarial human review: the prototype's authorization is deny-by-default and
tested, but "tested" means "tested against the cases we thought of", and this code has had no
security review. AI throughput lowers the cost of building; it does not lower the cost of being
responsible for what you built, and that second cost is most of the ongoing spend.

## 7. Build-vs-buy recommendation

**Do not build a generic Power Apps replacement.** You would be committing to an identity,
governance, audit, and lifecycle platform in order to save license fees on three tools — the
wrong trade for a Series C fintech, and the prototype is not evidence that it is feasible.

**Do pilot a narrow in-house replacement for engineering-owned, low-to-medium-risk tools.**
Sequenced:

1. **Feature-flag admin — pilot this first.** Engineering-owned, no PII, no external approvals,
   naturally co-located with your flag service. Also worth comparing against a dedicated flag
   vendor in the same evaluation.
2. **Refunds — plausible second, gated on review.** Only after a security and design review
   covering authorization, idempotency and reconciliation, and audit retention. It moves money.
3. **KYC — keep on the vendor platform for now.** PII, vendor integration, and 5-year CIP
   recordkeeping make it the worst possible first migration.

**Keep Power Apps if** non-engineers need to keep building or changing tools, or if Microsoft
governance (environments, DLP, Managed Environments), connectors, or Teams/Purview integration
carry real value for you, or if compliance is unwilling to accept code review and CI in place of
vendor-managed governance. Any one of these makes migration a bad trade regardless of the
prototype.

**Migration is worth exploring if** usage genuinely stays limited to a few engineering-owned
tools, *and* you can confirm that retiring them retires most of the $250K, *and* you will fund
0.25–0.5 FTE of ongoing ownership. Decide per app. Any all-or-nothing framing of this decision
is the wrong framing.

## 8. Recommended next steps

1. **Confirm what the $250K actually covers** — seats vs. Power Automate vs. premium connectors
   vs. Dataverse capacity vs. Managed Environments vs. ELA commitment vs. partner services. Do
   this first; it can settle the decision on its own.
2. **Run a 2–4 week pilot hardening one flow** (feature flags): real database, real deploy, CI,
   observability, and the flag SDK read path in place of the mock.
3. **Security review of the pilot** — threat model, authorization test coverage, secrets
   handling, masking correctness, dependency posture. Written findings, named owner.
4. **Integrate real SSO/OIDC** with group→role mapping, and decide the provisioning and
   deprovisioning path (SCIM or a documented manual process with an SLA).
5. **Write the production audit and logging plan** before migrating anything money- or
   PII-adjacent: integrity, retention, read/export logging, evidence export, and who answers an
   auditor's request.
6. **Define ownership and SLA** — owning team, primary engineer, on-call expectations,
   escalation, and what "down" means for each tool.
7. **Build the net cost comparison** against renewal: pilot cost, steady-state FTE at loaded
   cost, security review cycles, and the portion of license spend that would actually be
   retired.
8. **Decide per app, at a checkpoint after the pilot** — migrate flags, review refunds, keep KYC
   — and revisit on a schedule rather than committing to a platform up front.

## Key recommendation in five bullets

- **The prototype proves the mechanics are cheap to build and reusable** (~215 lines for the
  second tool on a ~900-line kernel); it proves nothing about identity, governance, audit
  evidence, or running this in production.
- **Do not replace Power Apps wholesale.** Decide per app, sequenced by risk: flags first,
  refunds after a security review, KYC not yet.
- **Verify the $250K before quoting savings**, and compare *net* of 0.25–0.5 FTE of permanent
  ownership plus review and incident cost — the gross license figure is not the saving.
- **Compliance-grade audit, real SSO/SCIM, and governance are the actual project.** Budget them
  explicitly, or the build case is being priced with the hard parts missing.
- **Run a 2–4 week pilot on the flag admin with a security review and a named owner**, then
  decide at a checkpoint. If non-engineers must keep building tools, or Microsoft governance and
  connectors are core value, keep Power Apps.
