# NDASH-070 — Documentation queue omits existing notes

Section: RCM Adjustment / Missing Documentation. Severity: Medium. Status: tested candidate; not yet deployed.

Reproduced on frontend 069 / backend 067: default August queue has 200 loaded items. Missing Note selects all 200, while only 166 loaded rows carry Missing Note and the full-scope summary has 172. All 200 rows show No note found. The queue clearly advertises its 200-item cap; the cap is separate from this defect.

Root cause: rcm_adjustments_review builds each documentation_reviews item without the existing normalized note field. The frontend's note display and Missing Note predicate therefore receive undefined for every row. The normalized adjustment and Discount / Write-Off queue already carry p["note"].

Smallest repair: add only "note": p["note"] to the documentation queue projection. No frontend changes, business-record changes, flags, counts, monetary calculations, approvals, permissions or infrastructure changes.

Recovery: preserve deployed main_candidate.py SHA f37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51 privately at ndash070-backend/main_candidate.before.py. Candidate SHA dec9768c7d981725d965c1c0fff6f47de8ec8c10ca41fd2ef14a80434a6a0f4a. Full backend contains credentials and is not printed or committed.

Tests: actual AST projection with synthetic notes fails 2 tests before; all 3 pass after. Exact whole-file reversal and Python compile pass. Retained POS access, aging, claim filters, five Gusto/expense suites and adjustment reversals pass. Frontend is unchanged from the previously verified 305 tests/build. Initial test upload helper lacked the required source environment variable; the orchestrated tests used the explicit before/candidate paths and existing application environment successfully.

Deployment plan: existing candidate 8002 then live 8001 with automatic rollback. Compare the entire bounded Adjustment response excluding only the new note field, expecting 34 existing notes and 166 missing-note flags among the loaded 200. Keep migrations/background sync/AMQPS guards, existing read-only cache warming and frontend 069 unchanged.

Separate observation for follow-up: the Large Adjustment and Late-Posted chips return zero despite corresponding loaded API flag counts 192 and 18. Do not combine that issue into this backend change.
