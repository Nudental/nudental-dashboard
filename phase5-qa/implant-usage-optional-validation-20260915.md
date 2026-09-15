# PH5-IMPLANT-002 — Manual usage rejects blank optional selections

The regular Log Usage form (no camera) matched the labeled QA inventory record,
accepted required office/provider/patient/date/ID fields, and confirmed a one-unit
deduction. Saving with optional staff/system/platform/length/diameter empty then
failed with `invalid input syntax for type uuid: ""`. Independent readback found
zero usage records and unchanged stock 7; the failed write was not retried.

`UseImplantModal` and its mobile variant initialize optional selectors as empty
strings. Their common `createUsageLog()` previously inserted these strings without
normalization. The targeted service fix copies the payload and converts only
empty optional UUID values to null. It preserves nonempty IDs, required fields,
stock linkage, input form state, database errors and existing permissions.

Twelve actual-service tests reproduce nine failures before editing (three valid
or denied cases already pass). All 12 now pass; all 1,276 retained frontend tests
pass with zero skips. All 510 source files match the build tree, and the QA build
passes environment/credential checks. Candidate entry `index-JKgbgv3V.js`,
8,828,341 bytes, SHA256
`67170020b9e7002f76b66e97b3779764eb10d7406ea56de55f253b0cc51afff1`.

Live deployment/repeat pending. Production remains unchanged. Original evidence:
`qa-implant-ui-20260915.json`, stage `manual_usage_attempt`.

Live repeat PASS on QA deployment 5bdea17e-2405-4e0a-8982-ae1739809335,
source105566cf93e80743d7762ea103f42c4e79a52dcb. The original manual entry saves
one usage record, records one usage audit, and decrements stock exactly once
from7to6. Refresh preserves all three; no duplicate record is present.
All17hosted checks PASS; previousQA884da3bc retained and production unchanged.
Evidence stagesmanual_usage_repaired/manual_usage_repaired_refreshed in
qa-implant-ui-20260915.json. Separate confirmed display defects are queued:
procedure_date2026-09-15 rendersSep14 inNewYork; UsedThisMonth remains0 instead
of1 even after refresh. These do not negate the verified save/deduction repair.
