# Preserved Dashboard backend source

These templates represent the existing production middleware and its local client/subprocess dependency closure. They are a source-reconstruction baseline, **not an isolated QA runtime**. Their restored production configuration includes live-provider paths and execution commands. Do not run restored production source as QA.

Fifteen captured Python modules and one referenced SQL schema file round-trip to the exact original bytes. Seventy-one private configuration slots replace credentials, fixed email recipients, provider/bank/office mappings and historical financial reference totals. Configuration remains outside the repository. The materializer accepts only values of the reviewed literal type or strictly validated address text; it never imports application modules, opens a database, calls a provider, starts a service, executes SQL or deploys anything.

`source-manifest.json` records each original and template hash and the purpose/location of each configuration slot. `main_candidate.py` is the deployed entry behind the existing `main.py` link. `ascend_client.py` is restored above `middleware/`, matching the original layout. `plaid_sync.py` is included because the middleware starts it as a subprocess; an import-only inventory would miss it.

Run `materialize.py --values PRIVATE_CONFIGURATION_FILE --output NEW_PRIVATE_DIRECTORY --verify-production` to verify exact reconstruction. The output must not already exist and must be outside this source folder. The original private configuration file is retained only in the restricted recovery workspace; it must never be committed, pasted into a task, served, or reused in QA.

Review source edits and regenerate the template manifest deliberately. The `--verify-production` mode must fail for intentional source or configuration changes. The production comparison is separate from future QA configuration and execution-guard tests.

Existing runtime inputs still required: the running services' Python3.14.6 virtual environment and the observed dependency inventory, environment variables, private provider configuration files, SQLite data stores, and report/email executables. The server's default Python3.12.3 is not the API interpreter. The retained SQL file includes the historical row policies; preserving that source neither applies those policies nor certifies them for QA roles. The data stores are not part of this source copy. No production data migration, credential change, service change or deployment accompanies this source preservation.
