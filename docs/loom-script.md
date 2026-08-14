# Loom script — Power Apps build-vs-buy (target 4:45)

Spoken pace ~165 wpm. Stage directions in brackets. Timings are cumulative.

---

## 0:00 — The ask

[camera, no screen share]

You're paying roughly $250,000 a year for an internal tools platform, and you're using it for
three apps: a KYC review queue, a refunds dashboard, and a feature-flag admin panel. The question
you asked is whether you could build those in-house instead — save the license cost, get
customization control.

Short answer: yes, for two of the three, and you should stage it. But not by rebuilding Power
Apps. I want to show you what I built to test that, and be precise about what it proves and what
it doesn't.

## 0:25 — What Power Apps actually gives you

The mistake in most of these conversations is treating Power Apps as a screen builder. The
screens are the cheap part. What you're really buying is *governed* internal app development:

Entra identity with SSO and provisioning. A thousand-plus connectors, with credentials brokered
at the environment level. Power Automate for workflows and human approvals. Dataverse with
record- and column-level security, including field masking. Audit at the environment, table, and
column level with retention. Environments as isolation boundaries, DLP-style policies, sharing
limits. Solutions and pipelines for gated dev-to-prod promotion. And underneath all of it,
attestations your auditors already accept.

That last one is the part you can't write. Any honest build case has to price the whole list, not
the screens.

## 1:05 — Where Devin fits, and where it doesn't

[camera]

So I'd frame Devin's role narrowly. Devin should not recreate that platform — identity,
governance, connector ecosystem, compliance posture. That's a multi-year product, and you'd be
building it to save license fees on three tools.

Where it does fit: narrow, engineering-owned workflows, built as normal code — TypeScript in a
repo, with tests, docs, code review, and CI. On this project Devin accelerated the vendor
research, the implementation, the test suite, the documentation, and the review. Not
autonomously — the architecture and the security judgments were decisions I made and can defend.
That distinction matters for the rest of this.

## 1:35 — What I built, and the outcome it targets

[share screen: repo + README]

I scoped the prototype around one outcome, not a feature list. The question was: can a reviewer
request a high-value refund, can the system enforce separation of duties, require a reason from
the approver, and leave an audit trail you'd be willing to hand to an auditor?

[show architecture diagram in docs/architecture.md]

The shape is a shared kernel — sessions, role-based authorization, field masking, one audit
writer — with two thin flows on top: refunds and feature flags. Every authorization decision is
server-side. The audit write happens inside the same database transaction as the change it
records, so you can't get a mutation without its audit row.

I deliberately did not build KYC. It's PII, ID documents, a vendor integration, and five-year
recordkeeping. Building a version of it would have implied the hard part was solved.

## 2:10 — The refund workflow

[switch to app, /refunds as Rae Reviewer]

Refund queue — 2,400 seeded rows, which is past the point where non-delegable Power Apps queries
silently truncate.

I request an $820 refund. Over the threshold, so it parks in `pending_approval` — and note the
payment provider hasn't been called. No money has moved.

Now I try to approve my own request. Blocked — separation of duties, enforced on the server, not
by hiding a button.

[switch user to Ada Approver, approve with a reason]

Different approver. A reason is required. Now it settles, through a mocked provider that records
an idempotency key.

[open history panel]

And here's the outcome: requested, approved, settled — with actor, role, reason, before-and-after
values, and a request ID. That table is append-only, enforced by database triggers, not by
convention.

[switch user to Val Viewer; then show /api/refunds/1 JSON]

As a viewer, the card tail, email and bank account are masked — and masked in the API response
itself, not hidden in the page. That's the difference between a control and a cosmetic.

## 3:05 — Feature flags, as evidence of marginal cost

[switch to /flags]

Second app, same kernel. Flags per environment. Production toggles are admin-only — I'll try as
an approver, denied; as an admin, it goes through, and it's audited the same way. There's a read
endpoint where your real flag SDK would attach.

The number that matters: the kernel plus refunds is about nine hundred lines. This entire second
app is about two hundred. That's the marginal cost argument — and it's the strongest fact here.

[show tests running, then the PR]

Tests and typecheck pass — seventeen API-level tests asserting the authorization, the four-eyes
rule, the masking, and the audit immutability. All of it went through a PR with a written
verification pass.

## 3:35 — What this does not prove

[camera]

No SSO or SCIM. No governance or DLP equivalent. No deployment pipeline, backups, or
observability. Append-only is not tamper-evident — no hash chaining, no retention or legal hold,
no read and export auditing, no auditor-facing evidence export. It runs on local SQLite with a
mocked provider, and it has not had a security review.

That's not a gap list to close in a sprint. That *is* the platform work, and it's most of the
real cost.

## 4:00 — Economics

Two things to nail before anyone quotes savings.

First, confirm what the $250K covers. At Premium list pricing that implies roughly a thousand
seats — implausible for three apps and sixty engineers. It almost certainly bundles Power
Automate, premium connectors, Dataverse capacity, managed environments, maybe an enterprise
commitment. Retiring three apps may retire very little of that spend.

Second, gross versus net. Owning these tools is a permanent quarter to half an engineer —
patching, auth changes, audit requests, on-call. At loaded cost that's a large fraction of the
license. So the build case only works if usage genuinely stays narrow and the license spend is
actually retireable. Which is exactly your situation — three tools, all engineering-owned — so
it's worth doing, carefully.

## 4:25 — Recommendation and pilot

Build the narrow platform, not Power Apps. Migrate app by app, and keep Power Apps running
through the transition — this is not a rip-out.

Feature flags first: your own engineers, no PII, no external approvals, and it belongs next to
the flag service you already run. Refunds second, only after a security, finance and audit
review, because it moves money. KYC last, or never — only once your audit retention and evidence
controls are production-grade.

The pilot: two to four weeks, the flag admin for one engineering team, in production. Real SSO
with group-to-role mapping, a real database, a deploy pipeline, observability, audit retention, a
named owner and an SLA.

It succeeds if that team runs on it in production, every mutation is audited, production changes
are role-gated, SSO mapping works, CI and observability are in place, security review finds
nothing blocking — and projected retired license spend clears the cost of owning it.

That's a decision you can make with evidence in a month, on one app, instead of betting the
platform.
