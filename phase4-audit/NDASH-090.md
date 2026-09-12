# NDASH-090 — Huddle Analytics displays obsolete office results

Section: Huddle Analytics. Status: source fixed; compiled validation and deployment pending.

Initial live mount shows104huddles under selectedBarnegat/Last30Days. Changing toLast7 and back toLast30 yields correct26 forBarnegat. Fullreload later returns26, but repeated rapidAll→Barnegat reproduces104 with no loading indicator. All-office records override the selected-office result. Source getHuddlesForAnalytics applies office/date filters correctly; component accepts all async completions and starts an all-office read before its default office resolves.

Targeted fix in huddle-analytics/index.jsx: a per-component request generation, immediate stale chart-data clear, guards for returned data/errors/loading completion, and effect cleanup invalidation on scope change/unmount. Preserve office initialization, query arguments, permissions, chart formulas and date range helper. Obsolete reads may still finish; their results are ignored. No business writes.

Seven actual-loader/effect behavior cases; six failed before; all386frontendtests PASS after. Build/Rocket/compiled/live checks pending. Date preset inclusive-day issue is separate and not edited in090.

Build29.91s/Rocket815/actualcompiledrequestordering PASS. Late success/error/loading/cleanup ignored; currenterror/empty/no-user/queryarguments PASS. Entireentryreverses089; allpreviousrepairs and7dependencyrelinks preserved, payroll/datehelperunchanged. Candidateprepared; live release pending.

