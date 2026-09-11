# Provider Performance — coverage checkpoint

- Office filters: single, two-office combination and All verified against independently fetched completed-period totals and unique provider IDs (NDASH-016).
- Provider types: Hygienists, Doctors+Hygienists, empty House, and All verified for totals, row counts, collection ratio and recovery (NDASH-017).
- Date inputs commit through native keyboard, remain selected across office/type changes. Automation fill alone does not commit React state; not an application defect.
- Desktop Net Production sorting ascending/descending and Collections descending PASS. Row expansion/collapse PASS. Mobile provider cards render. Further sorting cases can be checked after broader coverage.
- Categories: false General classification and ineffective filtering corrected to an explicit unavailable state (NDASH-018). Positive analysis blocked by missing current category mappings and category-level collections; no backfill attempted.
- Trends: top 30d/60d/90d controls change the requested trend display period but every normalized provider has literal trendData: []. Reproduced 30d and 60d, no provider graph data. Existing provider API supplies no trend series; no matching provider-trend service method found. Safe unavailable-control correction remains to be completed. Date-range presets are a separate working control and must be preserved.
- Case acceptance explicitly N/A with source-not-wired note; positive metric verification requires a trusted TxCase source. Do not invent values.
- Current authenticated administrator view verified; non-admin role enforcement not live-tested without a safe isolated role/account. Early conditional permission return before hooks noted for focused source review; no live defect claimed.
- No business/test records created. Normal provider browsing does not write financial data.
