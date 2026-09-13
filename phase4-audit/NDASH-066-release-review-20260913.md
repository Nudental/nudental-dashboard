# NDASH-066 current release review — 2026-09-13

## Reproduction and diagnosis

User completed private-preview email verification. The original066 candidate then rendered authenticated Executive Overview and RCM normally. Three-year table: correct headers,12rows,20available numeric comparisons agree with displayed year pairs. Two-year table: correct headers,12rows,10available comparisons agree, no bare percent cells, annual values preserved. No browser rendering errors observed.

After explicit preview reload the page settles at Verify Your Identity, not a persistent blank screen. Existing AuthContext rechecks device trust on startup and MainLayout routes to OTP when required. This explains the observed verification transition; it does not establish the exact cause of the earlier historical blank screen. Authentication, cookie policy and routing are deliberately unchanged. The earlier startup concern did not recur during authenticated root/RCM/comparison rendering.

Current production042-v3 still reproduces Metric/2025/2024/vs2025 and12bare percent cells. The current compiled table is byte-identical to the original pre066 table. Root cause remains the wrong guard (`idx > 0`) and older-year lookup (`idx - 1`) despite changes being keyed to each newer year.

## Candidate and verification

Apply only the previously reviewed three expressions: two guards become `idx < sortedYears.length - 1`, older-year label becomes `idx + 1`. No financial computations, annual values, source requests, authentication, configuration or business data change.

- Baseline: deployment `5abc436a-8bbb-4dcb-99db-6504de25ef7c`, current042-v3.
- Candidate066-v2: `index-0230990f6d6c.js`; SHA256 `0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8`.
- 837 frontend tests PASS, including four additional actual React table-render tests. Build PASS32.39s.
- Actual compiled two/three-year headings/cells, zero/missing prior-value cases, sorted-year binding, complete reversal to current042-v3, all seven dependent modules and syntax PASS.
- Candidate table is exactly the table just tested in the authenticated preview.

Deployment completed as `4f583195-5bef-4c51-9e45-de3cc73819d1`. Exact artifact, settled root/RCM startup, two/three-year comparisons, unchanged annual values, single/clear selections, shared Huddle and retained042 checks PASS. Previous042 release remains recoverable. Retained157 Expense charts match; nine headline values changed, with current WF API agreement and unresolved AmEx/composite source authority. See `PHASE4-FINAL-DATA-CHECK.md`. Historical blank-screen cause remains a recorded uncertainty; no authentication repair is claimed.
