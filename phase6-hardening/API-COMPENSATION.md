# Provider-compensation identity repair

Candidate status: native runtime verification PASS; production deployment pending.

The three existing routes `/v2/auth/payroll-access`, `GET /v2/reports/provider-compensation`, and `POST /v2/reports/provider-compensation/send` accepted the caller's `userEmail` as authorization. A synthetic execution of the preserved live handler reproduced unauthorized report rendering using another address; no production report or email was generated.

The adapted candidate uses the existing verified Supabase identity boundary and current active/approved profile. Report/send access additionally requires the existing provider-compensation view permission (or Super Admin), all-office scope because these existing calculations aggregate all offices, and the unchanged existing email allowlist. The compatibility query parameter remains accepted but cannot authorize a different account. The access-check route returns only the verified caller's email and permission. Read-only job credentials cannot access these routes. The application-key dependency remains.

Validation: 70 local tests and 88 native Python/FastAPI tests PASS, with the isolated guard loaded and zero blocked attempts. Actual route bodies were exercised using synthetic reports and a mail stub. Tests cover missing/invalid identity, email spoofing, role/scope denial, current authorized access, preserved argument passing and safe invalid-parameter probes. The report and send calculation bodies are AST-identical; all unrelated main-module code and 18 materialized files remain unchanged. All 17 retained backend suites also PASS under the production-data safety guard.

Release requires a fresh source/configuration snapshot, current Pages ID and entry hash, financial/report-audit row fingerprints, annotated backup tag, candidate-service verification before the live service restart, denial probes, existing payroll-validator continuity and production/QA health. No actual payroll report delivery, provider synchronization, schema change or financial edit is part of this release. Rollback restores precisely the three affected files and restarts the existing services.
