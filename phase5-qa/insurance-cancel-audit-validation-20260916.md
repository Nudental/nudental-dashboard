# Insurance cancellation audit — QA PASS

PH5-INSURANCE-003. On a labeled synthetic Assigned request, the live cancellation
UI saved Cancelled and the supplied reason but recorded Requested → Cancelled.
Readback confirmed one request and one incorrect audit event. The service used
a hardcoded oldStatus and unconditionally updated by ID.

The targeted change in insuranceVerifyService.js reads the current status, checks
the existing UI's terminal-state rule, conditions the update on that status and
records it in audit history. Missing, failed, repeated or concurrently changed
updates cannot produce a successful cancellation audit. This does not change
database policies or claim database-wide audit enforcement.

Eleven behavior checks: 9 failed before, all pass after. Full retained frontend
suite: 1,595 PASS, zero skipped. QA production build PASS with all 511 source
files matching. Source d409fc1770b255ec1d75732880411ec6497cb37b.
QA deployment d6008b73-92ac-4418-aa6d-584d5bb9b8e1; previous
f2983c78-166c-4359-b0ea-4d9113ec0451 preserved. Entry index-_7cdzmKA.js,
SHA256 c6425680e670fdb19de37e324b1595dd5c60a3f66b304c593ae08097004091b7.
Seventeen hosted identity/isolation/production-unchanged checks PASS.

Original live test repeated on a fresh Assigned QA request: cancellation saves
one record/one event; a fresh browser reload shows Cancelled, the saved reason and
the correct Assigned → Cancelled audit transition. Cancel action is no longer
offered. These visible tests used the existing QA Super Admin, not a claim of
all-role positive UI coverage. No insurer, email or chart upload was invoked.
Both exact requests were cleaned; two audit events remain, including the original
incorrect event as preserved defect evidence. Repeated cleanup deletes return zero.

Private evidence: qa-insurance-cancel-20260916.json and
qa-insurance-cancel-after-20260916.json; both cleanup_verified=true.
Production deployment remains 1f1f91bc-5dbd-4500-8bfd-d4e2039ba601.
