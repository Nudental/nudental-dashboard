# PH5-QA-STORAGE-002 — completed verification PDFs

QA live repair and cleanup PASS. Production configuration unchanged.

The synthetic completed verification generated a browser-download fallback but
reported `Storage upload failed: Bucket not found`. The isolated structure-only
project lacked the frontend's existing `insurance-verifications` bucket.

Created that bucket only in `hvtxjfayenqnwtaisoaw`, private, PDF-only, 5 MiB maximum.
`storage/insurance-verifications.sql` permits files only at
`verifications/<completed-verification-id>/<name>.pdf`, with explicit active/approved
profile, existing insurance page permission, and office checks. Parent-table RLS
also applies. Regeneration uses the existing upsert behavior. No provider or
production storage settings changed. Final policy source
`3438aa9` (full SHA available in Git); saved QA SQL receipt
`0f587060-2eef-4453-bc1d-c7090eacd688`.

The initial policy version inherited the same gates through parent-table RLS.
Automatic approval review rejected executing that version because the checks were
not explicit; it was never applied. The explicit version passed all 31 isolated
PostgreSQL policy tests and was then applied successfully.

Live verification:

- Original Download PDF action repeated: `PDF downloaded and stored`.
- 21 hosted Storage checks PASS: private bucket settings; admin, own-office manager
  and verifier downloads; other-office, staff without page permission, inactive,
  unapproved and anonymous denial; private public-URL denial; signed URL integrity;
  correct content; one stored object; successful storage audit.
- Actual PDF retrieved: 112,937 bytes, SHA256
  `73e53b7ea43dd8bc8c196abc7bf23da60b3e0d56a5ea09d85fb7ae24f2759157`,
  matching the stored database checksum. Text contains only the labeled synthetic
  verification and draft-v2 note. A signed download matches the exact bytes.
- Repeated UI generation succeeded and retained one object. Two successful storage
  generations were recorded in the audit history, alongside the original fallback.
- Browser-native Save As is not claimed: no matching downloaded file was found in
  the user's Downloads folder. File integrity was verified through authenticated
  and signed retrieval, not a native save dialog.

The synthetic request, verification, private PDF object and local retrieved copy
are removed. Ten audit rows retain event data and original fixture IDs in cleanup
metadata; nullable request/verification references were detached to permit test
record cleanup. Full UI refresh shows zero requests. Receipts outside Git:
`qa-insurance-storage-live-20260915.json` and `qa-insurance-cleanup-20260915.json`.

The request workflow also passed assignment persistence, draft create/edit/readback,
single-draft persistence, completion cancellation, completion/save audits, completed
read-only UI, and search/status/office filtering. Actual request cancellation,
action-specific permission variants and direct completed-record mutation guards
are not covered by these checks. External delivery, insurer submissions, Dentrix
uploads and the external Legacy Form remain intentionally unexecuted.
