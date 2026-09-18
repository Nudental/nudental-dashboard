# Current-account OTP administrative access

Status: DEPLOYED and live-verified at 2026-09-18T06:35:08.187866+00:00 from `78cdc3c1994ac27dd3ac177abf1fd434984a8f06`. 11 focused local tests and 99 native tests PASS.

The existing helpers `_is_admin_or_super` and `_is_super_admin` accepted an administrator's stored role without requiring the account to remain active and approved. The preserved helper reproduced this with a synthetic inactive administrator. These helpers control OTP configuration and access to another user's trusted devices; existing Supabase authentication alone did not supply the missing profile-state restriction.

The one-file repair fetches the existing `is_approved` and `status` columns alongside `is_active`, and requires all three to indicate the current approved Active account before either administrative role check can succeed. Active admin/super-admin permissions remain unchanged. Normal OTP login routes, challenge handling, mail behavior, cookies and ordinary own-device behavior are unchanged. No credentials, authentication architecture or enforcement settings change.

All 99 native tests pass under the existing guard with zero blocked actions. Focused tests execute actual route bodies against synthetic profile/device/config/audit stubs, including disabled admin reads, other-user revocation, the Super Admin-only settings boundary and retained own-device scoping. All OTP route bodies and login functions are AST-identical. The other 20 materialized files match the verified compensation release; its 17 retained backend suites still apply to the unchanged main/service code.

Production verification will make only missing/invalid-identity requests to administrative routes, plus the existing safe payroll validator read and health checks. No OTP is sent, no trusted device is revoked, and no setting is changed. A fresh snapshot and row fingerprints preserve business, trusted-device, site-settings and authentication-audit rows; the previous OTP module remains immediately recoverable.

Live result: missing/invalid identity 401; jobs 403; existing payroll validator 200; production and QA health PASS. All 20,790 original guarded rows preserved; device/settings/authentication audit tables exactly unchanged. Payroll refreshed successfully with no captured console errors. No real OTP or configuration/device write. Recovery: `backup/api-before-phase6-otp-admin-20260918`, `api-otp-backup-20260918T063451Z`.
