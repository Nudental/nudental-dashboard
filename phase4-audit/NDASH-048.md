# NDASH-048 — Incomplete custom expense dates silently query year to date

Section: Expense Report. Severity: Medium. Status: reproduced twice live; source repair tested; deployment and live verification pending.

Reproduction: choose Custom with both date inputs blank and click Apply. No validation appears; the existing year-to-date total remains under Custom. A second Apply and read-only inspection of the displayed Debug date fields confirms applied datePreset=custom, empty customStart/customEnd, but service startDate=2026-01-01 and endDate=2026-09-11. No records were changed or reports exported. Debug was closed afterward.

Root: ExpenseReport.handleApplyFilters commits unchecked inputs. buildDateRange accepts Custom only with both values; missing values fall through to its year-to-date default. Reversed or invalid dates also lack validation. This is date-input validation, not a change to expense accounting or legitimate preset boundaries.

Small repair: a shared validator in ExpenseReportFilters checks required dates, real ISO calendar dates, and start <= end. The filter panel displays an inline alert and disables Apply; the parent handler independently guards invalid input before replacing applied filters or refreshing. Other presets, source queries, allocations, calculations, exports, and business data remain unchanged.

Validation: eight focused tests of the real validator and Apply callback PASS, including missing, reversed, malformed, impossible, leap-day, same-day, and valid ranges plus preservation of the prior applied state. All 198 retained frontend tests PASS; source production build PASS (37.09 seconds). Rocket version 779 completed. Source candidate only; no production artifact/deployment/live PASS yet. Live filters were reset to the valid This Year defaults after reproduction.
