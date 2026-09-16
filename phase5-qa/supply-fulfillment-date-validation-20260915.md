# Fulfillment default calendar date

PH5-SUPPLY-004 — PASS, isolated QA, September 15, 2026.

Repeatedly opening manual fulfillment during September 15 Eastern evening
defaulted Date Supplied to September 16. The initializer used UTC ISO text.
It now formats the local year/month/day from one Date instance. No saved records
or date-display conventions elsewhere were changed.

Eight actual-initializer timezone/date tests: original 3 pass / 5 fail; repaired
8 pass. Cases cover negative/positive offsets, month/year changes and US daylight
saving transitions. All 1,414 retained frontend tests pass, zero skipped. QA
build, complete 510-file source parity, environment checks and 17 hosted checks
pass.

Source `03c5b2dec2025962e43513b38dcca708ea3c7b1d`, QA deployment
`197a2037-175f-42d9-a4bd-aa06115a8b73`. Entry `assets/index-DsfF_HpH.js`,
8,829,697 bytes, SHA-256
`09c2feaf7a8f9604cc3c96847614fd890f430d4ab651850518832c1833016fbb`.
Rollback `79d267a7-10ad-44bb-bfaf-0d12b9316018` remains available.

Live reload and opening the same form now displays September 15, matching the
Work computer's local date. The table remains empty after completed fixture
cleanup. This default-only test required no new database write. Production is
unchanged at `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.
