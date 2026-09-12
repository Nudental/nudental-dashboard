# NDASH-067 — POS collection endpoint omits the existing API-key dependency

Section: RCM Point of Service Collection. Severity: High. Status: tested candidate; deployment and live verification pending.

Reproduction: public GET/v2/rcm/pos-collections with an empty2999-01-01 period returns200 both withoutX-API-Key and with an explicitly invalid synthetic key. Response bodies were not loaded. Existing authorizedAugustread-only probe/UI/source agree280events/108440.41/243unique patients; Barnegat93/43965.66 andStaten8/8095.26. No businesswrites.

Exact root cause: this route decorator omits dependencies=[Depends(verify_api_key)], used by neighboring protected routes. Existing verify_api_key rejects missing/mismatchedkeys with401. Narrow fix adds that existing dependency to this route only. Handlerbody byte/AST equivalent; no calculations, financialrecords, credentials, sessions, policies, autharchitecture, providerconfiguration or frontend changes.

Preservation: currentmain_candidateSHA8117c4026155dccb1e08d9db5e0978df2972c5b9f75850d4f1a25881e64b4ed4 snapshotprivately onserver/ndash067-backend/main_candidate.before.py. CandidateSHAf37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51. Fullbackendcontainscredentials and is neither printed nor committed. ReversaltoexactpriorSHA/Pythonparse/unchangedhandlerPASS.

Tests: actualdecorator+actualverify_api_key tested withFastAPITestClient, synthetickey andinertpaymenthandler. Before2unauthorizedtestsFAIL; aftermissingkey401/invalidkey401/validkey200andhandlerinvokedonlyforvalidkeyPASS(3tests). Retainedaging6,claimstatus10,fiveGusto/expensebackend suites andadjustmentreversalsPASS. Initialupload-helperexecutionusedsystemPython withoutFastAPI; no installation attempted; preparedsuite ranusingexistingapplicationvenv successfully. Production unchanged duringpreparation.

Deploymentmustuseexistingcandidate8002thenlive8001, withrollbackandmigration/backgroundsync/AMQPSguards. Existingreadonlycacheprewarm preserved. Verifyunauthorizedempty-period401andreal-keyauthorizedsummary/rowsunchanged; claims/production/collections/agingregressions. Frontendmustremain065after066rollback. No publicpush.
