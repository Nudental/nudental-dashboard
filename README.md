# NuDental Dashboard

The current Dashboard frontend is **recovered-frontend/**. Restored backend
source is **recovered-backend/**. Root development, build and preview commands
delegate to the current frontend. The older root src/, Vite configuration and
dependency manifests remain as preserved historical work; they are not the
production build entry.

Use Node22.22.1/npm10.9.4. Install the current frontend with
`npm run setup:frontend`, then use `npm run build`. Setup uses the committed
frontend lockfile; `--force` accepts the preserved peer dependency combination
and `--ignore-scripts` avoids dependency lifecycle execution. The production
output is recovered-frontend/build/. No command here deploys it.

Build inputs are environment-specific: VITE_SUPABASE_URL,
VITE_SUPABASE_ANON_KEY and VITE_ASCEND_API_KEY. Supply values privately.
Never reuse a production build or its environment file for QA. A static
production reference build must not be served as a QA environment.

`npm test` runs the retained Phase4 and Phase5 frontend tests. Artifact parity
checks additionally require NDASH_PRODUCTION_ENTRY to point to the privately
preserved, checksum-verified deployment entry. NDASH_PARSER_ROOT can point to
the independent installed reference frontend. A run with skipped artifact
checks is not sufficient for source promotion. Backend reconstruction and
isolated test instructions are in recovered-backend/README.md and
phase5-reconciliation/backend-source-provenance.md.

See phase5-reconciliation/source-closure.md for source/build equivalence and
phase5-reconciliation/README.md for the Phase5 checkpoint. Production remains
on its existing verified deployment. A Git push does not replace it.
