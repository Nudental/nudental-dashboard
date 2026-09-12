# NDASH-063 — Shared RCM YTD range includes the rest of the current month

Section: shared RCM date filter. Severity: Medium. Status: tested; deployment/live verification pending.

Reproduced twice on062: YTD displays2026-01-01 through2026-09-30 on2026-09-12 (clock06:04UTC, localNewYorkSeptember12). The shared buildRcmDateRange helper constructs month-end for YTD, making future dates part of its API query range.

One-line repair in rcmService.js: construct the YTD end using current year/month/calendar day instead of next-month/day0. Start-of-year and existing date serialization remain unchanged. Other month, quarter and custom presets are preserved. No backend, financial data or configuration changes.

Tests: two source failures reproduced before repair. All287 source tests PASS; production build30.80sPASS. Actual compiled helperqTt1568bytes changes one Date expression only. Today, year-start and leap-year testsPASS; all non-YTD presets compare exactly with old behavior. Prior repairs, full reversal to062 and seven dependency relinksPASS. Rocket793complete.

Existing deployment path with prior062 recovery graph and exact production-ID guard35c01111-7296-4752-b2c3-70dfdd2ba22b. No exports, patient/contact writes, provider sync or financial actions.
