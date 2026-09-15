# PH5-EOD-014 — stale approved edit claims an unsaved change

Two QA regional-manager forms opened the same approved synthetic report. The
first changed its provider display text to QA edit one with a required reason,
then saved to pending_reapproval. The stale form entered QA edit two and a
different reason. It also reported Sent for Re-Approval, although the database
retained QA edit one and the first reason. History increased 2→3 while row audit
stayed 3; the extra event described values that were never saved.

Root cause: handleEditApproved checked the error but not its existing conditional
update's affected rows. It now selects/requires the returned ID before appending
history or reporting success. Existing approved-state matching, field conversion,
reapproval status, edit reasons and authorization are unchanged.

Eight focused cases: three PASS/five FAIL before, eight PASS afterward. Covers
stale states, concurrent saves, real field persistence, role denial and blank
reason. The original pair is cleaned, baseline counts restored and four/two
row-audit events retained. Full tests/build and QA live repeat pending.

All 1171 retained frontend/production-parity checks PASS, no skips. QA build and
source/environment verification PASS. Entry index-DXwSwtTr.js, 8,825,887 bytes,
SHA256 79825f6ac242270ca8264697c1c719618d180896cce27cc1171fa8b08ed83525.
Archive SHA256 8957d8a1dbb47441dd83322e67978cbdd6bd27e8ad1bf93cf2c1ce29ee1be819.

QA deployment a833b27e-c561-4863-b802-84ef0ceed55e from 73dba851e0 succeeded.
All 17 hosted entry/environment checks PASS and production remained unchanged.
Live two-form repeat PASS: the first edit saved QA preserved edit and its required
reason, with one history event and the correct reapproval count. The stale form
showed Edit Failed with a clear refresh/review message. Complete row/history/audit/
count snapshots were identical across that attempt and refresh. Cancel discarded
the stale form. Both fixtures were cleaned, initial counts restored and four/two
row-audit events retained respectively.
