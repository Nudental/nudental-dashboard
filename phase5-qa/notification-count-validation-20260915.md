# PH5-NOTIF-001 — Header unread count remains stale after marking read

QA Staff marked the single labeled task notification as read in Alert Center.
The row persisted is_read=true and the page displayed All caught up, while the
header continued to display Notifications (1 unread). Refresh cleared the badge.
The original result is recorded in qa-task-completed-notification-read-20260915.json.

Header subscribed only to INSERT and blindly incremented its count. It did not
observe read/archive updates or successful writes from the current page. The
notification service now announces successful saves locally; Header listens and
reloads the existing unread-count query. Its realtime subscription also handles
updates and recounts instead of incrementing. Listeners are removed on cleanup.
No provider configuration, notification recipients, credentials or row policies
changed. Failed service writes do not announce a saved change.

Thirteen actual-source tests: five PASS/eight FAIL before, thirteen PASS after.
All 1231 retained regression checks PASS, no skips. QA build, 510 source-file
comparisons and environment/secret checks PASS. Entry index-Duio_G0g.js,
8,827,530 bytes, SHA256 c76846db3879919ea70402eea9e25d98df9490d526a2847cb2c8217fd47256ee.
Archive SHA256 50ba270c16fd560936254b60f95e8262db4ba3ed10685fe5b53dae7924b0b8e7.
QA deployment bb8e9f63-271e-4278-8fac-2392f1aaed20 from
29b672c770a2215cd8749760f299eb3c125d4b53 succeeded; all 17 hosted checks PASS.
Both the original unread count of one and script index-Duio_G0g.js were confirmed
before repeating Mark as read. The header immediately became Notifications and
Alert Center displayed All caught up without refresh. The saved row is_read=true
and exact unread count zero matched. Refresh retained both results. The single
tracked notification remains for archive/audit tests and final cleanup.
Production remains unchanged.
