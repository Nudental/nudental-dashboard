# Urgent request office and account access

PH5-AUTH-024 — reproduced, repaired and live verified in isolated QA.

A bounded read-only matrix against one labeled Office A request found all twelve authenticated synthetic identities could read it, including Office B, inactive and unapproved accounts. Anonymous read returned zero. The newly protected urgent audit class correctly exposed its events only to the Super Admin and Office A manager. Requests and audit data were unchanged by this matrix.

The original request policy allows all authenticated readers. Candidate `039-urgent-request-access-boundary.sql` adds one restrictive policy requiring an active, approved account, existing monthly-supply page permission and existing office access. The original author/admin write policy remains necessary; this adds no role, grant, identity or provider access. Office permission changes cannot move an existing request outside the actor's scope. This is a QA-only candidate, guarded by `nudashboard.environment=qa`; production is untouched.

Validation: 81 offline PostgreSQL checks pass, including the original twelve-account reproduction, thirteen-identity Office A/B reads, existing reviewer writes, denied inserts, authorized Office A creation/edit, cross-office move rejection, retained audit after cleanup and exact installation/no-op state preservation. These tests omit pending candidates 032, 034 and 035. All 80 installation checks across 39 candidates pass. These counts are not live-installation claims.

The existing requester/status authorization model is preserved; this repair does not claim to repair impersonation or add a new review policy. After explicit user approval, migration 039 was applied and all thirteen live identity checks passed. See [the consolidated results](access-restrictions-live-20260916.md).

Evidence: `qa-urgent-roles-before-20260916.json`, `qa-urgent-access-after-20260916.json`, `qa-urgent-simulation-20260916.json`. The labeled denied simulation request is cleaned after verification, preserving four audit entries and both private mock intents. Repeat deletion returned zero, and the live UI refresh shows no urgent requests.
