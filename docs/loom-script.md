# Loom script — Power Apps build-vs-buy (target 4:45)

~800 spoken words at ~170 wpm. Stage directions in brackets; timings cumulative.

---

## 0:00 — The ask

[camera, no screen share]

You're paying roughly $250,000 a year for an internal tools platform, and you use it for three
apps: a KYC review queue, a refunds dashboard, and a feature-flag admin panel. You asked whether
you could build those in-house instead — save the license, gain customization control.

Short answer: yes, for two of the three, staged. But not by rebuilding Power Apps. Let me show
you what I built to test that, and be precise about what it proves.

## 0:25 — What Power Apps actually gives you

The usual mistake is treating Power Apps as a screen builder. Screens are the cheap part. What
you're buying is *governed* internal app development: Entra identity with SSO and provisioning; a
thousand-plus connectors with credentials brokered centrally; Power Automate for workflows and
human approvals; Dataverse with record- and column-level security, including field masking; audit
with retention; environments as isolation boundaries with DLP-style policy; pipelines for gated
dev-to-prod promotion. And underneath all of it, attestations your auditors already accept.

That last one you can't write. An honest build case has to price the whole list, not the screens.

## 0:55 — Where Devin fits, and where it doesn't

[camera]

So I'd scope Devin narrowly. It should not recreate that platform — identity, governance,
connectors, compliance posture. That's a multi-year product, built to save license fees on three
tools.

Where it fits: narrow, engineering-owned workflows as normal code — TypeScript in a repo, with
tests, docs, review, and CI. On this project Devin accelerated the vendor research, the
implementation, the tests, the docs, and the review. Not autonomously — the architecture and
security judgments were decisions I made and can defend. That distinction carries the rest of
this.

## 1:20 — What I built

[share screen: repo + README]

I scoped the prototype around one outcome, not a feature list: can a reviewer request a
high-value refund, can the system enforce separation of duties, require a reason from the
approver, and leave an audit trail you'd hand to an auditor?

[show architecture diagram in docs/architecture.md]

A shared kernel — sessions, role-based authorization, masking, one audit writer — with two thin
flows on top. Every authorization decision is server-side, and the audit write happens in the
same database transaction as the change it records, so you can't get a mutation without its audit
row.

I deliberately did not build KYC: PII, ID documents, a vendor integration, five-year
recordkeeping. A version of it would have implied the hard part was solved.

## 1:55 — The refund workflow

[switch to app, /refunds as Rae Reviewer]

The queue — 2,400 rows, past the point where non-delegable Power Apps queries silently truncate.

I request an $820 refund. Over threshold, so it parks in `pending_approval` — and the payment
provider hasn't been called. No money has moved.

Now I try to approve my own request. Blocked — separation of duties, enforced on the server, not
by hiding a button.

[switch user to Ada Approver; approve with a reason]

Different approver, reason required. Now it settles through a mocked provider that records an
idempotency key.

[open history panel]

And there's the outcome: requested, approved, settled — actor, role, reason, before-and-after
values, request ID. Append-only, enforced by database triggers rather than by convention.

[switch user to Val Viewer; then show /api/refunds/1 JSON]

As a viewer, the card tail, email and bank account are masked — masked in the API response
itself, not hidden in the page. That's the difference between a control and a cosmetic.

## 2:45 — Feature flags: the marginal cost

[switch to /flags]

Second app, same kernel. State per environment. Production toggles are admin-only — as an
approver, denied; as an admin, it goes through, audited identically. There's a read endpoint
where your real flag SDK attaches.

The number that matters: kernel plus refunds is about nine hundred lines. This entire second app
is about two hundred.

[show tests running, then the PR]

Seventeen API-level tests assert the authorization, the four-eyes rule, the masking, and the
audit immutability. Typecheck clean, and it went through a PR with a written verification pass.

## 3:15 — What this does not prove

[camera]

No SSO or SCIM. No governance or DLP equivalent. No deploy pipeline, backups, or observability.
Append-only is not tamper-evident — no hash chaining, no retention or legal hold, no read-and-
export auditing, no auditor-facing evidence export. Local SQLite, mocked provider, and no
security review yet.

That's not a gap list you close in a sprint. That *is* the platform work, and it's most of the
real cost.

## 3:40 — Economics

Two things before anyone quotes savings.

Confirm what the $250K covers. At Premium list pricing it implies roughly a thousand seats —
implausible for three apps and sixty engineers. It almost certainly bundles Power Automate,
premium connectors, Dataverse capacity, managed environments, maybe an enterprise commitment.
Retiring three apps may retire very little of that spend.

Then gross versus net. Owning these tools is a permanent quarter to half an engineer — patching,
auth changes, audit requests, on-call. At loaded cost that's a large fraction of the license. So
build only works if usage stays narrow and the spend is genuinely retireable. That is your
situation — three tools, all engineering-owned — which is why I think it's worth doing, carefully.

## 4:05 — Recommendation and pilot

Build the narrow platform, not Power Apps. Migrate app by app, and keep Power Apps running
through the transition. This is not a rip-out.

Feature flags first: your own engineers, no PII, no external approvals, and it belongs beside the
flag service you already run. Refunds second, after a security, finance and audit review, because
it moves money. KYC last — only once audit retention and evidence controls are production-grade.

The pilot: two to four weeks, the flag admin for one engineering team, in production. Real SSO
with group-to-role mapping, a real database, a deploy pipeline, observability, audit retention, a
named owner and an SLA.

It succeeds if that team runs on it in production, every mutation is audited, production changes
are role-gated, SSO mapping works, CI and observability are in place, security review finds
nothing blocking — and projected retired license spend clears the cost of owning it.

That's a decision you can make on evidence in a month, on one app — instead of betting the
platform on it.
