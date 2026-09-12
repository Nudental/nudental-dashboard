# NDASH-097 — Insurance notice incorrectly denies email and Dentrix actions

Status: verification in progress. Severity: Medium.

Reproduced in the native Insurance page: banner says No emails are sent / No Dentrix upload, but the settled completed-request drawer exposes Email PDF to Office. Source also has existing permission-gated email and Dentrix upload handlers and confirmation dialogs. No such action was executed during testing.

Root cause: stale informational text from an earlier workflow phase. Replace only that sentence with: Email delivery and Dentrix uploads are separate actions available to authorized users. No element, handler, permission, configuration, record or network action changes.

All419 retained regression tests PASS. Build/Rocket/actual compiled artifact/deployment/live verification pending. Frontend096 rollback retained; worker093/backend085 unchanged. Positive external email/upload behavior remains intentionally untested on production records.

Build30.31sPASS;Rocket822confirmedexactsentence;compiledsingletextreplacement/full096reversal/prioractionsandrepairs/7relinksPASS. Candidateindex-00cc80eede31.js;deploymentpending.


CLOSED PASS. Deploymentf04faf28-5129-407a-ab8a-2743e259561e/index-00cc80eede31.js. Correctnoticevisible/falseclaimabsent;baseline2;settledEmailPDFactionstillvisible(noexecution);drawerXcloses;096fallbacknativequeuelinkretained;reloadnoticepersists/errors0. Root/nativeInsurance/API200/3services/backend085/worker093unchanged.096rollbackretained. No businessdata or externaldelivery changes.

