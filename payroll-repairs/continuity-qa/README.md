# Isolated acceptance harness

These synthetic fixtures are never part of the production bundle or configuration. The reviewed September 20 run used a private candidate copy and retained Phase 6 FastAPI test framework on the existing server; both the code snapshot and QA state remain in the payroll-continuity task cache.

`ui/` mounts the actual production Provider Compensation component. Its only aliases are synthetic configuration/identity and the unrelated legacy hygienist companion transport. The real selector, imported-run pager, calendar helper, Dashboard fetch, doctor panel, report service and server route/source adapter run unchanged.

Build this harness with the repository's existing Vite dependencies; it needs no credentials. Serve the resulting static bundle through `qa-server.py` on loopback only. The server explicitly uses synthetic SQLite records, a paginated fake Ascend transport and the retained real permission boundary with test identities. External connections and application writes are blocked. Access is through a loopback SSH forward; do not expose it publicly. The three Import stage buttons make the October runs available without another build or policy change. `verify-qa.py` checks zero, unavailable, unknown-category and permission cases through HTTP.

The harness scripts identify the preserved private test workspace, not a production installation target. Do not install the fake transport, test identity resolver, synthetic clock, fixture database or UI aliases into any production process.
