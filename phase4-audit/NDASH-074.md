# NDASH-074 — Daily Comparison opens an obsolete fixed date

Section: RCM / Daily Comparison. Severity: Medium. Status: verified candidate, live release pending.

Reproduced before editing: opening Daily Comparison selects2026-05-08. Selecting the current2026-09-12 report succeeds; leaving and reopening resets to2026-05-08 again. The selected date is independent of the global RCM range by design, but its initial value is a fixed historical development date.

Root cause: selectedDate is initialized with the literal2026-05-08 although the existing todayStr helper already implements the browser's local calendar date. Smallest repair: useState(todayStr), passing that existing helper as a lazy initializer. Historical date selection, office/year/mode inputs, calculations, API and data remain unchanged.

Tests: four actual-source date regressions fail before and pass after;327 retained frontend tests PASS. Tests cover today's local date, local/UTC day boundaries, year-end/new-year and leap day. Source production build38.43s PASS. Actual compiled initializer24->147bytes uses the minified existing helper; date cases/lazy initialization/full reversal to073/prior repairs/seven dependency relinks PASS. The artifact compiler wrapper initially removed the unused standalone helper expression; corrected the wrapper to retain and extract the expression. No failed artifact was deployed.

Candidate index-f2011f1c939f.js / SHA f2011f1c939ff8bc448bbe6322bda83ce8f9505f64c403331b289d462c79843b based on production12116689-cb09-48e6-9d50-c0254ba9e292. Preserve073 rollback, backend070 and all production data. Blocked042/066 excluded. Full recovered source build is not deployed. Rocket802 initially used the equivalent eager invocation; a follow-up requests the exact tested lazy initializer.

Live plan: opening/reopening/full reload default to the actual local day; historical date selection and read-only report rendering still work. Check earlier AR Aging sorting and Refund totals. No financial transactions, exports or source data writes.
`nRocket803 confirmed the exact lazy initializer; no other files changed by that follow-up.
