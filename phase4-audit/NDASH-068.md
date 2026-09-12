# NDASH-068 — Adjustment breakdowns omit their monetary amounts

Section: RCM Adjustment Summary. Severity: Medium. Status: tested candidate; live verification pending.

Reproduced on065 inAugustAll: ByAdjustmentCategory10rows/OLT12rows/Office4rows showcounts butzero currencycells. SelectedProfessionalCourtesy repeats: totalcard-90.00/2records, threebreakdowns1roweach butnocurrency. Boundedread-onlyAPIprobe confirms eachgroup signed_amount=-90.00 andno amountproperty. Rowidentities/names/notes notoutput. Staffgroup hasabs_amountonly; reviewflags/latebuckets havecounts only.

Exactrootcause: genericBreakdownTabledefaults amountField to amount, while those three backendgroups expose signed_amount. Smallestfix adds amountField="signed_amount" onlyonByAdjustmentCategory/ByOLTType/ByOffice invocations. Helper, othergroups, counts/labels, data, calculations, backend, permissions andpayrolldates unchanged. Do not substitute staffabsamount asnetimpact or inventmoneyforcount-onlygroups.

ActualJSXtests fail3casesbefore, passafter;301source tests/build30.27sPASS. Actualdeployed17208byteSummarycomponent changes3props; existing4077bytehelperunchanged. Actualcompiled testsnegative/positive/zero/missingvalues/genericamountPASS; V8moduleparse/fullreversal/priorrepairs/sevenrelinksPASS. Rocket797completedmatching3props.

Candidateindex-a15faebf5226.js builtfromverified065deployment8afdd341-91fb-4509-9727-76d98c62b03e. Blocked066tablepatch explicitlyexcluded andassertedabsent. Private sourcebuildstillcontainsseparatepending066; neverreleasefullrecoveredbuild. Backend067SHAf37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51mustremainunchanged. Priorreleasepreserved; no financialwrites/exports/sync.
