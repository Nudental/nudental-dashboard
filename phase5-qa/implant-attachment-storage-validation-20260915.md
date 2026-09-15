# PH5-QA-STORAGE-001 — private implant attachments

The QA Add/Edit Implant form could not save a 1,418-byte synthetic PDF: Storage returned `Bucket not found`. The schema-only QA database had no Storage buckets; the frontend's existing `implant-attachments` integration was therefore unavailable. The failed request left the record and stock unchanged.

Provisioned only `implant-attachments` in isolated project `hvtxjfayenqnwtaisoaw`, private, with a 5 MiB limit and image/PDF MIME allowlist. `storage/implant-attachments.sql` applies the existing active-profile, inventory-admin, and office boundaries. It permits admin uploads/deletes in their own user path and scoped reads of inventory-linked objects; there is no update/upsert policy. Production configuration and data are unchanged.

- Policy source: `fc1ed903a1edf608ca0aec9a2887d36c1e70a2fc`.
- QA SQL receipt: `815ac827-b637-4735-929a-2be434e28d13`, three expected policies returned.
- Offline PostgreSQL policy cases: 16 PASS.
- Live Storage/ordinary-role cases: 28 PASS (`verify_implant_storage.py`).
- Original UI save repeated: PASS; one existing inventory row, stock 6, inventory audit entries 3 → 4. Refresh retains its object path.
- Exact downloaded content: 1,418 bytes, SHA-256 `41ba6304aaec75006c67ffd2df110a766a3002eecd8dbc10a9a7c9b70e9bd765`.
- Uploader and same-office staff read/download: PASS. Other-office, inactive, unapproved, and anonymous read rejection: PASS. Non-admin upload/delete rejection: PASS. Private public-URL rejection and duplicate upload protection: PASS.
- Disposable access probes removed using the Storage API; original labeled inventory attachment remains temporarily for the separate PDF rendering repair. Browser Save As is not claimed verified by an API download.

The refreshed PDF is incorrectly rendered as an image (`complete=true`, natural dimensions 0 × 0). This is separate PH5-IMPLANT-006 and is not counted as fixed by bucket provisioning.
