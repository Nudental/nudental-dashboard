# Provider administration — controlled hosted QA checks

Tested on the isolated Dashboard QA frontend `40e053e8-4275-4bc7-942f-27607c42d03a`, using only labeled disposable provider records. No provider credentials, real contact details, payroll, schedules, clinical records, or external systems were used.

| Workflow | Observed result |
| --- | --- |
| Create | One Doctor in Office A persisted; total/Doctor/active counts rose from 2 to 3; creation audit retained. |
| Edit and cancel | Cancel did not save. Name/type/office edit persisted as Hygienist in Office B; refresh and audit matched. |
| Deactivate / activate | Both states persisted with matching controls and active/inactive counts; audit increments matched. |
| Duplicate create | Same name/type/office rejected by the existing unique constraint; one record remained and no new audit was written for the rejection. |
| Ordinary-role writes | Staff, Office Manager A/B, Regional Manager, inactive Staff, and unapproved Staff could not modify the provider: six hosted API checks PASS. |
| CSV upload / create | Harmless 101-byte CSV preview showed 1 valid / 0 errors; import reported 1 Added / 0 Errors; one record and audit persisted. |
| CSV duplicate Skip | Conflict was detected; 1 Skipped, no record or audit change. |
| CSV Overwrite | A matched temporary row was changed to Inactive; 0 Added / 1 Updated / 0 Errors; same ID, one record, correct audit and refresh. |
| Bulk delete cancel | Cancel preserved both explicitly selected temporary records. |
| Bulk delete cleanup | Confirmation named only the two temporary providers; UI reported 2 deleted successfully. Database readback found neither record and retained 10 / 6 audit entries respectively. |
| Final refresh | Exactly the two original QA providers remained: total 2 / Doctors 2 / Hygienists 0 / Active 2. |

Temporary IDs were `31671123-9a64-44fe-afe1-6f4949f77f67` (form) and `48f52ef2-212a-4f72-b8f9-a698ea419346` (CSV); both cleaned. Sanitized evidence outside source control: `qa-provider-ui-20260915.json` and `qa-provider-csv-ui-20260915.json`. Reusable harmless CSV inputs retained. These checks found no new provider-write defect requiring a code change.

This is the covered provider workflow, not a claim that all Phase 5 work is complete. Provider deletion with linked historical business data and production operations were not exercised.
