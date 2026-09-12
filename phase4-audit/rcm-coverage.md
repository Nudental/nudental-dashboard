# Revenue Cycle Management audit coverage

In progress. Live Dashboard only; no patient/claim/payment writes, exports, provider sync, outreach, or backfills triggered. Patient rows are not copied into evidence.

Visible tabs: Claim Submissions, Patient Balances, Patient AR Follow-Up, Point of Service Collection, Adjustment, Dashboard, AR Aging, Collection Refund, Daily Comparison, Dentrix Daily Summary, Patient Portion, eAssist Reports. Claim mount and service inspection show read-only calls.

Claims: August 2026 / All Offices UI 1,011 equals API summary and SQLite active service-date counts. Location counts: Staten Island24, Eatontown272, Barnegat444, Brick271. All-office submitted126 / within24hours125 gives99.21%, displayed99.2%; unsent875; estimatedinsurancebalance387132.56. Barnegat UI444/submitted56/within56/100% matches API and source. Every visible first-page row belongs to Barnegat; 50 distinct IDs. Final Barnegat page9 has44 distinct rows and Next disabled. All-office page1/page2 each50 and total1011 stable. All-office final footer21 reports11; visible final table count will be reconfirmed because the initial DOM count selected a hidden table.

Read-only source probe: work/phase4-rcm-claims-readonly.py; private remote rcm-claims-readonly-result.json. Empty payor synthetic search returns API zero. No identifiers or raw record bodies saved.

Further Claims checks: empty payor UI zero matches API; Submitted Date131 matches independent SQLite raw/calendar-day counts (no end-day timestamp loss in current August data). Current-page search/sort remain to test. NDASH058 request race reproduced and repaired/live verified: rapid filters and payor clearing preserve correct383 BarnegatUnsent; all-office1011restored; finalpage11distinctrows/Nextdisabled; refresh50rows/1011/errors0. Existing search/export correctly label current-page scope. No export performed. Ordinary-user access testing still requires an available safe role session.

Next investigation: Unknown status option. Read-only API status=unknown returns1011 despite SQLite unknown-state count0 for active August service dates. Existing reverse map omits unknown and silently applies no status condition. Reproduce this option live on058 before editing. Evidence helper phase4-rcm-status-readonly.py; no patient details output.

Other RCM tabs not yet verified. Inspect mount side effects before opening; do not trigger contact/outreach writes or any financial operations. Known historical procedure/source coverage limitation remains; no backfill authorized.
