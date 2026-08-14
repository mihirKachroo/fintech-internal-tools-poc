# Loom script: Power Apps build-vs-buy

~880 spoken words, roughly 4:45 at a normal pace. Timings are cumulative. Delivery: plain and
unhurried, no build-up.

## Setup before you hit record

- Deck open in presenter/full screen: [slides.md](slides.md), 8 slides (7 numbered + closing).
- The recorded walkthrough (`internal-tools-walkthrough-edited.mp4`, 1:37) open in a second tab,
  paused at 0:00. This is the demo. Do not click through the app live.
- Optional third tab: the repo README and the PR, for the 5 seconds you reference them.

## Cue sheet

| Time | Screen | Section |
| --- | --- | --- |
| 0:00 | Slide 1 (title) | The ask and the recommendation |
| 0:35 | Slide 2 (the situation) | What Power Apps really sells; why this usage is narrow |
| 1:00 | Repo/README for ~5s, then Slide 3 (architecture) | What I built, and why not KYC |
| 1:20 | Slide 4 (the demo), then switch to the video and press play | The refund outcome |
| 2:20 | Video still playing (flags section) | Reuse and marginal cost |
| 2:45 | Video ends. Tests passing + PR for ~5s, then Slide 5 | What it proves |
| 3:05 | Stay on Slide 5 (right column) | What it does not prove |
| 3:25 | Slide 6 (economics) | Gross vs net |
| 3:55 | Slide 7 (recommendation and pilot) | Migration order |
| 4:20 | Stay on Slide 7 (right column) | The pilot and success criteria |
| 4:40 | Closing slide | Final line |

---

## ▶ SLIDE 1 — title

The question this team asked me to evaluate was: you're paying roughly $250K a year for Power
Apps, but you're only using it for three internal tools. A KYC review queue, a refunds dashboard,
and a feature-flag admin panel. Could you use Devin to build a lightweight in-house alternative,
save the license cost, and gain more control?

My recommendation is yes, build. But build the narrow thing you actually need, not a generic
Power Apps replacement.

I approached this in three steps. First, I looked at what Power Apps is really providing. Second,
I used Devin to build a small prototype around the core mechanics these tools need. Third, I
evaluated what the prototype proved, what it did not prove, and what risk would remain in
production.

## ▶ SLIDE 2 — the situation  *(0:35)*

Power Apps' value is not that it lets people build screens quickly. For a company like this, the
value is the platform around the screens: identity integration, connectors, workflow automation,
governance, deployment controls, and audit and compliance posture. In fintech those matter, and
the last one especially. You're inheriting control evidence your auditors already accept, and
that is the part you cannot simply write yourself.

But in this case the usage is narrow. This is not hundreds of citizen-developed apps across the
company. It's three known internal workflows, all owned by engineers. That changes the
build-versus-buy calculus.

## ▶ SHARE THE REPO / README briefly, then SLIDE 3 — architecture  *(1:00)*

The prototype I built is an internal tools kernel with two flows: refunds and feature flags. A
shared core handles sessions, role-based authorization, field masking, and audit, and each flow
is thin on top of it.

*(point at the request pipeline on the diagram)*

Every request goes through the same four steps. Verify the signed session. Check the permission,
server-side. Run the business rules and the audit write in one transaction. Then mask on the way
out.

I intentionally did not build KYC, because KYC carries the highest PII and compliance risk. A
short prototype should not imply that document handling, vendor integration, record retention,
and audit evidence are solved.

## ▶ SLIDE 4 — the demo  *(1:20)*

The refunds flow is the higher-risk operational workflow, and I scoped it around one outcome
rather than a feature list: can a reviewer request a high-value refund, can the system enforce
separation of duties, require a reason, and leave an audit trail you'd be willing to hand to an
auditor?

## ▶ SWITCH TO THE VIDEO AND PRESS PLAY  *(~1:30)*

Narrate over it. The beats arrive in this order.

**Video: the refund queue, then creating the request**

Here I'm requesting an $820 refund as a reviewer. It's over the threshold, so it parks in pending
approval, and notice the payment provider has not been called. No money has moved.

**Video: the same user tries to approve**

