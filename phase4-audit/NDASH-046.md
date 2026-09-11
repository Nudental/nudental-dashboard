# NDASH-046 — Late report preview enables export after filters change

Section: Audit Reports. Severity: Medium. Status: reproduced live; source repair tested; deployment and live verification pending.

Normal sequential behaviorPASS: Daily previewloads0events, then choosingMonthlyclearsloadedstate and disablesExportCSV untilPreview. RaceFAIL: clickPreviewforMonthly then immediatelychooseDaily beforeitreturns. Dailybuttonisselected, but ReportPreviewreappearswith0events andExportCSVbecomesenabledwithoutrequestingDaily. No export or emailclicked. The two datewindowsbothhad0visibleevents, so this proves stale readiness/query context, not a claimed numerical difference.

Root: fetchLogs captures prior config but unconditionallycallssetPreviewLogs/setPreviewLoaded(true)/setGenerating(false) when its request completes. Date/action/resource buttons clearpreviewLoaded, but donot invalidate that outstanding request. There is no requestgeneration or returnedquery identity guard. Errors canalsoleaveanolderpreviewloaded afterfailure.

Source repair: bind preview readiness to a request generation. Invalidate pending work on frequency/action/resource changes, loading a preset, and unmount. Clear old data/readiness when a request starts; ignore superseded success/error/finally. Export returns while not ready or generating and cannot implicitly fetch. Manual Preview, recipient settings, local presets, and disabled email remain unchanged.

Validation: 9 focused tests of the extracted actual callbacks PASS, including deferred response races, stale errors, preset changes, and export guards. All 183 retained frontend tests PASS. Source production build PASS (35.47 seconds). Rocket version 777 completed. No email or audit-log export was triggered. Production artifact preparation, deployment, and live verification remain pending.
