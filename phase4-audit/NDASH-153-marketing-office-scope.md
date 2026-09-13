# NDASH-153 — Marketing multi-office spending scope

Status: CLOSED — deployed and live-verified PASS.

Severity: High — spending from unselected offices is combined with selected-office patient counts.

Reproduction: Operations / Marketing / Last Month / Barnegat + Brick twice displayed all four offices. Barnegat and Brick retained their valid August row fingerprints a699138e / 989c51c0, while Eatontown and Staten Island spending remained with missing patient counts (b34cabd7 / 1afd06a9). Single Barnegat correctly returned one row. All-office baseline fingerprints are a699138e / 989c51c0 / 8e7a9e91 / ac647490.

Root cause: fetchMarketingAdSpendFromAmex sends a backend office parameter only for a single selection. Multi-office responses contain all offices, and the normalized rows were returned without applying the selected UUIDs. Marketing derives its table, totals and charts from those rows.

Small fix: one final-return filter when more than one office is selected. The all-office and single-office paths remain unchanged. Eight focused cases PASS, four fail against the previous reader; all 803 frontend tests PASS; production build PASS (33.49 seconds). Actual compiled selected/duplicate/unknown-office cases and unchanged all/single references PASS. The reader is canonically identical after reversing the one return-expression change; complete reversal to NDASH-152 and seven dependent modules PASS. Rocket completed version 883.

Read-only source comparison: unchanged backend148 and Marketing function confirmed; August Google/Facebook/TNT/total component fingerprints match UI for all four offices. Expected selected-pair headline spending fingerprint is 6ada52f4; all-four headline is 7a5de54d. Credit-field naming requires a separate follow-up and is not claimed verified here.

No backend, auth, configuration, infrastructure or business-data changes. No provider sync, external delivery, or production records created. Existing all/single Executive Summary reader behavior is retained. Blocked NDASH-042 and NDASH-066 remain excluded.

Release: source 7306280; deployment f022f59c-2c20-4826-90ad-190df25c7699; entry `/assets/index-98074fe29a9d.js`; SHA-256 98074fe29a9d99197f00bc9ddf1ca525e355135fed19850e76c3457d9ccb0b36 (21740117 bytes). Exact artifact, unchanged backend148, frontend/API 200 and all three services PASS.

Live PASS: Barnegat + Brick produces exactly its two unchanged August rows. Headline spending 6ada52f4, patient count 67361333 and cost per new patient 527ccbc5 match independent read-only source calculations (spending aggregate plus the two office patient aggregates). Both charts contain only Barnegat/Brick; the bar chart has four bars for the two office/metric pairs. Repeated Update is stable. Single Barnegat and all four office fingerprints remain exactly unchanged. All Locations restored; zero new browser errors and no temporary records to clean up.
