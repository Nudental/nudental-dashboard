# QA Patient Flow XLSX and PDF validation

The existing QA API intentionally returned 503 for both formats before this
change. That gate was confirmed live using the synthetic admin, with no audit
record or download generated. This extension allows testing the recovered
Patient Flow generators against the same bounded, office-scoped synthetic
aggregates already reviewed for CSV. It enables no additional API route or
report type and changes no preserved production template.

The QA wrapper supplies a synthetic title and provenance for CSV/XLSX and for
the existing PDF builder. The original layout, formatters and calculations are
retained. Missing or changed PDF provenance fails rather than silently labeling
synthetic data as production data. Session, API key, permission, office, request
size and persisted-audit requirements are shared across all three formats.

All **112 backend tests PASS**, with no skips, using the existing pinned server
dependencies. New tests inspect the actual XLSX archive/cell values and PDF
generator, verify synthetic provenance and office scope, and cover role denial,
identity forgery, cross-office requests and failed audit persistence for both
formats. The XLSX has no macros or external workbook links.

Four generated PDF scenarios were text-checked and rendered with Poppler:
single office, both offices, monthly trend and an empty date interval. All four
pages were visually reviewed: headings, tables, KPI values, QA labels, source
notes and footers are readable and unclipped. Existing zero/undefined display
conventions remain unchanged. Poppler emitted font fallback notices; the
rendered output had no missing text or glyphs in these scenarios.

Deployment and live-format checks are pending. Browser save and Reports UI
checks remain pending the existing Work browser connection.
