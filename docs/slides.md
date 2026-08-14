---
marp: true
paginate: true
size: 16:9
title: Power Apps build-vs-buy
style: |
  section {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 27px;
    line-height: 1.5;
    padding: 64px 76px;
    color: #16202b;
    background: #ffffff;
  }
  h1 { font-size: 52px; color: #0f1b2a; letter-spacing: -0.5px; margin: 0 0 0.35em; }
  h2 {
    font-size: 36px; color: #0f1b2a; margin: 0 0 0.7em;
    letter-spacing: -0.3px;
  }
  h2::after {
    content: ''; display: block; width: 64px; height: 4px;
    background: #0b4f9e; border-radius: 2px; margin-top: 16px;
  }
  h3 { font-size: 23px; color: #0b4f9e; margin: 0 0 0.4em; letter-spacing: 0.4px; text-transform: uppercase; }
  strong { color: #0b4f9e; }
  ul { margin: 0; padding-left: 1.1em; }
  li { margin-bottom: 0.35em; }
  blockquote { border-left: 5px solid #0b4f9e; margin: 0 0 40px; padding: 4px 0 4px 28px; font-size: 30px; color: #0f1b2a; }
  section::after { color: #9aa8b5; font-size: 15px; }
  .cols { display: flex; gap: 44px; }
  .cols > div { flex: 1; }
  .card { background: #f4f7fa; border-radius: 12px; padding: 22px 26px; }
  .card.warn { background: #fdf7ee; }
  .muted { color: #5a6b7c; font-size: 21px; }
  .kicker { color: #0b4f9e; font-size: 20px; letter-spacing: 1.6px; text-transform: uppercase; font-weight: bold; }
  section.title { background: #0f1b2a; color: #ffffff; justify-content: center; }
  section.title h1 { color: #ffffff; font-size: 58px; }
  section.title strong { color: #7fb2ec; }
  section.title .muted { color: #9fb3c6; }
  section.title::after { color: #4a6076; }
  section.diagram { padding: 26px 32px; justify-content: center; align-items: center; }
  section.close { background: #0f1b2a; color: #ffffff; justify-content: center; }
  section.close h1 { color: #ffffff; }
  section.close strong { color: #7fb2ec; }
  section.close .muted { color: #9fb3c6; }
  section.close::after { color: #4a6076; }
---

<!-- _class: title -->
<!-- _paginate: false -->

<span class="kicker">Internal tools · build vs buy</span>

# Replace Power Apps — narrowly

**Build only the tools you actually use. One app at a time.**

---

## The situation

<div class="cols">
<div>

### What Power Apps sells you

- Identity: Entra, SSO, SCIM
- Connectors to the rest of the business
- Workflow automation and approvals
- Managed environments, DLP, admin controls
- Deployment lifecycle
- **Audit posture your auditors already accept**

</div>
<div>

### What this company uses

- **Three** internal workflows: KYC queue, refunds dashboard, feature-flag admin
- All **engineering-owned**, ~60 engineers
- No non-engineer maker community
- No connector sprawl

<div class="card">

~$250K/year buys a citizen-developer program. You're running three apps.

</div>

</div>
</div>

---

<!-- _class: diagram -->

![h:670](architecture-diagram.png)

---

## The demo

> Can a reviewer request a high-value refund, can the system **enforce separation of duties**,
> **require a reason**, and leave an **audit trail you'd hand to an auditor**?

<div class="cols">
<div>

### Refunds — the hard one

$820 request parks unpaid · self-approval **blocked server-side** · second approver must give a reason · full history with actor, role, before/after · viewer sees masked PII **in the API response**

</div>
<div>

### Flags — the reuse proof

Same authorization and audit machinery · prod toggles admin-only · **~495 lines** for refunds, **~215** for the second tool

</div>
</div>

<span class="muted">[play recorded walkthrough]</span>

---

## What it proves — and what it doesn't

<div class="cols">
<div>

### Replicated

- Server-side authorization on every mutation
- Role-based field masking
- Maker-checker with required reason
- Append-only audit + per-record history
- Reusable list/detail screens
- Explicit mocked integration seams

</div>
<div>

### Not replicated

- Visual builder, Power Automate, connectors
- Real SSO / SCIM, DLP, managed environments
- Deployment pipeline, production ownership
- **Compliance-grade audit evidence** — append-only ≠ tamper-evident; no retention or legal hold
- Local SQLite; no security review

</div>
</div>

<span class="muted">Devin accelerated the research, scaffolding, tests, docs and review. The architecture and security calls are mine to defend.</span>

---

## Economics, honestly

<div class="cols">
<div>

<div class="card">

### 1 · Confirm the $250K

At list pricing it implies **~1,000 seats** — which doesn't match 3 apps and 60 engineers. Likely bundles automation, premium connectors, capacity, or an enterprise commitment.

**Retiring the apps may retire less spend than expected.**

</div>
</div>
<div>

<div class="card warn">

### 2 · Ownership never retires

Devin changes build cost, not ownership cost: **0.25–0.5 FTE permanently** for patching, auth changes, audit requests, on-call.

**Compare net, not gross.**

</div>
</div>
</div>

<span class="muted">Build still wins if the usage stays narrow and the retireable spend is real.</span>

---

## Recommendation and pilot

<div class="cols">
<div>

### Migrate app by app

1. **Feature flags first** — engineering-owned, no customer PII
2. **Refunds second** — only after security, finance and audit review; it moves money
3. **KYC last, or never** — PII, vendor integration, regulated recordkeeping

</div>
<div>

### Pilot: 2–4 weeks

Feature-flag admin, **one engineering team, in production**. Real SSO group→role mapping, real DB, CI/CD, observability, audit retention, named owner and SLA.

**Succeeds if:** every mutation audited · prod changes role-gated · SSO mapping works · security review clean · **retired spend > ownership cost**

</div>
</div>

---

<!-- _class: close -->
<!-- _paginate: false -->

# Don't build Power Apps.

**Build the smaller internal tools platform this company actually needs.**

<span class="muted">Narrow usage, a real kernel, and a staged migration — decided on pilot evidence in a month, not on a platform bet.</span>
