# Office administration — isolated QA

Live QA Settings → Offices tested using only temporary office `6670e825-eeae-4a45-bd13-29a3c385323e`, labeled `QA TEMP PH5-OFFICE-20260915`, then `… EDITED`. No real addresses, mailboxes, phone numbers, or external integrations supplied.

- Create: one office persisted, with synthetic address and two audit entries.
- Edit/cancel: cancel retained the prior saved record. Corrected field readback and completed save persisted the exact edited name/address; full refresh confirmed it. An earlier automation input/navigation timing artifact was investigated and was not classified as an application defect.
- Deactivate/Activate: both status transitions persisted with audit entries.
- Delete/cancel: confirmation explicitly describes deactivation to retain history. Cancel preserved Active status. Confirm produced Inactive, surviving refresh. Activate restored it.
- API permissions: Staff, Office Manager A/B, Regional Manager, inactive staff, and unapproved staff could not change the temporary office. All six denials verified against persisted state.
- Audit history: 14 records captured through restore; original create/update/status events retained.
- Cleanup: inspected 168 foreign-key references for the temporary office and administrative user; no office dependents. Removed only the disposable records, preserving all two original QA offices, 12 identities, and 40 associated audit entries across the two fixtures.

No new office-specific code change was needed. Linked historical-office deletion and real integrations were intentionally not exercised. UI success is represented by modal completion and the updated row; this page does not display a success toast. Sanitized receipts live outside source control: `qa-office-ui-20260915.json`, `qa-office-permissions-20260915.json`, `qa-admin-cleanup-20260915.json`.
