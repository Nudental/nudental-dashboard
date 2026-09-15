# QA API integration checkpoint — September 15

The recovered application is running under the installed isolated systemd QA
service. It is not yet a complete QA API, and it has not been deployed to
production. Production middleware and tunnel remain active.

The source materializer fills all 71 private production configuration slots with
synthetic values. A recorded QA overlay directs database files and configuration
to dedicated QA state. Original recovered templates remain unchanged. The
release includes 26 pinned Python dependencies installed from binary wheels;
production's Python environment is untouched.

The application can connect only through the fixed Unix-socket broker to
Supabase project `hvtxjfayenqnwtaisoaw`. Live checks confirm Internet sockets are
blocked, production home directories are absent, the real recovered application
loaded (164 framework routes), and QA database readback succeeds.

The initial release `cd870ca2036cc962631e1f65970b5cb56e9c28201b4604a3fd2bd18e83d3ebc6`
denied every business route. Fifteen live bootstrap/identity probes passed using
all 12 synthetic QA accounts. It remains recoverable.

First EOD-enabled QA release (preserved):
`2153f5020d75ccfd06daf66fffb943bc4170ab1a4ce3fe880786c0dbfc2f39b5`.
Only `GET /v2/daily-entries` is enabled after individual review. Every other
business endpoint remains denied, including for super administrators. Fresh
role permissions and office assignments use the existing application model.

Twenty-two live read-only EOD checks pass: permitted roles, ordinary-role denial,
inactive/unapproved denial, own-office persistence/readback, other-office denial,
omitted-office scoping, conflicting/duplicate selectors, UUID/location aliases,
record counters, and the retained API-key check. The existing synthetic EOD
record was read without creating or changing records. A test-harness mismatch
for the names of inactive/unapproved fixtures was corrected before the complete
22-check run; the incomplete earlier run is not counted.

Ten offline route/scope checks pass. Seven transport checks pass against the
actual pinned server dependencies, covering Requests, synchronous/asynchronous
HTTPX, urllib, repeated PostgREST filters, authentication headers, redirects,
body limits and destination denial. The Work computer lacks Requests in its
bundled Python; that initial local dependency failure was resolved by running
these tests with the actual QA dependency installation on the server.

The recovered EOD handler does not consistently recognize UUIDs in `locationId`.
The QA boundary canonicalizes checked office aliases to the supported UUID
`officeId` input, preventing an authorized-looking selector from becoming an
unfiltered service-role query. This is covered by offline and live probes.

Still required: authorization and mock integration for remaining routes,
all write-workflow and UI role checks, EOD
submission/approval audit history investigation and temporary-record cleanup.
Health continues to report `product_api_ready: false` intentionally.

Persistent hosting is now deployed and verified. See
`hosting-validation-20260915.md` for the exact dedicated tunnel, Pages release,
public-endpoint tests, production check, and remaining API readiness limit.
No shared tunnel or production routing has been changed.

The subsequent office-catalogue integration is deployed as
`8f86280efb3f08521ebaefba04a8a2f4412f08880b533365a0c2d8186dc4898b`.
Two exact GET routes are now enabled: daily entries and scoped office metadata.
See [office API validation](office-api-validation-20260915.md): 92 backend
checks and 60 public API checks pass. Remaining routes stay closed.
