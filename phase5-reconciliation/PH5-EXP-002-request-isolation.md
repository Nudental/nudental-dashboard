# PH5-EXP-002 — overlapping Expense metadata crosses requests

The final coverage review revisited the shared-summary state recorded alongside
PH5-EXP-001. Six deterministic synthetic cases reproduce the defect in the actual
source function: two overlapping office/date requests reach their asynchronous
fallback reads, and either completion order gives request A request B's extra
fields. The main AmEx amount remains local, but charges, credits, taxes, benefits,
reference buckets and model metadata use a module-level mutable object.

The smallest repair moves that existing object into `fetchExpenseSummary`.
No formula, query predicate, record, account, source-selection rule, permission or
configuration changes. Six overlap cases now pass across the reconciled API,
API-only and mismatch-guard paths, with both completion orders. The seven retained
AmEx completeness checks also pass.

All 1,630 frontend tests pass with no skips; QA build and 511-file source parity
pass. The same six scenarios pass against the actual compiled candidate function
and reader using synthetic transports. The first compiled harness run lacked the
build's renamed QA fetch wrapper; identifying that binding corrected the harness,
without changing application code or enabling real network requests.

QA release `7e91a103-ef44-4f3a-a667-447e112e6997`, source
`be846c8dfbd6020be0d7b212df5e5e77b0078105`, is published. All 20 hosted checks
pass. The downloaded live entry's SHA-256 is
`b356cf0ec85764dddfcd7277abba2b375bd32158cf4c34f54a9ace7a8c75085d`;
all six cases pass against those exact served bytes. The temporary download was
removed. Previous QA release `3f7a8c68-5505-4101-8f88-130fa0bdd2d2` remains
recoverable. The production deployment is unchanged.

This is deterministic request-
isolation testing, not certification of real accounting totals or a claim of
interactive browser race timing. The QA operational Expense summary route remains
closed. Production is not being deployed for this candidate.
