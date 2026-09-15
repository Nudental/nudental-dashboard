# Isolated QA hosting verification — September 15

- Frontend: https://nudashboard-qa.pages.dev
- API: https://nudashboard-qa-api.nuholdingllc.com
- Supabase project: `hvtxjfayenqnwtaisoaw`, synthetic fixtures only.
- Dedicated tunnel: `nudashboard-qa`,
  `947f508e-bb48-45a9-be1a-1f09f266f105`, healthy on yadon-abem-01.
- Only route: QA API hostname to `unix:/run/nudashboard-qa/api.sock`.
- New DNS CNAME targets that exact QA tunnel. Existing routes are unchanged.
- User service: `cloudflared-nudashboard-qa.service`, explicit separate config
  and private token file. Existing production/shared tunnel is untouched.

The existing deployment token could inspect but could not create a tunnel or
write DNS. The existing authenticated Cloudflare dashboard created the separate
tunnel and its route. No existing token permissions were expanded. The token was
transferred privately into the dedicated connector directory without exposing it
in source, command arguments, or chat. No root tunnel service was installed.

Pages project `nudashboard-qa` uses branch
`feature/nudental-dashboard-qa-phase5`. It has no production database/API settings.
Deployment `b547e61e-10a4-4650-ba49-5fd72cb76a5d` succeeded from the verified static
artifact based on source `a62a0cdee8167d7e6ec87c8ea04efb711d8d29e2`.

Frontend entry `assets/index-D24EYxWd.js`, 8,821,508 bytes, SHA256
`69b22d82bfa1ec663a88432c4e837a5846eab511cddb79219d5d1f5673ca08d4`.
Archive SHA256 `929d72cabe1d1f4ff8228893fa225ce7ea138f4971e34f76f50d2b53910f023c`.

Live verification:

- 15/15 public API identity/isolation probes PASS.
- 22/22 public API office-access/readback/counter probes PASS.
- 17/17 hosted frontend/API checks PASS: route fallback, QA headers, exact QA-only
  connection policy, deployed entry digest/banner, allowed QA preflight,
  rejected production/Collaboration-origin preflight, missing/invalid session
  denial, and unchanged production entry.
- Hosted browser displays QA / NONPRODUCTION and signs in as the existing
  synthetic office manager. The first clipboard transfer produced an invalid
  credential; repeating via verified private readback succeeded. No credential
  was changed and no product repair was inferred from that harness failure.
- The initial Python verifier's default user agent received Cloudflare 1010.
  A declared QA verification user agent passed, with no WAF/security changes.

Production Pages deployment remains
`1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`, entry `index-a6a4e36b8660.js`.
The existing production browser session opens the normal executive Dashboard.
No production deployment, credential change, or business-data write occurred.

Readiness limit: the recovered API still enables only reviewed
`GET /v2/daily-entries`. Other business routes remain denied for every role while
their scope and mock adapters are integrated. The hosted EOD closeout consequently
cannot yet resolve its office through the disabled offices API. Health explicitly
reports `product_api_ready: false`. Phase 5 is not complete.
