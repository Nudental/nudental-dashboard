# NDASH-046 — Late report preview enables export after filters change

Section: Audit Reports. Severity: Medium. Status: repaired, deployed, live verification PASS.

Normal sequential behaviorPASS: Daily previewloads0events, then choosingMonthlyclearsloadedstate and disablesExportCSV untilPreview. RaceFAIL: clickPreviewforMonthly then immediatelychooseDaily beforeitreturns. Dailybuttonisselected, but ReportPreviewreappearswith0events andExportCSVbecomesenabledwithoutrequestingDaily. No export or emailclicked. The two datewindowsbothhad0visibleevents, so this proves stale readiness/query context, not a claimed numerical difference.

Root: fetchLogs captures prior config but unconditionallycallssetPreviewLogs/setPreviewLoaded(true)/setGenerating(false) when its request completes. Date/action/resource buttons clearpreviewLoaded, but donot invalidate that outstanding request. There is no requestgeneration or returnedquery identity guard. Errors canalsoleaveanolderpreviewloaded afterfailure.

Source repair: bind preview readiness to a request generation. Invalidate pending work on frequency/action/resource changes, loading a preset, and unmount. Clear old data/readiness when a request starts; ignore superseded success/error/finally. Export returns while not ready or generating and cannot implicitly fetch. Manual Preview, recipient settings, local presets, and disabled email remain unchanged.

Validation: 9 focused tests of the extracted actual callbacks PASS, including deferred response races, stale errors, preset changes, and export guards. All 183 retained frontend tests PASS. Source production build PASS (35.47 seconds). Rocket version 777 completed. No email or audit-log export was triggered. Production artifact preparation, deployment, and live verification remain pending.


Deployment closure supersedes pending status above: reproduced again on045 (Monthly Preview then Daily, stale response enabled Export CSV). Released from045 as deployment8a16cacd-cb94-429e-a7db-2e281bfd1cc2, asset/assets/index-00fd38a90eae.js, SHA00fd38a90eae6d4193163e710a741990a2d2189254ca2b057fcd9b04039a2679. Previous045 release and all earlier repair graphs preserved;042 excluded.

Actual compiled tests PASS for stale success/error, current preview, three filter invalidations, preset invalidation, export guards, unmount cleanup, untouched settings/local preset save/delete, full reversal to045, and seven relinks. Latest retained source221tests/build PASS. Live original race now keeps Export disabled; requesting Daily preview becomes ready with0events; Create filter clears readiness; Users & Staff resource change during request stays unready after old completion; refresh restoresWeekly/default disabled Export. Email remains explicitly disabled; browser errors0. No email, export, preset or business-data mutation was triggered during release verification.
