# Closed QA API route matrix — September 15

The live isolated API passed 206 route-denial checks: all 157 unreviewed recovered
route contracts were denied to a synthetic super-admin, and 49 mutating,
administrative, report or bank routes were denied to ordinary synthetic staff.
Each response was the identity boundary's exact 403 rejection. No handler's
success response was accepted as a denial. Checks stop on the first discrepancy.

Both before and after, health confirmed the fixed QA Supabase project, blocked
internet sockets, hidden production/root home directories, connected QA database,
and disabled external execution. Only the existing two reviewed GET routes remain
enabled. Test bodies contained only `qa_fixture: true`, with inert synthetic IDs
for path parameters. No production endpoint or real operational record was used.

This establishes route closure, not positive workflow completion. Payroll,
payments, claims, insurance, scheduling, outreach, report export and purchases
still need reviewed route authorization and dedicated simulation integration
before their positive QA workflows can be accepted. No routes were enabled here.

The independent restored-frontend check also passed all 17 HTTP assertions,
including release `37eafbcf`'s exact entry digest, QA-only connection policy,
allowed QA CORS, denied production/Collaboration-origin CORS, session requirements,
and the unchanged production entry `index-a6a4e36b8660.js`. No browser-rendering
claim is made from those HTTP checks.
