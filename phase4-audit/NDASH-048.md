# NDASH-048 — Incomplete custom expense dates silently query year to date

Section: Expense Report. Severity: Medium. Status: repaired, deployed, live verification PASS.

Reproduction: choose Custom with both date inputs blank and click Apply. No validation appears; the existing year-to-date total remains under Custom. A second Apply and read-only inspection of the displayed Debug date fields confirms applied datePreset=custom, empty customStart/customEnd, but service startDate=2026-01-01 and endDate=2026-09-11. No records were changed or reports exported. Debug was closed afterward.

Root: ExpenseReport.handleApplyFilters commits unchecked inputs. buildDateRange accepts Custom only with both values; missing values fall through to its year-to-date default. Reversed or invalid dates also lack validation. This is date-input validation, not a change to expense accounting or legitimate preset boundaries.

Small repair: a shared validator in ExpenseReportFilters checks required dates, real ISO calendar dates, and start <= end. The filter panel displays an inline alert and disables Apply; the parent handler independently guards invalid input before replacing applied filters or refreshing. Other presets, source queries, allocations, calculations, exports, and business data remain unchanged.

Validation: eight focused tests of the real validator and Apply callback PASS, including missing, reversed, malformed, impossible, leap-day, same-day, and valid ranges plus preservation of the prior applied state. All 198 retained frontend tests PASS; source production build PASS (37.09 seconds). Rocket version 779 completed. Source candidate only; no production artifact/deployment/live PASS yet. Live filters were reset to the valid This Year defaults after reproduction.


Deployment closure supersedes pending statements above. Reproduced on047: Custom/blank dates/Apply had no alert; visible date-only Debug readback showed custom/blank but queried2026-01-01 through2026-09-12. Correct configured route is /financial-analytics/expense-report. Released048 from047: deployment70d57971-5c3c-4424-bc71-eda4916252ed, /assets/index-baf780912fd2.js, SHAbaf780912fd2bd1c197eafac5c217865172d7b1aa9e6482b6972451f38fc95f7. Previous047 and all repair graphs preserved;042 excluded.

Actual compiled filter and parent tests PASS for missing/reversed/impossible dates, same-day/leap-day/presets, disabled Apply and alert, invalid input preserving applied state, valid copy/refresh, unchanged financial effects/actions, whole-entry reversal and7relinks. Latest retained source221tests/build PASS.

Live PASS: empty dates show Choose both a start and an end date and disable Apply; reversed2026-08-01 through2026-07-02 shows end-date guidance and disables Apply; same-day2026-08-01 accepted; valid Aug1-15 accepted and applied query exactlymatchesboth dates. Reset/refresh returnsThisYear, no alerts/browsererrors, Debugclosed. No exports or business-data writes.
