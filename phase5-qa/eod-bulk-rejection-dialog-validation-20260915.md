# PH5-EOD-009 — bulk rejection cannot open its reason prompt

On the hosted QA site, selecting two labeled synthetic reports and clicking
Reject All performed no action. The browser recorded `prompt() is not supported`
from handleBulkReject. The call occurred before its error handler. This affects
the embedded browser used for the audit; other browsers may support native prompts.

The repair uses the page's existing in-app dialog pattern with an accessible
heading/textarea label, required nonblank reason, explicit submit and Cancel.
Opening or cancelling performs no mutation. Cancel and successful submit clear
the reason. The existing database rejection/history payload is unchanged.

Four focused tests fail on the original code and pass after the correction.
QA build and source/configuration checks pass. Entry index-C_xPbu-i.js is
8,824,185 bytes, SHA256
9fd3774441c25202edac9893d7a5fef481ca2f48fc29dd4bf9c3d8bdf61ebe30.
QA deployment c85561da-0208-4993-889b-48da2b51ca8c from 5e18623de4 succeeded;
all 17 hosted artifact/isolation checks passed, including unchanged production.
Live dialog checks PASS: empty submit disabled, Cancel performed no writes,
reopening cleared the reason, valid reason submitted successfully and persisted
after refresh. API readback confirmed the exact reason and expected audit rows.
Both synthetic records were cleaned and their audit rows retained.
No production release was performed.

The positive submit also reproduced a separate stale bulk-rejection defect:
it overwrote a concurrent approval. See PH5-EOD-010; this dialog repair does not
claim the original bulk update logic was safe.

All 1120 retained frontend/production-parity tests PASS with no skips.
