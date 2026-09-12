# NDASH-096 — Legacy Insurance fallback leads to a retired site

Status: verification in progress. Severity: Medium.

Twice reproduced through the native Legacy Form tab: embedded retired Rocket URL displays Netlify Site not found, while the surrounding native notice recommends it as an email fallback. Native Request Queue and New Request screens are available.

Root cause: the legacy JSX block embeds the obsolete external form without an availability state. Repair only that branch: replace its warning text with an explicit unavailable notice and the iframe with Open Request Queue / Open New Request controls wired to the existing local tab state. The latter retains canSubmit permission. All native forms, queue data, permission checks and business handlers remain unchanged.

This repairs the misleading dead-end UI; it does not restore the retired external email form. External legacy form restoration is separately unavailable and is not claimed complete. No replacement app, external submissions, business records or configuration changes.

Three focused synthetic render/navigation/permission tests fail before; all419 tests PASS after. Build30.57s PASS. Rocket, compiled artifact, deployment and live verification pending. Frontend095 rollback retained; worker093/backend085 unchanged.

Rocket821 confirmed exact legacy-branch notice/buttons/canSubmit scope. Actualcompiled permission/navigation/noiframe/full095reversal/priorrepairs/7relinksPASS. Candidateindex-ffe64bdb518f.js. Deployment pending.

