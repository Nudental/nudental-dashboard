# Rocket workspace synchronization blocker — September13

The existing NuDental Dashboard Rocket workspace completed NDASH-142 as version871. NDASH-143 was refused with: "You've exhausted credit limit or remaining credits are not enough to proceed with your request." The UI lists September27 as the refresh date.

The user was notified and an asynchronous request to check/restore usable credits was sent. No purchase, plan change or billing action was taken. Do not claim Rocket143 complete or retry repeatedly while credits remain unavailable.

The current recovered repository, compiler, deployment server and live Dashboard remain accessible. User authorization covers these paths independently, so safe repairs and live verification continue. Track all subsequent changes here for eventual Rocket synchronization. Preserve the existing workspace; do not create a replacement project.

Pending Rocket update: NDASH-143, the two office-commit callbacks in HierarchicalFilter.jsx and Financial Analytics index.jsx. Source tests, build and scoped artifact pass; deployment/live verification tracked in its issue document.
