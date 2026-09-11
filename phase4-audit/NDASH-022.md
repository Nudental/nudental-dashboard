# NDASH-022 — An undated placeholder appeared as a real payroll run

- Section: Payroll. Severity: High.
- Reproduced twice: selecting the blank Regular option (`pp-2026-custom`) displays provider financial rows with no pay-period/payday headers. It is distinct from the working Custom Date Range control.
- Root cause: the derived schedule included an undated placeholder with empty start/end/payday fields. Those empty dates reach a report request whose backend supplies defaults.
- Fix: one predicate in `getPayrollScheduleForYear` excludes incomplete dated-run entries. Original schedule objects, all complete runs, custom-date mode, calculation/date-offset logic and the read-only mapping guard remain unchanged.
- Tests: pre-fix schedule tests reproduced invalid inclusion; 70 frontend tests PASS after correction; production source build PASS (28.62s); actual artifact schedule scenarios, syntax and exact reversal PASS.
- Deployment `4c728652-b6d8-406e-b8d4-27fe2b0ac148` PASS, asset `index-13f50227f46f.js`, SHA256 `13f50227f46f1660f1c3aea5022621fd78a3b3279d4918ac6003e0d1042bd230`. Previous `ndash021-dist` preserved.
- Live selector correction PASS: 21 choices (20 dated runs plus the supported custom mode), no `pp-2026-custom` placeholder, unchanged September 4 run labels and valid date headers, custom mode opens both date inputs. No payroll/business records modified.
- Separate finding during custom-mode testing: empty custom dates leave the previous run's tables visible with blank headers. This stale-view defect remains to be repaired as NDASH-023; do not report the entire custom-date workflow as verified.
