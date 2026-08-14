# Research brief: Microsoft Power Apps vs. an in-house internal tools stack

**Audience:** VP Engineering, Series C fintech (~60 engineers), currently ~$250K/yr on Power Apps for 3 internal apps (KYC review queue, refunds dashboard, feature-flag admin).
**Date of research:** 2026-08-14. All Microsoft claims are from Microsoft Learn / Microsoft pricing pages (links inline).

---

## 1. What Power Apps actually is, and where the value sits

Power Apps is not a UI builder; it is a **hosted application platform**. Microsoft describes it as "a suite of apps, services, and connectors, as well as a data platform" for building canvas and model-driven apps over Dataverse or external data sources ([What is Power Apps?](https://learn.microsoft.com/en-us/power-apps/powerapps-overview)).

The value is concentrated in the parts you don't see in the app UI:

| Layer | What you're paying for |
| --- | --- |
| Data platform (Dataverse) | Managed relational store + relationships, business logic, and a security model ([Dataverse intro](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/data-platform-intro)) |
| Identity & authorization | Microsoft Entra ID auth (OAuth 2.0), role-based + record-level + column-level security ([Dataverse security roles](https://learn.microsoft.com/en-us/power-platform/admin/database-security), [column-level security](https://learn.microsoft.com/en-us/power-platform/admin/field-level-security)) |
| Audit | Environment/table/column-level audit logging with retention policy, per-record Audit History, plus activity logs surfaced in Microsoft Purview ([Manage Dataverse auditing](https://learn.microsoft.com/en-us/power-platform/admin/manage-dataverse-auditing), [Purview activity logs](https://learn.microsoft.com/en-us/power-platform/admin/activity-logging-auditing/activity-logs-dataverse-model-driven-apps)) |
| Workflow | Power Automate flows and human approvals ("Start and wait for an approval") ([approval workflow](https://learn.microsoft.com/en-us/power-automate/modern-approvals)) |
| Connectivity | ~1,000+ prebuilt/certified connectors plus custom connectors ([connector reference](https://learn.microsoft.com/en-us/connectors/connector-reference/)) |
| Governance | Environments as isolation boundaries, DLP/data policies over connectors, Managed Environments (IP firewall, CMK, Lockbox, sharing limits) ([environments](https://learn.microsoft.com/en-us/power-platform/admin/wp-environments), [data policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention), [Managed Environments](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview)) |
| Lifecycle | Solutions as the deployment unit, in-product Pipelines dev→QA→prod with delegated (approval-gated) deployments ([ALM overview](https://learn.microsoft.com/en-us/power-platform/alm/overview-alm), [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines)) |
| Security posture | Documented OWASP Top 10 mitigations, TLS 1.2+, encryption at rest, SDL/threat modeling, third-party attestations via Service Trust Portal ([Power Platform security FAQs](https://learn.microsoft.com/en-us/power-platform/admin/security/faqs), [Service Trust Portal](https://servicetrust.microsoft.com/)) |

**Honest read:** the app-building speed is the marketing hook; the durable value is auth + audit + governance + release control that an auditor already recognizes. That is exactly the part a 2-hour prototype cannot honestly claim to replace.

## 2. Capability-by-capability, judged for this team

**Low-code app creation.** Canvas apps (Power Fx, PowerPoint-like designer) and model-driven apps generated from the data model. Real for non-engineers; for 60 engineers the leverage is much smaller — they can write React/TypeScript. Notable ceiling: non-delegable queries silently operate on only the first 500 rows (configurable to 2,000), which is a correctness trap on large tables ([delegation](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview)).

**Data connectors.** Standard/premium/custom connectors; connections store credentials at the environment level ([data policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention)). For this team the relevant connectors are their own Postgres/API + Stripe-like payment provider + identity vendor — mostly custom-connector or premium territory, i.e. the least differentiated part of the platform.

**Dataverse / data modeling.** Tables, relationships, business rules, and per-column security. The strategic question: their KYC/refunds data of record almost certainly already lives in their own production Postgres. If Power Apps reads that system directly, Dataverse's security/audit features don't apply to it; if data is copied into Dataverse, they now run a second system of record with sync and residency implications ([environments are region-bound](https://learn.microsoft.com/en-us/power-platform/admin/wp-environments)).

**Auth and RBAC.** Entra ID SSO/MFA, four role scopes (tenant admin, environment, Dataverse security roles, app-specific), owner/group teams, plus record-level sharing and column-level security profiles with masking rules ([security roles](https://learn.microsoft.com/en-us/power-platform/admin/database-security), [column-level security](https://learn.microsoft.com/en-us/power-platform/admin/field-level-security)). Column masking (e.g. SSN/DOB shown as `****`) is genuinely non-trivial to rebuild well.

**Approvals / Power Automate.** Approval tasks land in email, the Power Automate approvals center, or mobile; flows are the automation substrate ([approvals](https://learn.microsoft.com/en-us/power-automate/modern-approvals)). Note the API request caps: 40,000 Power Platform requests/24h per premium user license, 25,000 pooled tenant requests for non-licensed/service identities ([request limits](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations)) — relevant if a refunds job goes batch.

**Auditability.** Audit is opt-in at environment → table → column level, logs create/update/delete, sharing changes, N:N (dis)association, security-role changes, and audit-log deletion; retention is configurable up to "Forever". Explicit gaps: **no auditing of retrieve/export operations via Dataverse auditing** (that needs activity logging into Purview, which has extra licensing/permission prerequisites), and no auditing of schema changes or authentication ([Dataverse auditing](https://learn.microsoft.com/en-us/power-platform/admin/manage-dataverse-auditing), [Purview activity logs](https://learn.microsoft.com/en-us/power-platform/admin/activity-logging-auditing/activity-logs-dataverse-model-driven-apps)). Worth knowing before anyone claims "Power Apps gives us audit for free".

**Governance / environments / admin.** Environments separate dev/test/prod and are tenant- and geo-bound; Environment Admin/Maker roles; DLP policies cascade tenant-wide and can quarantine violating apps/flows; Managed Environments add sharing limits, solution checker, IP firewall, CMK, Lockbox, App Insights export ([environments](https://learn.microsoft.com/en-us/power-platform/admin/wp-environments), [data policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention), [Managed Environments](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview)). This is a real, non-obvious asset: it constrains what non-engineers can build. It's also the thing this team may not need if only engineers build internal tools.

**Security & compliance.** Documented OWASP mitigations, Entra-based identity, TLS/at-rest encryption, CMK and Lockbox in Managed Environments; attestations (SOC/ISO) live in the [Service Trust Portal](https://servicetrust.microsoft.com/); FedRAMP High/DoD IL2 apply to the US Government clouds specifically ([overview](https://learn.microsoft.com/en-us/power-apps/powerapps-overview)). For a fintech, the practical value is *inheriting* control evidence rather than producing it.

**Deployment / lifecycle.** Solutions + Pipelines give dev→QA→prod promotion with prevalidation, immutable exported artifacts (no bypassing QA), auto-stored solution backups, and approval-gated delegated deployments; environments in pipelines must be Managed Environments (Microsoft states it will auto-enable this for pipeline targets starting Feb 2026) ([Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines)). Weakness vs. a normal repo: source control is an add-on discipline, not the default; diffs/code review of app logic are poor.

**Microsoft ecosystem integration.** Entra, Teams/Dataverse for Teams, Purview, Dynamics 365 on the same Dataverse, Office connectors. Only decisive if the compliance/ops team lives in Teams/Excel and the company is already M365-committed.

## 3. Which capabilities matter per app

| Capability | KYC review queue | Refunds dashboard | Feature-flag admin |
| --- | --- | --- | --- |
| Queue/worklist UI, filters, assignment | **Critical** | Medium | Low |
| Structured record view + decision capture | **Critical** | **Critical** | Medium |
| Maker-checker / approval workflow | High (escalation, 4-eyes on high-risk) | **Critical** (refund above threshold) | High (prod flag flips) |
| RBAC (role separation reviewer vs. approver vs. admin) | **Critical** | **Critical** | **Critical** |
| Field-level masking of PII | **Critical** (SSN/DOB/doc images) | Medium (card/bank tail) | Not applicable |
| Immutable audit trail (who/what/when/before→after) | **Critical** — CIP records must be retained 5 years ([31 CFR 1020.220(a)(3)](https://www.federalreserve.gov/frrs/regulations/section-1020220-customer-identification-program-requirements-for-banks.htm)) | **Critical** (financial impact, SOX-style evidence) | High (change history of who enabled what) |
| Writes into production systems | Medium (case status) | **Critical** (money movement, idempotency, provider API) | **Critical** (flag evaluation path, latency, kill-switch) |
| Document/image handling | High (ID docs) | Low | None |
| SLA/latency sensitivity | Low | Medium | **High** (flag reads are on the request path) |
| Attachment-heavy connectors | Identity vendor (Persona/Alloy-style) | Payment provider (Stripe-style) | Own flag service |

Judgments worth stating to the VP:
- **KYC and refunds are audit-and-authorization products**, not UI products. Most of the cost of owning them in-house is in the audit/authz/retention plumbing, not the screens.
- **The feature-flag admin panel is the weakest justification for Power Apps** and the strongest in-house candidate: internal-engineer users only, no PII, no external approvals, latency-sensitive, and it needs to sit next to the flag SDK/service the team already runs. It is also arguably a buy decision against a *different* vendor (LaunchDarkly/Unleash), not against Power Apps.
- **Refunds is the highest-risk app to move in-house first** because it touches money movement and is the most likely to be pulled into audit scope.

## 4. Realistically replicable in a 2-hour Devin-built prototype

Achievable and demonstrable at credible quality:
- Queue/list + detail view over a seeded Postgres/SQLite schema, with filters and pagination.
- SSO-shaped auth stub + **real role enforcement server-side** (reviewer / approver / admin) with roles read from a JWT/session.
- Maker-checker on one action: a refund above a threshold requires a second, different approver; self-approval blocked.
- Append-only audit log table (actor, action, entity, before/after JSON, timestamp, request id) written in the same transaction as the mutation, with a UI audit trail per record.
- Field-level masking driven by role (mask card tail / SSN unless permitted), enforced at the API layer, not just hidden in the UI.
- Config-driven schema so a second app (feature flags) is largely declarative — this is the "platform, not app" argument.
- Seeded demo data and a scripted walkthrough.

## 5. Not realistic quickly — genuine long-term platform work

- Tamper-evident/immutable audit storage with retention policy and legal hold; audit of *reads* and exports (Power Apps needs Purview for this too).
- Compliance evidence: SOC 2 control mapping, access reviews, evidence export for auditors, data residency.
- Real IdP integration (SCIM provisioning, group→role sync, MFA/conditional access, deprovisioning SLAs).
- Governance for non-engineer builders: DLP-equivalent connector policy, environment isolation, sharing limits, app quarantine.
- Release/lifecycle guarantees equivalent to Pipelines (promotion gating, artifact immutability, approval-gated prod deploys) plus backups/DR and restore testing.
- Production-grade integrations: idempotent refund execution against a payment provider, reconciliation, retries/dead-lettering, rate limits.
- Mobile/offline app clients, connector marketplace, on-prem gateway.
- The unglamorous 24/7 parts: on-call, upgrade treadmill, dependency/CVE patching, incident response.

## 6. Build vs. buy considerations (numbers to check, not assert)

- **Verify what the $250K covers before quoting savings.** Power Apps Premium list is **$20/user/month annually** ($12 at 2,000+ seats) ([pricing](https://www.microsoft.com/en-us/power-platform/products/power-apps/pricing)). $250K at list ≈ ~1,000 Premium seats — implausible for 3 internal apps with ~60 engineers. So the number likely bundles Power Automate/premium connectors, Dataverse capacity add-ons, Managed Environment entitlements, an M365/ELA commitment, and/or an implementation partner. Replacing the *apps* may not remove most of that spend. This is the first question to ask the client.
- **Engineering cost.** With Devin, first credible versions of three CRUD+workflow apps are plausibly a small number of sessions each; the platform substrate (authz, audit, approvals, deploy) is the real cost — think one focused workstream, not one afternoon.
- **Maintenance burden.** Steady state ~0.25–0.5 engineer for three internal apps (dependency upgrades, auth changes, audit requests, on-call). At loaded cost, that alone can consume six figures/yr — the honest comparison is *net* of that, not gross license savings.
- **Security risk.** Buying inherits Microsoft's attestations and OWASP mitigations; building means owning authz correctness, PII masking, secrets, and audit integrity on regulated data. This is the strongest argument against moving KYC first.
- **Opportunity cost.** Every engineer-hour on internal tooling is an hour off the revenue product. Conversely, Power Apps' 500/2,000-row delegation limits and Power Fx debugging are a recurring tax on engineers who are fast in code.
- **Lock-in.** Dataverse data model, Power Fx logic, connector credentials, and solution artifacts don't port. Exit cost grows with each app; conversely in-house means owning the platform forever.
- **Customization upside.** Real and specific: co-locating the flag admin with the flag service, embedding refund tools in existing internal dashboards, wiring audit into the company's existing log/warehouse pipeline, and enforcing authz with the same policy layer the product uses.

## 7. Recommended prototype scope (one sentence, detail in prototype-scope.md)

Build a **thin internal-tools platform** — config-driven queue + detail + role-enforced actions + maker-checker approval + append-only audit trail + role-based field masking — instantiated as **two** apps (refunds with an approval threshold, and feature flags) with the KYC queue shown as a third config to prove the pattern generalizes. Fake auth (seeded users/roles), fake payment provider, fake flag SDK. Do not attempt governance, compliance evidence, or IdP integration; name them explicitly as platform work.

## Sources

- [What is Power Apps?](https://learn.microsoft.com/en-us/power-apps/powerapps-overview)
- [Power Apps pricing](https://www.microsoft.com/en-us/power-platform/products/power-apps/pricing) · [Power Platform licensing overview](https://learn.microsoft.com/en-us/power-platform/admin/pricing-billing-skus)
- [Dataverse intro](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/data-platform-intro) · [Security roles](https://learn.microsoft.com/en-us/power-platform/admin/database-security) · [Column-level security](https://learn.microsoft.com/en-us/power-platform/admin/field-level-security)
- [Manage Dataverse auditing](https://learn.microsoft.com/en-us/power-platform/admin/manage-dataverse-auditing) · [Dataverse/model-driven activity logs in Purview](https://learn.microsoft.com/en-us/power-platform/admin/activity-logging-auditing/activity-logs-dataverse-model-driven-apps)
- [Environments overview](https://learn.microsoft.com/en-us/power-platform/admin/wp-environments) · [Data policies (DLP)](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention) · [Managed Environments](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview)
- [ALM overview](https://learn.microsoft.com/en-us/power-platform/alm/overview-alm) · [Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines)
- [Power Automate approvals](https://learn.microsoft.com/en-us/power-automate/modern-approvals) · [Requests limits and allocations](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations)
- [Connector reference](https://learn.microsoft.com/en-us/connectors/connector-reference/) · [Canvas app delegation](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview)
- [Power Platform security FAQs (OWASP mitigations)](https://learn.microsoft.com/en-us/power-platform/admin/security/faqs) · [Service Trust Portal](https://servicetrust.microsoft.com/)
- [31 CFR 1020.220 — CIP recordkeeping / 5-year retention](https://www.federalreserve.gov/frrs/regulations/section-1020220-customer-identification-program-requirements-for-banks.htm)
