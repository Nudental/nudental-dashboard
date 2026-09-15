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

Deployed only to the existing isolated QA API from source
`9fbd78730b6cea54a3673cf1a86074ee18e83ed1`, release
`175529879803a51646cd8985474c2a0fdb4087ea9cb1eb47a9eb8160913039b3`.
Prior release `581c259b50e6bce9cf6f1f14f88cfa51070c548ca9f07ae3afd80c38117daccd`
and a fresh rollback archive remain recoverable. QA configuration and the
production entry were unchanged; no frontend or production deployment occurred.

Live verification: **78/78 PASS**. Eight deliberate XLSX/PDF downloads covered
admin all-office, office-manager scope, monthly trend and repeated download.
Every file was saved, reopened and parsed, then cleaned up. Eight distinct audit
records remain as legitimate QA history. The temporary manager export permission
was restored to false and denial was confirmed again for both formats. Missing
session, ordinary staff, wrong office, forged identity and unreviewed report
requests were rejected. **205 closed-route regressions PASS** after deployment.
Browser save and Reports UI checks remain pending the existing Work browser
connection; API file readback is not evidence of a browser save.
