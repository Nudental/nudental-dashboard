Current overall status: [September 16 Phase 5 checkpoint](../phase5-qa/phase5-checkpoint-20260916.md). The source-reconciliation checkpoint below is historical; current main and production include the later bounded AmEx completeness repair.

# Phase5 checkpoint — source reconciliation passed

NuDental Dashboard only. Do not repeat Phase4 or modify the Collaboration
Platform. Source/build reconciliation and the canonical Git update are
complete. Production remains unchanged. Continue with isolated Dashboard QA.

## Verified source baseline

- Candidate: reconcile/nudental-dashboard-production-20260913.
- Fetched main: e4a2e0944f74514f6ea98e5ea32eb140333b964f; zero main-only commits.
- Main was fast-forwarded to source baseline
  5f052fd47d68d581090163cc888c9614d82d2090, with no force push or deployment.
- Remote annotated backup: backup/main-before-phase5-reconciliation-20260914
  points to the previous main. The reconciliation branch and Phase4 backup
  backup/nudental-dashboard-before-phase5-20260913 are also published.
- Phase4 branch and all previous backup tags/releases remain preserved.
- Source equivalence and its exact limitations: source-closure.md.
- Private evidence fingerprints: source-verification-evidence.json.
- A clean offline installation from the committed frontend lockfile succeeds.
  The normal root build command generates18 assets byte-identical to the
  independently aligned reference build. Node22.22.1/npm10.9.4,32.73s.
- Entry: index-DEzyMZYc.js,8,820,106bytes,
  SHA256386ff8ce3ff643e44233c518395a9d255a92df6a15273c61bc23aae7a992cbdb.
- All996 frontend checks PASS,0failed/0skipped,115.411s:
  837retained Phase4 +159Phase5 tests.
- Backend17retained suites PASS on the actual Python3.14.6 virtual environment;
  13source materializer tests PASS. No app effects/providers ran in these tests.
- Production still shows Revenue Cycle Management in the existing browser tab.
  No production deployment, service restart, sync or business-data write.
- Post-push server check PASS: frontend/API200, all3services active, all15
  production source files unchanged, live21,740,870-byte entry retains the
  original0230990f6d6c SHA256. Evidence is preserved privately on the server.

## Immediate next steps

1. Create the separate Dashboard QA environment with synthetic fixtures.
2. Verify supported-role UI/API boundaries and safe write workflows.
3. Trace Expense authority and complete the bounded performance investigation.

QA provisioning, role creation, write testing and Expense authority work have
not started. These remain required Phase5 work. The smaller reconciled bundle
is not deployed and is not a measured production performance improvement.

## Recovery and safety

Production deployment4f583195-5bef-4c51-9e45-de3cc73819d1 remains live;
rollback5abc436a-8bbb-4dcb-99db-6504de25ef7c remains available. The Phase4
branch preserves all original recovered additions excluded from the canonical
candidate. The private62-file server snapshot and original artifact graph
remain intact. Production build inputs/templates are not QA credentials.

Earlier investigative checkpoints and failed harness attempts remain in Git
history and private evidence. They are superseded by the verified results
above, not erased or counted as production defects.
