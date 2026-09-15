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

Deployment and live verification: PENDING. The remaining unreviewed API routes
stay denied. This repair does not establish end-to-end report readiness or resolve
any separate office-display-name behavior in the child tabs.