Then, as the same person who requested it, I try to approve it. Blocked. That's enforced on the
server, not by hiding a button in the UI.

**Video: switching users, approving with a reason**

A different approver, and a reason is required. Now it settles, through a mocked provider that
records an idempotency key. The integration is mocked, but the boundary is explicit.

**Video: the history panel**

And here's the trail. Requested, approved, settled, each with actor, role, reason, before and
after values, and a request ID. That table is append-only, enforced by the database itself.

**Video: the viewer's masked detail page, then the masked JSON**

As a low-privilege viewer, the card tail, email and bank account are masked. And masked in the
API response, not just hidden in the page. That's the difference between a control and a
cosmetic.

**Video: the flags screen**  *(2:20)*

The feature flag flow demonstrates reuse. Same permission and audit machinery, different tool.
Production toggles are admin-only: as an approver, denied. As an admin, it goes through, and it's
audited identically.

That's the strongest build argument, and it's measurable. The kernel plus refunds is about nine
hundred lines of code. This entire second tool is about two hundred. Once the kernel exists, the
marginal cost of the next internal tool is much lower.

## ▶ VIDEO ENDS. Show the passing tests and the PR for ~5s, then SLIDE 5  *(2:45)*

What we replicated is the core application logic: server-side authorization, role-based masking,
maker-checker approval, append-only audit with per-record history, and reusable list and detail
screens. Devin was genuinely useful here, for the vendor research, scaffolding this quickly,
writing the tests, keeping the docs aligned with the code, and reviewing the implementation.

## ▶ STAY ON SLIDE 5 — right column  *(3:05)*

What we did not replicate is the platform. No visual app builder, no Power Automate equivalent,
no connector ecosystem, no real SSO or SCIM, no DLP policies or managed environments, no
deployment pipeline, and no compliance-grade audit evidence. Append-only is not tamper-evident,
and there's no retention, legal hold, or read-and-export auditing here. It runs on local SQLite
and it has not had a security review. Those are real gaps, and they're most of the actual cost.

## ▶ SLIDE 6 — economics  *(3:25)*

I still recommend building, because this company doesn't need to rebuild Power Apps. It needs to
replace a small number of engineering-owned tools. That's a much smaller problem.

Two caveats on the money. First, confirm what the $250K actually covers. At list pricing that
implies close to a thousand seats, which doesn't match three apps and sixty engineers, so it
likely bundles automation, premium connectors, capacity, or an enterprise commitment. Retiring
the apps may retire less spend than you'd expect. Second, Devin changes the build cost, not the
ownership cost: a quarter to half an engineer, permanently, for patching, auth changes, audit
requests and on-call. Compare net, not gross.

## ▶ SLIDE 7 — recommendation and pilot  *(3:55)*

I'd migrate app by app, and keep Power Apps running through the transition.

Feature flags first. Engineering-owned, no customer PII, and it belongs close to the systems your
engineers already operate. That's the cleanest pilot.

Refunds second. The prototype shows the approval and audit mechanics are straightforward, but
refunds move money, so before production I'd require security, finance and audit review, plus
real provider integration, idempotency, reconciliation, alerting and retention.

KYC last, or potentially never, unless the compliance controls are mature. Sensitive PII, vendor
integration, document handling, regulated recordkeeping. I would not move it until real SSO,
access reviews, audit retention, evidence export, and compliance sign-off are in place.

## ▶ STAY ON SLIDE 7 — right column  *(4:20)*

So the next step I'd recommend is a two-to-four-week production pilot on feature flags for one
engineering team. Real SSO with group-to-role mapping, a real database, CI/CD, observability,
audit retention, a named owner and an SLA. In parallel, confirm how much of the $250K can
actually be retired.

It succeeds if that team is running on it in production, every mutation is audited, production
changes are role-gated, SSO mapping works, security review finds nothing blocking, and the
retired spend clears the cost of owning it. Then migrate flags, evaluate refunds, and leave KYC
where it is.

## ▶ CLOSING SLIDE  *(4:40)*

The short version: don't build Power Apps. Build the smaller internal tools platform this company
actually needs. Given the narrow usage and how much Devin reduces implementation cost, I'd
pursue a staged in-house build.
