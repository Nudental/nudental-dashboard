# NDASH-093 — Direct Insurance URL redirects to a retired site

Section: Insurance navigation. Severity: Medium. Status: reviewed repair pending.

Direct navigation to https://nudashboard.com/insurance-verify returns HTTP302 to the retired Rocket-hosted insurance site, which displays Netlify Site not found. Native sidebar navigation renders the existing Insurance Verification Request Queue at the correct Dashboard URL. No new app or feature is needed.

Root cause: the nudental-manual Cloudflare Worker on nudashboard.com/insurance-verify* has an exact-path branch returning the obsolete redirect. Current Pages092 _redirects contains only the normal SPA fallback; the frontend route/component are already present.

Recovery: existing immutable Cloudflare worker version22f696b1-3eeb-48d3-89b5-879bc0438e53, verified in active version history and its View Logs version filter. The platform lists25 saved versions and supports rollback to retained versions. No existing version is deleted. API snapshot attempts returned403 because the existing Pages deployment token lacks Worker scope; the signed-in Cloudflare editor exposes the current source and version history. No credential is expanded or replaced.

Reviewed change: only replace the exact-path return302 statement with return fetch(request), forwarding the unchanged request to the existing application origin. Keep the route binding, DNS, authentication, worker bindings, all other handlers, manual, legacy form and Gusto callback unchanged. Patch and recovery reference in ndash093-worker-patch.json. Source was inspected in the existing editor; full worker source is retained in Cloudflare's version history rather than copied into this repository.

Cloudflare documents that fetch(request) in a route worker forwards to the existing application server: https://developers.cloudflare.com/workers/configuration/routing/routes/ . Tests and deployment pending. No business data changes.

The earlier temporary093 comparison-table investigation was identified as duplicate066 and all local candidate edits were reverted. It was never deployed and is not a separate repaired defect.

CLOSED PASS. Fourfocusedroutecasesplusretained400tests=404PASS. Cloudflareeditorappliedexactone-statementreplacementafterverificationof1of1match;anearlierincorrectundeployeddraftwasdiscardedbyclosingthetabandtheoriginal22fversionreloadedwithDeploydisabled. Noincorrectdraftwasdeployed. Newworker6e4c7721-7c59-4935-8ec8-e19296c198ccactive;prior22f696b1versionretainedandverifiedinhistory. PublicrootandInsuranceHTTP200/noLocation;authenticateddirectreloadstaysonDashboard/nativetabs/twoCompletedrequests/errors0. Pages092entryunchanged;backend085hashunchanged;root/API/manualHEAD200;three servicesactive. No DNS/binding/auth/credential/businesschanges. Frontendbuildnotrerunforthisworker-onlyrelease;existing092buildremainscurrent.
