# PH5-NOTIF-003 — Task assignment label and filter disagree

The archived labeled task notification displayed System. Selecting System then
showed the empty archived view, although All Types showed that saved notification.
Its persisted notification_type is task_assigned, produced by the existing task
service. Alert Center had neither a display entry nor a filter option for it and
fell back to the System label; the System filter correctly requested only system.

Two configuration entries now label task_assigned as Task Assigned and expose
Task Assignments using that same existing value. Query behavior, record content,
all other categories, permissions and provider settings are unchanged. No new
mirrored configuration test is added for these two entries; the retained suite
and live category/filter/persistence checks validate the change.

All 1231 retained regression checks PASS, no skips. QA build, 510 source-file
comparisons and environment/secret checks PASS. Entry index-CPSVXCsq.js,
8,827,705 bytes, SHA256 927aca37c60e74f00f9ff5ea651619c758c76077a9d40d1e512f9f2804417701.
Archive SHA256 4b05322bb3c16c5aa8caca647b16707c6950ff90b2f78e3d48fcbb0d6b3f38b0.
Publication and live verification pending. The tracked archived notification
remains available only for the repeated test and final cleanup.
