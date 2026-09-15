# Dashboard QA server isolation

The user executed the one-time checked installer on `yadon-abem-01` as root.
Installer SHA256:
`85c92e1a55c6b592c7e63340319fa49a8aaf66b18aea5b94d189d4756ccc6781`.
Eight offline archive/configuration/destination tests passed, and the installed
systemd255 accepted all four service/socket definitions before installation.

Live readback confirms the QA API and socket plus broker socket are active.
The bootstrap reports direct Internet sockets blocked, production and root home
directories hidden, environment QA, and the dedicated Supabase project reference.
Production middleware and tunnel services remain active.

The API runs as locked `nudashboard-qa` in a root filesystem assembled from
read-only OS libraries and its release, with writable QA state only. It has a
private network namespace, AF_UNIX sockets only, no capabilities, and no new
privileges. A separate locked broker forwards bounded requests only to
`hvtxjfayenqnwtaisoaw.supabase.co`, rejects other destinations and redirects, and
holds no provider credentials. Its code and service definitions are root-owned.

The root-owned `/usr/local/sbin/nudashboard-qa-deploy` command accepts no arguments.
The existing server user can supply only `release.zip` and `connection.json` in
the protected QA incoming directory. The publisher validates files, rejects
archive traversal/links/devices, requires the exact QA database, preserves old
releases/configuration, and restores the prior QA release after failed health.
It never executes candidate application code as root or changes its own service
definitions. No general sudo or additional SSH access was granted.

The current release is an isolation bootstrap, **not the recovered product API**.
Its health response explicitly has `product_api_ready: false`. Product routes,
role/scope enforcement, provider mocks, broker integration and persistent public
QA routing remain to be installed and verified. No QA database credentials have
yet been transferred to the server. Do not mistake successful isolation setup
for completed Phase5 functional testing.

Production services, SSH/password settings, firewall, routing and data were not
changed. The installer refuses existing QA paths; do not rerun it. Use the scoped
publisher for subsequent QA application releases. Preserve the root-owned
installer copy and all old releases for recovery.
