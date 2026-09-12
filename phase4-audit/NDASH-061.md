# NDASH-061 — AR Follow-Up rows collide across offices

Section: RCM / Patient AR Follow-Up. Severity: High. Status: repaired, deployed, live verification PASS.

Reproduction on060: August/All Offices shows112 records. A clean mount renders30 rows; two Patient-Level AR sorts leave32 while footer remains page1of4. Earlier office switches also left32. The API has112 distinct patient+location pairs but110 patient IDs: two patients occur in different offices. The UI normalization uses only patient ID for internal _id, which React also uses for row identity and expansion.

One-line repair in PatientStatementsTab.jsx: serialize [existing patient-ID fallback, location-ID/office-ID/office-name fallback] as internal _id. Keep actual patient_id, location_id, normalized business fields, query filters, amounts and source records unchanged. No deduplication or financial write. Existing missing-ID randomUUID fallback retained inside the serialized identity.

Tests: three identity tests fail on the old source. All281 source tests PASS after repair; production build PASS31.42s. Actual production helperFwt tests distinct/stable location identity, aliases, missing-ID fallback, and equality of every other normalized field. Exact reversal to060 and seven dependency relinks PASS. Rocket791 complete.

Candidate index-0eed4ce4bc51.js; current deployment guard2fa13056-854b-46fc-963e-870f04f076be. Prior060 preserved. No backend, configuration, patient or financial data changes.

Live closure: deployment5baae95d-3050-4dce-9c1c-f1cec8da7d04, SHA0eed4ce4bc514f30a3a972e324a8ceb6489ef299cac3a726a817aed25eb8602a. Double sort now keeps30rows; all112records and53862.72balance unchanged. Finalpage4 has22rows/Nextdisabled. No-match search resets frompage4 to empty page1of1. Staten5rows all matchoffice and1572.75 API total. AllOffices restores112/30. Refresh112/30/53862.72/errors0. No data writes or exports.
