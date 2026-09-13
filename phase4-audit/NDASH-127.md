# NDASH-127 — Streaming imports cannot be selected in the Sync Type filter

Severity: Medium. Status: reproduced; verification pending.

Reproduced on126: All Sync Types returns300 streaming rows, while the menu offers only Historical, Manual, Scheduled and Incremental. Selecting Incremental gives an explicit empty state; restoring All returns streaming rows but still no Streaming option. Current producer uses sync_type=streaming; the existing reader already filters sync_type by equality.

Smallest fix: add one Streaming option with value streaming to the local read-only filter. Do not add streaming to the manual-import endpoint registry or change any import/retry action. Endpoint text search already supports stream records. The reader's existing300-result UI window remains explicit audit scope; no claim of full-history completeness.

No new unit tests for this one-option change; retained frontend suite, build, compiled option validation and live filtering will verify it. No imports, sync, retry, or data writes are performed.

Predeployment PASS:575 retained frontend tests,build29.95s,Rocket853. Actual compiled menu originally lacks streaming; candidate adds exactly one distinct option and preserves all existing options. Full reversal reproduces126 byte-for-byte; query handlers/import actions/manual endpoint registry unchanged and seven dependency modules only relink the entry. Candidate index-514f8cdd0a3d.js; deployment/live verification pending.
