# Loom script: Power Apps build-vs-buy

~600 spoken words. The recorded walkthrough carries 1:37 of the runtime, so total lands close to
4 minutes.

How to read this: **bold bracketed lines are actions** (click, play, share a tab). Lines marked
*Transition (say this while clicking)* are the words that cover the switch, so there's no dead air
while the slide changes. Everything else is narration.

## Setup before you hit record

- Deck in full screen: [slides.md](slides.md), 8 slides (7 numbered + closing).
- The recorded walkthrough (`internal-tools-walkthrough-edited.mp4`, 1:37) in a second tab, paused
  at 0:00, full screen ready. This is the demo. Don't click through the app live.

## Cue sheet

| Time | Action | Section |
| --- | --- | --- |
| 0:00 | Start on slide 1 | The ask and the recommendation |
| 0:20 | Click to slide 2 | What Power Apps really sells; why this usage is narrow |
| 0:45 | Click to slide 3 | Architecture, and why not KYC |
| 1:05 | Click to slide 4 | The demo question |
| 1:15 | Switch tab, play the video | Narrate the refund and flag beats |
| 2:50 | Video ends, back to the deck, click to slide 5 | Proves / doesn't prove |
| 3:15 | Click to slide 6 | Gross vs net |
| 3:35 | Click to slide 7 | Migration order, then the pilot |
| 4:05 | Click to the closing slide | Final line |

---

## Slide 1 — title

**[start here, slide 1 already up]**

You're paying roughly $250K a year for Power Apps, and using it for three internal tools: a KYC
review queue, a refunds dashboard, and a feature-flag admin panel. Could Devin build a lightweight
in-house alternative instead?

My answer is yes, build. But build the narrow thing you actually need, not a generic Power Apps
replacement. Here's how I got there.

*Transition (say this while clicking):* "Start with what you're actually paying for."

**[click to slide 2]**

## Slide 2 — the situation  *(0:20)*

Power Apps' value isn't that it makes screens quickly. It's the platform around the screens:
identity, connectors, workflow automation, governance, deployment control, and an audit posture
your auditors already accept. That last one is the part you can't simply write yourself.

But look at the usage. This isn't hundreds of citizen-developed apps. It's three known workflows,
all owned by engineers.

*Transition:* "That's what changes the calculus, so I built something to test it."

**[click to slide 3]**

## Slide 3 — architecture  *(0:45)*

It's an internal tools kernel with two flows: refunds and feature flags. A shared core handles
sessions, authorization, masking and audit, and each tool is thin on top of it. Every request
takes the same four steps: verify the session, check the permission server-side, run the business
rules and the audit write in one transaction, then mask on the way out.

I deliberately left KYC out. It carries the highest PII and compliance risk, and a short prototype
shouldn't imply that document handling, vendor integration and evidence retention are solved.

*Transition:* "Rather than walk the features, I scoped this around one question."

**[click to slide 4]**

## Slide 4 — the demo question  *(1:05)*

Can a reviewer request a high-value refund, can the system enforce separation of duties, require a
reason, and leave an audit trail you'd hand to an auditor?

*Transition:* "Here's that, end to end."

**[switch to the video tab and press play]**

## The video  *(1:15, runs 1:37)*

Narrate over it. The beats arrive in this order.

**[video: creating the request]**

An $820 refund, requested by a reviewer. Over the threshold, so it parks in pending approval, and
the payment provider hasn't been called. No money has moved.

**[video: same user tries to approve]**

Same person tries to approve their own request. Blocked, on the server, not by hiding a button.

**[video: the approver decides]**

A different approver, and a reason is required. Now it settles, through a mocked provider that
records an idempotency key.

**[video: history panel]**

And there's the trail: actor, role, reason, before and after, request ID. Append-only, enforced by
the database.

**[video: viewer's masked view]**

As a low-privilege viewer, the sensitive fields are masked in the API response, not just hidden in
the page. That's the difference between a control and a cosmetic.

**[video: the flags screen]**  *(~2:20)*

Now the same machinery, different tool. Production toggles are admin-only, and every toggle is
audited identically. That's the strongest build argument, and it's measurable: the kernel plus
refunds is about nine hundred lines. This entire second tool is two hundred.

*Transition (as the video ends, switching back to the deck):* "So that's what it does. Here's what
it doesn't."

**[back to the deck, click to slide 5]**

## Slide 5 — what it proves, and what it doesn't  *(2:50)*

Authorization, masking, maker-checker, audit history and reusable screens all replicate cleanly,
and Devin got there fast, with tests and docs.

What it does not replicate is the platform. No visual builder, no connectors, no real SSO, no DLP,
no deployment pipeline, and no compliance-grade audit evidence. Append-only isn't tamper-evident.

*Transition:* "And those gaps are most of the real cost, which brings me to the money."

**[click to slide 6]**

## Slide 6 — economics  *(3:15)*

Two caveats. Confirm what the $250K covers, because at list pricing it implies close to a thousand
seats, which doesn't match three apps and sixty engineers. Retiring the apps may retire less spend
than you'd expect. And Devin changes the build cost, not the ownership cost: a quarter to half an
engineer, permanently. Compare net, not gross.

*Transition:* "If that math holds, the sequencing matters more than the decision itself."

**[click to slide 7]**

## Slide 7 — recommendation and pilot  *(3:35)*

Migrate app by app, keeping Power Apps running through the transition. Feature flags first:
engineering-owned, no customer PII. Refunds second, but only after security, finance and audit
review, because refunds move money. KYC last, or never, unless the compliance controls are mature.

Concretely: a two-to-four-week production pilot of the flag admin for one engineering team, with
real SSO, a real database, CI/CD, observability, audit retention and a named owner. It succeeds if
that team is live on it, every mutation is audited, security review finds nothing blocking, and
the retired spend clears the cost of owning it.

*Transition:* "So, the short version."

**[click to the closing slide]**

## Closing slide  *(4:05)*

Don't build Power Apps. Build the smaller internal tools platform this company actually needs, and
decide it on pilot evidence in a month rather than on a platform bet.
