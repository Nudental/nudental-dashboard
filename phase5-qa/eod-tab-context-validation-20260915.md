# PH5-EOD-004 — selected office/date lost at tab boundary

The hosted QA EOD form displayed the assigned QA Office A in its header, but
Dentrix Closeout showed Unknown Office, disabled Refresh, and requested an office
selection. This remained reproducible after the scoped office API was enabled.
Unscheduled Treatment and Treatment Plan Completion also displayed Unknown Office.

The parent DailyEntryForm supplied propOfficeId/propDate, while its three child
contracts accept selectedOfficeId/selectedDate. Legacy Import similarly expects
selectedOfficeId/offices rather than propOfficeId/propOffices. The targeted repair
changes eight prop names in daily-entry-form/index.jsx; all values, calculations,
permissions, child date defaults, and import context requirements remain intact.

Verification before publication:

- 13 new source-to-child contract checks: 0/13 before, 13/13 after.
- Full retained frontend suite: 1,069/1,069 PASS, no skips or failures.
- QA build PASS on the existing Node/lockfile/configuration.
- The preserved source reproduces the previous deployed QA entry byte-for-byte.
- Candidate asset comparison proves exactly four office prop, three date prop,
  and one directory prop changes, plus generated chunk filenames. Other assets
  match. No production credentials or server secret appear in the QA artifact;
  the QA-only connection policy and banner remain present.
- Entry index-CbBnk20-.js, 8,821,532 bytes, SHA256
  86b9a9525974cbd850ce8ec027795d1799f8f5dfb658a92db42290ada2ebc5dd.
- Static archive SHA256
  e9df7f85f7f4645db09d0d0b4f41313ec79ffd94778eb8a0eae597af58b545c9.

The existing QA publisher now accepts a verified entry and requires the exact
current deployment ID for an existing project, checking it again immediately
before publication. Project name and branch stay fixed, previous artifacts and
deployment receipts remain preserved, and production deployment is checked for
change. No hosting configuration is changed.

Deployment a101df8f-f343-4034-a9d6-1ee908bc373e succeeded from a06fff39.
Live verification PASS: Dentrix Closeout now displays QA / Office A, enables
Refresh, and receives the date changed in the attestation form. Unscheduled
Treatment also receives that date. After the existing 30-second autosave, refresh
restores the changed date; the temporary date was subsequently restored. Reloading
before autosave completed correctly retained the last saved value.

17/17 hosted artifact, header, CORS/session boundary, and unchanged-production
checks PASS. No new database record was created by these date tests. Production
deployment remains 1f1f91bc-5dbd-4500-8bfd-d4e2039ba601. Prior QA deployment
b547e61e-10a4-4650-ba49-5fd72cb76a5d remains recoverable.

Unreviewed report API routes still return the expected denial. This repair does
not establish end-to-end report readiness. Two treatment tabs still display
Unknown Office because they use a fixed office catalogue; that separate defect
was reproduced again on the new release and is being handled next.
