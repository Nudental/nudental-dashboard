# NDASH-077 — Late Daily Comparison responses overwrite the selected office

Section: RCM / Daily Comparison. Severity: High. Status: repaired, deployed, live verification PASS.

Reproduced twice on frontend075/backend076: with Sep11 populated, change All Offices then Staten Island before the first response completes. The selected office remains Staten Island, but the settled By Office table has all four offices. A settled refresh correctly returns Staten Island alone. No records were changed.

Root cause: DailyComparisonTab.jsx fetchData accepts every overlapping success/error/finally without request generation or effect cleanup. An older response can replace data and end loading under a newer office/date/mode selection.

Smallest repair: one useRef generation counter; capture/increment at fetchData start and clear obsolete data; guard success, catch and finally; invalidate pending responses on the fetchData effect cleanup. Request parameters, calculations, extended monthly callback, settings and other components remain unchanged.

Tests: seven targeted deferred-response tests reproduce five failures before repair; all341 frontend tests pass after. Production build passes38.48s using the existing runtime. The first sandbox build could not start the existing compiler child process; the ordinary user-context build passed. No dependency installation occurred. Rocket805 completed the same targeted change.

Release verification: six scoped AST edits to the actual075 component. Actual compiled callback tests reproduce the old response failure and verify reversed success, obsolete errors/loading, cleanup, current errors, empty results and unchanged request parameters. Entire entry reverses exactly to075; prior repairs and seven dependency relinks pass. Blocked042/066 are excluded. Candidate index-99daf5b4f158.js; backend076 and the old075 release remain preserved.

Live closure PASS: deployment66d011b4-3748-4b01-984b-c9f8e4473d7d, entry index-99daf5b4f158.js, SHA99daf5b4f158293fa7dabb31cf20689b57e44dcef319f026da6f4ebd4c2696cc. All→Staten retains exactly one correct row; All→Barnegat retains one correct row and component refresh preserves it. Staten→All settles with exactly the four office rows. Full reload opens normally, defaults toSep12, preserves count units and loads the populated Sep11 All Offices comparison. Some report requests take tens of seconds; a premature wait deadline or reload during loading was not counted as success. Final settled checks all pass. Alerts/errors0; frontend/API200; three existing services active;5173MiB server memory available. Backend076 unchanged,075 rollback preserved. No business writes or exports.
