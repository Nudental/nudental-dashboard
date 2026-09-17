# Deferred migration review

All 42 Phase 5 candidates are accounted for. Classification is a release priority, not evidence that a migration is already deployed. Group receipts and closure documentation determine deployment status. Existing permission configuration is preserved; simulation code is excluded.

| QA repair | Classification | Production disposition / adaptation |
|---|---|---|
| 001 Profile access | P1 | Block caller-controlled role provisioning and self privilege edits; preserve authorized administration |
| 002 Office workflow | P1 | Split task foundation into A and Huddle/checklist into B; retain existing permissive rules |
| 003 EOD audit | P1 | Existing audit writer, no backfill |
| 004 EOD insert | P1 | Bind submitter, active account and office |
| 005 EOD workflow | P1 | Existing reviewer roles and workflow fields; verify ordinary entry path |
| 006 EOD history identity | P1 | Bind actor/role/name and parent office |
| 007 Huddle child audit | P1 | Existing audit writer |
| 008 Task page permission | P1 | Honor actual explicit grants, including false values |
| 009 Task field permission | P1 | Existing task-manager roles; assignee lifecycle boundary |
| 010 Notification audit | P1 | Existing row audit, owner policies retained |
| 011 Huddle review | P1 | Match current reviewer code, preserve office restriction |
| 012 Implant office | P1 | Validate usage row and linked stock office |
| 013 Task identity | P1 | Actor and immutable lifecycle stamps |
| 014 Task row audit | P1 | Existing row audit |
| 015 Implant lookup audit | P2 | Audit missing lookup mutation events |
| 016 Implant stock | Already live | Preserve September 17 production repair |
| 017 Implant delete audit | P2 | Preserve deletion history |
| 018 User-office transaction | P1 | Atomic assignment plus primary office; enable client only after RPC is live |
| 019 Office goal reads | P1 | Read scope only; never change goal values |
| 020 Insurance access | P1 | Active/page/office and parent boundaries; verify configured verifier scope |
| 021 Bone access | P1 | Active profile and audit-parent visibility; preserve existing module roles |
| 022 Bone role active state | P1 | Preserve helper ownership/ACL and role meanings |
| 023 Bone delete history | P2 | Resolve audit FK conflict; preserve all historical records and reversible constraint definition |
| 024 Synthetic supply offices | P4 | Never promote |
| 025 Supply request access | P1 | Adapt Front Desk reviewer access to approved RM/Admin policy, without enabling unrelated inventory pages |
| 026 Supply draft transaction | P1 | Existing request permissions and office scope; no external execution |
| 027 Submission simulation | P4 | Never promote QA execution adapters |
| 028 Fulfillment access | P1 | Preserve current page and office assignments; inspect stored office-name mapping |
| 029 Fulfillment audit | P1 | Remove QA namespace dependency; reuse existing supply audit table |
| 030 Receipt columns | Already live | Preserve nullable historical unknowns; no backfill |
| 031 Synthetic Front Desk offices | P4 | Never promote |
| 032 Front Desk catalog | P1 | Existing page/office grants, no new catalog access |
| 033 Front Desk catalog audit | P2 | Production namespace; existing audit architecture |
| 034 Front Desk order access | P1 | Restrict mistakenly public service policy; preserve established Mark Closed roles |
| 035 Clinical stock/history | P1 | Scope and actor binding; existing stock/history untouched |
| 036 Initial clinical stock history | P2 | Production namespace; existing history table |
| 037 Supply receipt transaction | P1 | Atomic, idempotent receipt/stock update; preserve completed historical unknowns |
| 038 Urgent audit/simulation | P4 as packaged | Never promote simulations. Extract only independent audit coverage if required; no fake intents |
| 039 Urgent access | P1 | Existing active/page/office boundary |
| 040 Front Desk review | P1 | RM/Admin/Super Admin only; no self-review, including Super Admin; requester remains Office Manager |
| 041 Completed insurance form | P1 | Existing content lock; preserve allowed document delivery/tracking fields |
| 042 Service-goal reads | P1 | Read scope only, no goal changes |

No migration currently needs a new business rule: Front Desk approval was explicitly decided by the owner. If production evidence reveals a conflict that cannot be resolved from existing policy, only that item moves to P3. Broader shared-API-key route compatibility is tracked separately; it is not a reason to hold independent database protections.
