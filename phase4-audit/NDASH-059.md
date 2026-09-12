# NDASH-059 — Unknown claim status silently selects every status

Section: RCM / Claim Submissions. Severity: High. Status: candidate verified; deployment/live verification pending.

Reproduced on live058: August / All Offices / Unknown shows1,011 claims and50 visible rows, none labeled Unknown. API status=unknown also returns1,011 while read-only SQLite has0 unknown states for the same active service dates. The reverse status map has no Unknown member; the endpoint therefore adds no status condition.

Targeted backend fix: preserve all known status mappings and add an Unknown condition for missing, empty or unmapped claimState values, matching the existing row normalization. Combine Unknown with any selected known statuses using OR. Date/office/payor/active filters, calculations, response shape, auth and configuration stay unchanged. File: existing middleware/main_candidate.py (main.py resolves to it), rcm_claim_submissions only. Frontend058 remains deployed.

Preservation: exact backend main18f3000e310ec982bfa53b5e5cc345e79f883e9e4a3fc192fd0e5b0a7c14bde9 copied privately before edits; ascend_service c0680f08958e51d8ada02837620ef5d89d77a2aad8c63ecb53519cda5d1b328f unchanged. Snapshot directory ndash059-backend on the existing audit server. Full credential-containing module stays private on that server; this branch retains the small patch manifest and isolated tests.

Verification:10 isolated SQLite tests PASS locally and on the server;5 failures reproduced against old code. Covers every known status, unknown/null/empty/future states, mixed selections, repeated/whitespace choices, date/office/active scope and parameterized payor search. Five retained backend suites plus adjustment reversal suite PASS against the candidate. Syntax/full reversal PASS. Existing frontend270tests/build30.65s already PASS for058; no frontend source/build change for059.

Candidate mainSHA64bb98858a7fa661a535c189f0520b312cbf55800849f0e2ac776b6c0bc3a1a5. Candidate service8002 must pass before existing production service8001 is restarted. Preserve all earlier snapshots. No claims, financial records, configuration or provider sync modified.
