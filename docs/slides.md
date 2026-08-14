---
marp: true
paginate: true
size: 16:9
title: Power Apps build-vs-buy
style: |
  section {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 26px;
    padding: 60px 70px;
    color: #16202b;
    background: #ffffff;
  }
  h1 { font-size: 46px; color: #0f1b2a; margin-bottom: 0.3em; }
  h2 { font-size: 34px; color: #0f1b2a; border-bottom: 2px solid #e3e8ee; padding-bottom: 12px; }
  strong { color: #0b4f9e; }
  code { background: #f2f5f8; }
  ul { line-height: 1.55; }
  section.lead { justify-content: center; text-align: left; }
  section.lead h1 { font-size: 54px; }
  .muted { color: #5a6b7c; font-size: 22px; }
  table { font-size: 22px; }
  th { background: #f2f5f8; text-align: left; }
  section::after { color: #9aa8b5; font-size: 16px; }
  section.diagram { padding: 24px 30px; justify-content: center; align-items: center; }
---

<!-- _class: lead -->
<!-- _paginate: false -->

# Replacing Power Apps with a narrow in-house build

**Recommendation: build — but build only what you actually use.**

<span class="muted">Series C fintech · ~60 engineers · ~$250K/year platform spend · 3 internal tools</span>

---

## The ask

- ~**$250K/year** for Power Apps
- Used for exactly **three** internal tools:
  - KYC review queue
  - Refunds dashboard
  - Feature-flag admin panel
- Question: can Devin help build a lightweight in-house alternative — save license cost, gain control?

**Answer: yes, staged. Not a generic Power Apps replacement.**

---

## How I approached it

1. **What is Power Apps actually providing?**
2. **Build a prototype** of the core mechanics these tools need
3. **Evaluate**: what it proves, what it doesn't, what risk remains in production

---

## Power Apps' value isn't the screens

It's the governed platform around them:

- Identity integration (Entra, SSO, SCIM)
- Connectors to the rest of the business
- Workflow automation and approvals
- Managed environments, DLP, admin controls
- Deployment lifecycle
- **Audit and compliance posture your auditors already accept**

In fintech, that last one is the expensive part.

---

## But the usage here is narrow

- Not hundreds of citizen-developed apps
- **Three** known workflows, all **engineering-owned**
- No non-engineer maker community to support

That changes the build-vs-buy calculus.

---

## What I built

**Internal tools kernel** — TypeScript/Express, SQLite, server-rendered templates

| Shared kernel | Flows on top |
|---|---|
| Sessions (signed JWT) | Refunds dashboard |
| Role-based authorization | Feature flag admin |
| Field masking | |
| Audit writer | |

**KYC intentionally omitted** — highest PII and compliance risk. A short prototype shouldn't imply
document handling, vendor integration, and retention are solved.

---

<!-- _class: diagram -->
<!-- _header: '' -->

![h:670](architecture-diagram.png)

---

## The demo outcome

Not a feature list. One question:

> Can a reviewer request a high-value refund, can the system **enforce separation of duties**,
> **require a reason**, and leave an **audit trail you'd hand to an auditor**?

<span class="muted">[play recorded walkthrough]</span>

---

## Refunds: what the walkthrough shows

- **$820 refund** requested → parks in `pending_approval`, provider never called
- **Self-approval blocked** — enforced server-side, not by hiding a button
- **Different approver, reason required** → settles via mocked provider with an idempotency key
- **History**: requested → approved → settled, each with actor, role, reason, before/after, request ID
- Audit table is **append-only, enforced by the database**
- **Viewer**: card tail, email, bank account masked — *in the API response*, not just the page

---

## Feature flags: the reuse argument

- Same permission and audit machinery, different tool
- Production toggles **admin-only**: approver denied, admin allowed — audited identically

**And it's measurable:**

- Kernel + refunds: **~900 lines**
- Entire second tool: **~200 lines**

Once the kernel exists, the marginal cost of the next internal tool is much lower.

---

## What we replicated

- Server-side authorization on every mutation
- Role-based field masking
- Maker-checker approval with required reason
- Append-only audit + per-record history
- Reusable list/detail admin screens
- Explicit mocked integration boundaries

<span class="muted">Devin accelerated the vendor research, the scaffolding, the tests, the docs, and the review.</span>

---

## What we did not replicate

- Visual app builder · Power Automate equivalent · connector ecosystem
- Real SSO / SCIM / OIDC
- DLP policies, managed environments
- Deployment pipeline, production ownership
- **Compliance-grade audit evidence** — append-only ≠ tamper-evident; no retention, legal hold, or read/export auditing
- Local SQLite; no security review

**These gaps are most of the actual cost.**

---

## Economics: two caveats before anyone books savings

**1. Confirm what the $250K covers.**
At list pricing it implies ~1,000 seats — inconsistent with 3 apps and 60 engineers. Likely bundles
automation, premium connectors, capacity, or an enterprise commitment. *Retiring the apps may retire
less spend than expected.*

**2. Devin changes build cost, not ownership cost.**
Steady state: **0.25–0.5 FTE**, permanently — patching, auth changes, audit requests, on-call.

**Compare net, not gross.**

---

## Governance and risk

| | Prototype | Production requires |
|---|---|---|
| Permissions | deny-by-default RBAC | SSO group → role mapping, access reviews |
| Audit | append-only, transactional | retention, legal hold, evidence export |
| Reliability | single-node SQLite | real DB, backups, alerting |
| Security | none reviewed | security review, secrets, pen test |
| Maintainability | plain code + tests | named owning team, SLA |

---

## Recommendation: migrate app by app

**Keep Power Apps running through the transition. This is not a rip-out.**

1. **Feature flags first** — engineering-owned, no customer PII, close to systems engineers already operate
2. **Refunds second** — mechanics are straightforward, but it moves money: security, finance and audit review, real provider integration, idempotency, reconciliation, alerting, retention
3. **KYC last, or never** — sensitive PII, vendor integration, document handling, regulated recordkeeping

---

## The pilot: 2–4 weeks

**Feature-flag admin, one engineering team, in production.**

Real SSO with group-to-role mapping · real database · CI/CD · observability · audit retention ·
named owner and SLA

In parallel: confirm how much of the $250K can actually be retired.

---

## Success criteria

- One engineering team using it **in production**
- **Every** mutation audited
- Production changes **role-gated**
- SSO / group-role mapping works
- CI/CD and observability in place
- Security review: **no blocking issues**
- **Projected retired license spend > ongoing ownership cost**

<span class="muted">If these hold, migrate flags and evaluate refunds. If they don't, we've spent weeks, not a platform bet.</span>

---

<!-- _class: lead -->

# The short version

**Don't build Power Apps. Build the smaller internal tools platform this company actually needs.**

Given the narrow usage and how much Devin reduces implementation cost, I'd pursue a
**staged in-house build.**
