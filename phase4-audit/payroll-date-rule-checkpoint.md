# Payroll date rule confirmed by the user —2026-09-11

User clarification: August21 payday uses the Ascend report August2–15, while Gusto's own payroll period is August3–16. Preserve the recently updated calculation. These are two distinct date ranges; do not relabel or modify the Gusto source period to match Ascend.

Live selected run: Aug21,2026 | Regular | Aug3,2026–Aug16,2026. Visible Pay Period and Payday labels match that Gusto record.

Current deployed main c3f09f11cfc3 contains the existing one-day shift inside the shared payroll service function Sve. An isolated trace of the actual extracted production function confirms exactly one getProductionByProvider call for2026-08-02 through2026-08-15 when passed2026-08-03 through2026-08-16. No business requests or records were made by the isolated test. Verification script: work/phase4-verify-deployed-payroll-window.cjs.

No date calculation was edited during this clarification. Backend and the service's date-shift implementation remain unchanged. Important source mismatch: recovered Rocket source applies the shift in callers; production applies it inside the shared service. Do not transplant one implementation over the other or apply the shift twice. Full source builds remain verification artifacts, not replacements for the deployed main.

Access-log verification was unavailable: the audit SSH account cannot read the relevant journal, and sudo journal access is denied. Browser console has no matching request URL logs. Do not claim the isolated request trace is a captured live HTTP request. The browser selection and deployed-code trace are the current evidence. No request for extra privileges is needed while other audit work remains available.
