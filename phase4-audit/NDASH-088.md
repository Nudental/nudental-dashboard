# NDASH-088 — Dashboard retains results from a previous office

Section: RCM Dashboard. Status: source fixed; compiled verification and live deployment pending.

Reproduction on087: first All→Staten transition left MTDnet280649/collection94.1% while Staten POS8095 was correct. A settled August Staten reload yields net9521/63.9%, confirmed by the existing read-only API: net9521.42, collections6088.45. Repeated Staten→All→Staten leaves claims122, patientbalance277438/count1278, portiondue14983/154, POS108440/280, refunds347, MTD280649/94.1%, follow-up111/53744 despite Staten selected and no loading indicator. OfficialAR remained correct at68759. No identities or patient rows printed.

Root cause: the same RcmDashboardTab instance and child local states survive office/date/refresh changes; their independent async loaders accept obsolete results. Smallest fix: one React key on RcmDashboardTab in rcm/index.jsx, composed of selectedOfficeId, dateRange.start/end, refreshKey. A changed scope mounts fresh child state so earlier responses cannot affect it. Equivalent scopes retain identity. Existing phased loading, calls, calculations, permissions, props and other tabs unchanged. Debug expansion resets on scope/refresh, consistent with resetting the Dashboard view. In-flight read requests are not canceled; their old component state is discarded.

Six actual source-key/React-identity regression cases: four failures before; all373 frontend tests PASS after. Production build and actual compiled checks pending. No typecheck script. Full recovered frontend will not be deployed; prior repairs and newer payroll must be preserved.

Build29.70s/Rocket813/actualcompiledscopeidentity PASS. Fullentry reverses to087; seven dependent chunks relink only, payroll unchanged. Prior064 whole-RCM component contains this intended child-call change; its preservation test replaces only that exact call before comparing the entire component, preserving its date guard. All other retained repairs byte-match. Controlled release ready.

