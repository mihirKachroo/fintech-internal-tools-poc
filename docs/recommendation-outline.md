# Preliminary recommendation outline (for a VP Engineering conversation)

## Headline

**Partial replacement, sequenced — not a wholesale rip-out, and don't book $250K of savings yet.**

Recommended: migrate the **feature-flag admin** in-house first, then the **refunds dashboard** behind explicit approval/audit requirements, and **keep KYC on the incumbent platform** until the in-house audit/PII/retention story is real and reviewed by compliance. Before any of that: establish what the $250K actually buys, because most of it may not be attributable to these three apps.

## Arguments for build

1. **The users are engineers, and one app is engineering infrastructure.** A feature-flag panel belongs next to the flag service; low-code buys nothing here and costs latency and indirection.
2. **Marginal cost collapses after the platform pieces exist.** Authz + audit + approvals + masking are written once; app #2 and #3 are mostly config (this is what the prototype demonstrates).
3. **Customization control is concrete, not hypothetical:** reuse their production authz policy layer, ship audit events into their existing log/warehouse pipeline, embed refund tooling inside existing internal dashboards, git-based review of tool logic.
4. **No platform ceilings.** No delegation limits (500/2,000 non-delegable rows), no per-user API request caps, no Power Fx debugging tax ([delegation](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview), [request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations)).
5. **Reduced lock-in going forward:** Dataverse schemas, Power Fx logic, connectors, and solution artifacts don't port; each new Power App raises the exit price.
6. **Devin changes the build-side math** — the initial build and the ongoing small-change queue (add a column, new filter, new action) are the parts agents do well, which is where internal-tool cost historically accumulated.

## Arguments for buy (keep Power Apps)

1. **Compliance inheritance.** Attestations, OWASP-mapped controls, encryption, CMK/Lockbox, and Purview-integrated activity logs are things auditors already accept ([security FAQs](https://learn.microsoft.com/en-us/power-platform/admin/security/faqs), [Purview activity logs](https://learn.microsoft.com/en-us/power-platform/admin/activity-logging-auditing/activity-logs-dataverse-model-driven-apps)). Recreating the *evidence*, not the feature, is the expensive part.
2. **KYC is regulated recordkeeping.** CIP records carry a 5-year retention obligation ([31 CFR 1020.220(a)(3)](https://www.federalreserve.gov/frrs/regulations/section-1020220-customer-identification-program-requirements-for-banks.htm)); PII masking, retention, and read-auditing are platform problems, not screen problems.
3. **Non-engineer autonomy + guardrails.** Compliance/ops staff can build and change their own views, while DLP policies, environments, and Managed Environment sharing limits bound the blast radius ([data policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention), [Managed Environments](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview)). An in-house tool typically re-centralizes that work onto engineers.
4. **Lifecycle controls out of the box:** Pipelines give approval-gated, tamper-proof promotion to prod ([Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines)) — an in-house equivalent is real work.
5. **Savings may be smaller than headline.** At list ($20/user/mo Premium, $12 at 2,000 seats — [pricing](https://www.microsoft.com/en-us/power-platform/products/power-apps/pricing)), $250K implies far more than these three apps' seats; and ~0.25–0.5 FTE of steady-state maintenance eats a large share of whatever is saved.
6. **Opportunity cost.** Series C engineering capacity spent on internal tooling is capacity off the product.

## Risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Audit/compliance regression on KYC or refunds | Findings in an audit or exam are far more expensive than licenses | Don't migrate KYC first; get compliance sign-off on audit design before refunds go live |
| Savings don't materialize | Spend may be contractual/bundled or partner-driven | Get a line-item breakdown of the $250K before committing to a target |
| Maintenance drift | Internal tools rot; owner leaves, on-call unclear | Named owner, on-call inclusion, dependency automation, budget the 0.25–0.5 FTE explicitly |
| Authz/masking bug leaks PII | Hand-rolled RBAC is the classic failure mode | Server-side enforcement only, deny-by-default, tests per role, external pen test before KYC |
| Re-centralizing change requests onto engineers | Ops/compliance lose self-service | Config-driven schema so non-engineers change config via PR, or keep low-code for the most volatile app |
| Money-movement incidents in refunds | Idempotency/reconciliation errors are customer-visible | Idempotency keys, provider-side limits, dual approval, reconciliation job, staged rollout |
| Vendor exit friction | Data/logic in Dataverse and Power Fx | Export schema + audit history during migration; keep the incumbent live in parallel until reconciled |

## Suggested next steps

1. **Cost forensics (1 week, client-side):** line-item the $250K — seats and SKUs, Power Automate/premium connectors, Dataverse capacity, Managed Environment entitlements, partner/implementation fees, contract end date and true-up terms. Determines whether the savings case exists at all.
2. **Show the prototype** (feature flags + refunds with maker-checker, audit trail, masking) and use it to frame *what is easy* vs. *what is platform work*.
3. **Get compliance/audit into the room early:** ask what evidence they need for refunds and KYC (audit fields, retention, read logging, access reviews). Their answer, not engineering preference, decides KYC.
4. **Pilot: feature-flag admin in-house**, 1–2 sessions of build + a week of internal use; measure change-request turnaround vs. the Power Apps version.
5. **Then refunds**, with dual approval, idempotent provider calls, reconciliation, and audit shipped into their existing log pipeline; run in parallel with the Power App for one cycle and reconcile.
6. **Decide on KYC only after** an audit-ready design exists (immutable audit incl. read/export events, retention/legal hold, PII masking, access reviews) — or keep it bought.
7. **Budget the steady state honestly:** name an owner and reserve 0.25–0.5 FTE; report net savings against that, not gross license cost.

## What I would say to the VP in one paragraph

You can almost certainly replace the *screens* quickly, and the flag admin should probably never have been on Power Apps. What you're really paying Microsoft for is authorization, audit, governance and release control that your auditors already accept — replicable, but as a platform investment, not an afternoon. Migrate the low-risk app now, refunds next under explicit audit requirements, and keep KYC bought until compliance has signed off on the in-house audit story. And check what the $250K actually covers first: the realistic near-term saving is likely a fraction of it, net of the ~0.25–0.5 engineer you'll spend keeping these tools alive.
