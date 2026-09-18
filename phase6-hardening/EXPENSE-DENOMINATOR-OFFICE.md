# Expense ratio selected-office read dependency

Candidate tested; deployment is not yet claimed.

The existing Expense Overview reads production and collections solely as ratio
denominators. Its helper sent a global request for multiple selected offices,
duplicate selections or an unknown office. Four of six synthetic tests reproduced
those failures before editing; the single-office and explicit all-office cases
already passed.

The targeted client change deduplicates and validates the office selection, then
reads each selected office separately. It sums only complete numeric denominators.
If any selected office is unavailable, that denominator stays unavailable rather
than showing a partial total. Existing single-office/all-office parsing and ratio
calculations remain unchanged. No expense source record, classification, provider
connection, accounting correction or expense total is modified.

All 1,660 frontend tests pass with zero skips. Production and QA builds pass;
environment keys/connect policies remain separate. The actual compiled helper
passes six cases in each environment. Six compiled Expense request-isolation checks
and three preserved RCM status cases per environment also pass.

Production candidate: `assets/index-CmE5HSJ_.js`, 8,833,924 bytes,
SHA256 `c05fd851703e35599daaafaf7c3d16ed229e9e29ebcc35bdc8d9979ff71a8545`.
QA candidate: `assets/index-D04awMLd.js`, 8,832,755 bytes,
SHA256 `3a93f9fc0461cb757da1a10610718845332629462bea9684b2a43940c40a046a`.

This client dependency must be verified before activating the core-read API gate.
The API candidate separately preserves the existing Expense parent plus Overview
permission for production/collection summary reads, scoped to the actor's offices.
It does not grant raw records, adjustments or cross-office reads from that permission.
