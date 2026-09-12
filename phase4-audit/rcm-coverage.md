# Revenue Cycle Management audit coverage

In progress. Live Dashboard only; no patient/claim/payment writes, exports, provider sync, outreach, or backfills triggered. Patient rows are not copied into evidence.

Visible tabs: Claim Submissions, Patient Balances, Patient AR Follow-Up, Point of Service Collection, Adjustment, Dashboard, AR Aging, Collection Refund, Daily Comparison, Dentrix Daily Summary, Patient Portion, eAssist Reports. Claim mount and service inspection show read-only calls.

Claims: August 2026 / All Offices UI 1,011 equals API summary and SQLite active service-date counts. Location counts: Staten Island24, Eatontown272, Barnegat444, Brick271. All-office submitted126 / within24hours125 gives99.21%, displayed99.2%; unsent875; estimatedinsurancebalance387132.56. Barnegat UI444/submitted56/within56/100% matches API and source. Every visible first-page row belongs to Barnegat; 50 distinct IDs. Final Barnegat page9 has44 distinct rows and Next disabled. All-office page1/page2 each50 and total1011 stable. All-office final footer21 reports11; visible final table count will be reconfirmed because the initial DOM count selected a hidden table.

Read-only source probe: work/phase4-rcm-claims-readonly.py; private remote rcm-claims-readonly-result.json. Empty payor synthetic search returns API zero. No identifiers or raw record bodies saved.

Remaining Claims checks: empty payor UI, status/date basis, explicitly current-page search/sort, refresh, visible all-office last page. Existing search and export correctly label current-page scope; do not misreport them as full-result controls. No export performed. Ordinary-user access testing still requires an available safe role session.

Other RCM tabs not yet verified. Inspect mount side effects before opening; do not trigger contact/outreach writes or any financial operations. Known historical procedure/source coverage limitation remains; no backfill authorized.
