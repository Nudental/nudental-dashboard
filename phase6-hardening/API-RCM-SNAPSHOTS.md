# RCM snapshot and eAssist read boundary

Status: TESTED CANDIDATE, NOT YET DEPLOYED.

Six GET routes: the four existing payor/aging snapshot aliases, `/v2/eassist/daily` and `/v2/eassist/ingest/status`. Inspection found no scheduled reader requiring a new job grant. Current active humans need their existing RCM parent/child grants and actual office scope; current administrative readers retain their override. Unknown, conflicting, duplicate and ignored scope selectors cannot grant access. No unattended credential, route grant, schedule or provider configuration changes.

Synthetic execution of the actual legacy payor handler reproduced a selected-office result containing company-wide financial fields. Office-scoped humans now receive only that office's rows; company totals/reconciliation metadata are unavailable, without inventing allocated values. All-office responses retain their original calculations and values. The primary verified A/R handlers are outside this batch.

The actual eAssist daily handler also reproduced a date-fragment value dropping a later office filter. Eight interpolated filter values are now encoded as literals. Existing report calculations and filters remain intact. Scoped ingestion status queries filter the actual selected office, and do not retrieve global ingestion logs/staging counts. Unavailable counts remain null; the already-deployed client displays an em dash. Parent office propagation is live in frontend source `009005b03767dc3dc9facdbfc5f9fa81fa001d49`.

Verification: 283 guarded native tests PASS with zero blocked attempts; all 17 retained suites PASS; 13 materializer checks PASS. The old ingestion-pagination harness initially lacked the new FastAPI request/query context. Its six unchanged test functions passed after only synthetic argument scaffolding was supplied. Original evidence and the other 16 passing suites are preserved. Canonical AST comparisons confirm unchanged payor calculation bodies after unwrapping response scoping, unchanged daily report logic after unwrapping literal encoding, and unchanged unrelated route bodies. Twenty-nine other materialized files are identical. Candidate main SHA256: `21b7b3b958394af37d14b127f22ba36161a95d3a19930ed1c04d8cf68fb0d188`.

Release preparation includes fresh source/configuration recovery, current frontend/hash checks, original row fingerprints including all four snapshot/eAssist tables, disabled startup execution checks, candidate-service validation before public-service activation, and immediate source rollback on failure. Private backups stay on the existing server. Never restore the previously revoked reconciliation-validator credential.

No financial corrections, provider syncs, report imports, schema migrations or real business writes are included. Remaining broader RCM/financial/provider route review and canonical main integration are still open.
