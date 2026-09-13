# NDASH-150 — Operations custom calendar-month scope

Status: candidate verified; deployment/live verification pending.

Reproduction: the live custom-date control accepted July 1–August 31, August 1–31, and July 15–August 20, 2026. Each returned the same All Offices September-only cancellation fingerprint 76c9a2f2 and `Sep 2026` period. Expected July–August aggregate fingerprint is 980329df; expected August is e11f9310. Dates were accepted through the native date controls before each report check.

Root cause: Operations never forwarded the accepted custom date fields to its range resolver. The shared resolver also lacked a custom case, defaulting to the current month. The Operations readers and goals use month/year intervals, so silently rounding arbitrary days into complete months would create another inaccurate report.

Small fix: forward both custom dates; validate real ISO dates and ordering; resolve complete calendar-month intervals exactly. Invalid or partial-month selections display a clear correction message and do not render report/YearComparison content. The filter controls remain usable. Existing permission checks and valid report content are preserved. This does not add day-level reporting or change monthly goal semantics.

Tests: nine focused cases PASS, eight fail against the previous source; full frontend suite 778 PASS; production build PASS (31.68 seconds). Compiled range, parent wiring, invalid-range guard, unchanged valid report/permission branch, complete reversal to NDASH-149, and all seven dependent modules PASS.

No backend, authentication, configuration, credential, infrastructure, or business-data changes. Backend remains NDASH-148. Rocket update submitted; completion pending.

Intentional limitation: Operations custom reporting supports complete calendar months. Partial-month reporting requires separately defining day-level report and monthly target semantics; the application now states the current limit rather than substituting dates.
