# PH5-NOTIF-002 — Notification state changes omit audit history

The labeled QA task notification's read state persisted after two separate live
UI writes, but no notifications audit row existed. notificationsService performs
the row update and the recovered schema had no notification audit trigger.

010-notification-audit-coverage.sql adds the existing fn_audit_trigger to
notifications INSERT/UPDATE/DELETE in isolated QA. No audit function, retention,
recipient, delivery, row policy or production setting changed. No historical
records were backfilled. The existing audit function's error handling is retained;
this does not claim a new atomic audit guarantee.

All seven offline PostgreSQL checks PASS. The live trigger readback is enabled.
The repeated QA Staff read action now logs exactly once with the correct actor,
old/new is_read values and changed fields. The repaired header count still clears
immediately. An attempted write by QA Staff B was denied without a new audit row.
A separate labeled fixture logged INSERT and DELETE and was cleaned with both
audit entries preserved.

UI Archive removed the tracked task notification from Active; the saved row has
is_archived=true/is_read=true and one archive audit entry. After refresh it
appeared in Archived with no unread badge. This UI has no unarchive control.
The original notification remains tracked briefly for the next category/filter
consistency test; the extra audit fixture is fully cleaned. Frontend remains
bb8e9f63 from 29b672c, 1231 regression checks and 17 hosted checks PASS.
After the category/filter regression, the original tracked notification was also
cleaned using the QA owner. Its three UPDATE entries and final DELETE entry remain
available, with actor and before/after data. Both notification fixtures are fully
cleaned; Active/Archived and unread count are empty after refresh. Production
unchanged.
