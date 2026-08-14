# Loom script — Power Apps build-vs-buy

~870 spoken words, roughly 4:45 at a normal pace. Stage directions in brackets; timings
cumulative. Delivery: plain and unhurried, no build-up.

---

**[camera]**

The question this team asked me to evaluate was: you're paying roughly $250K a year for Power
Apps, but you're only using it for three internal tools — a KYC review queue, a refunds
dashboard, and a feature-flag admin panel. Could you use Devin to build a lightweight in-house
alternative, save the license cost, and gain more control?

My recommendation is yes, build — but build the narrow thing you actually need, not a generic
Power Apps replacement.

I approached this in three steps. First, I looked at what Power Apps is really providing. Second,
I used Devin to build a small prototype around the core mechanics these tools need. Third, I
evaluated what the prototype proved, what it did not prove, and what risk would remain in
production.

**[0:35]**

Power Apps' value is not that it lets people build screens quickly. For a company like this, the
value is the platform around the screens: identity integration, connectors, workflow automation,
governance, deployment controls, and audit and compliance posture. In fintech those matter, and
the last one especially — you're inheriting control evidence your auditors already accept, and
that is the part you cannot simply write yourself.

But in this case the usage is narrow. This is not hundreds of citizen-developed apps across the
company. It's three known internal workflows, all owned by engineers. That changes the
build-versus-buy calculus.

**[1:00 — share screen: repo and README]**

The prototype I built is an internal tools kernel with two flows: refunds and feature flags. A
shared core handles sessions, role-based authorization, field masking, and audit; each flow is
thin on top of it.

I intentionally did not build KYC, because KYC carries the highest PII and compliance risk. A
short prototype should not imply that document handling, vendor integration, record retention,
and audit evidence are solved.

**[1:20 — switch to the app, /refunds as a reviewer]**

The refunds flow is the higher-risk operational workflow, and I scoped it around one outcome
rather than a feature list: can a reviewer request a high-value refund, can the system enforce
separation of duties, require a reason, and leave an audit trail you'd be willing to hand to an
auditor?

So — I request an $820 refund. It's over the threshold, so it parks in pending approval, and
notice the payment provider has not been called. No money has moved.

Now I try to approve my own request. Blocked. That's enforced on the server, not by hiding a
button in the UI.

**[switch user to the approver; approve with a reason]**

A different approver, and a reason is required. Now it settles, through a mocked provider that
records an idempotency key — the integration is mocked, but the boundary is explicit.

**[open the history panel]**

And here's the trail: requested, approved, settled, each with actor, role, reason, before and
after values, and a request ID. That table is append-only, enforced by the database itself.

**[switch user to the viewer, then show the JSON response]**

As a low-privilege viewer, the card tail, email and bank account are masked — and masked in the
API response, not just hidden in the page. That's the difference between a control and a cosmetic.

**[2:20 — switch to /flags]**

The feature flag flow demonstrates reuse. Same permission and audit machinery, different tool.
Production toggles are admin-only: as an approver, denied; as an admin, it goes through and it's
audited identically.

That's the strongest build argument, and it's measurable: the kernel plus refunds is about nine
hundred lines of code. This entire second tool is about two hundred. Once the kernel exists, the
marginal cost of the next internal tool is much lower.

**[2:45 — show tests, then the PR]**

What we replicated is the core application logic: server-side authorization, role-based masking,
maker-checker approval, append-only audit with per-record history, and reusable list and detail
screens. Devin was genuinely useful here — for the vendor research, scaffolding this quickly,
writing the tests, keeping the docs aligned with the code, and reviewing the implementation.

**[camera]**

What we did not replicate is the platform. No visual app builder, no Power Automate equivalent,
no connector ecosystem, no real SSO or SCIM, no DLP policies or managed environments, no
deployment pipeline, and no compliance-grade audit evidence — append-only is not tamper-evident,
and there's no retention, legal hold, or read-and-export auditing here. It runs on local SQLite
and it has not had a security review. Those are real gaps, and they're most of the actual cost.

**[3:25]**

I still recommend building, because this company doesn't need to rebuild Power Apps. It needs to
replace a small number of engineering-owned tools. That's a much smaller problem.

Two caveats on the money, though. First, confirm what the $250K actually covers — at list
pricing that implies close to a thousand seats, which doesn't match three apps and sixty
engineers, so it likely bundles automation, premium connectors, capacity, or an enterprise
commitment. Retiring the apps may retire less spend than you'd expect. Second, Devin changes the
build cost, not the ownership cost: a quarter to half an engineer, permanently, for patching,
auth changes, audit requests and on-call. Compare net, not gross.

**[3:55]**

I'd migrate app by app, and keep Power Apps running through the transition.

Feature flags first. Engineering-owned, no customer PII, and it belongs close to the systems your
engineers already operate. That's the cleanest pilot.

Refunds second. The prototype shows the approval and audit mechanics are straightforward, but
refunds move money — so before production I'd require security, finance and audit review, plus
real provider integration, idempotency, reconciliation, alerting and retention.

KYC last, or potentially never, unless the compliance controls are mature: sensitive PII, vendor
integration, document handling, regulated recordkeeping. I would not move it until real SSO,
access reviews, audit retention, evidence export, and compliance sign-off are in place.

**[4:20]**

So the next step I'd recommend is a two-to-four-week production pilot on feature flags for one
engineering team. Real SSO with group-to-role mapping, a real database, CI/CD, observability,
audit retention, a named owner and an SLA. In parallel, confirm how much of the $250K can
actually be retired.

It succeeds if that team is running on it in production, every mutation is audited, production
changes are role-gated, SSO mapping works, security review finds nothing blocking, and the
retired spend clears the cost of owning it. Then migrate flags, evaluate refunds, and leave KYC
where it is.

The short version: don't build Power Apps. Build the smaller internal tools platform this company
actually needs. Given the narrow usage and how much Devin reduces implementation cost, I'd pursue
a staged in-house build.
