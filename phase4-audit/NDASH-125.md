# NDASH-125 — Unsaved request cart shows the preceding month

Severity: Medium. Status: CLOSED — deployed and live-verified PASS.

Twice reproduced on124: New Request selected June2026, but the cart shows May2026. Used a clearly labeled TEMP QA CALENDAR ONLY item held only in React state. Office remained blank and Submit Request stayed disabled. Removed each temporary item; no server request, order, catalog entry, local-storage write, or other business record was created.

Root cause: RequestCart in FrontDeskInventoryTab.jsx parses quickMonth + '-01' as UTC midnight before local formatting.

Smallest fix: append '-01T00:00:00' in this one cart month label. Selection, cart handling, submission guards, request persistence, notification handlers and export handlers are unchanged. Positive order submission and its confirmation/notification displays remain intentionally untested without an isolated Dashboard write environment.

Predeployment PASS: five focused tests (two fail before fix), all569 frontend tests, build29.78s,Rocket851. Actual compiled old expression reproduces May for June; candidate passes four time zones/year boundary/missing month. Complete reverse124 and seven unchanged modules with relinked entry PASS. Candidate index-ec7d8073cd46.js; deployment/live verification pending.

Release: sourcebc06b96;deployment0211b12f-0de2-4a2b-bf74-24ec5b08041a;entry index-ec7d8073cd46.js SHAec7d8073cd465290899300e9c7a4cc203dcc45c89662bb11d6cc9f6fcde4c9be. Prior124 retained. Fresh live June selection shows June; January shows January2026; blank office keeps Submit disabled. Removed temporary cart item, refreshed, confirmed blank month and empty cart. Saved history remains June4/July1. New errors0; frontend/API200 and3services active;backend113 unchanged. No production records created or modified.
