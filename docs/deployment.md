# Deployment

Target production split: **bluek.online is served directly by GitHub Pages**;
**api.bluek.online** is the production Node 22/SQLite service on the existing
host. Beta uses its own **beta.bluek.online** static host and separate
**api-beta.bluek.online** API service and SQLite database.
The static editor never depends on the API host, reverse proxy or a startup
health request. API requests time out after 15 seconds (feedback keeps its
separate bounded timeouts). Static resources include the interpreter, BluePlay,
standard media, formatter, examples, help, player and offline download.

The production split was deployed on 2026-10-25. GitHub Pages serves the main
site directly at `bluek.online`; the existing host serves the production API
and the isolated beta frontend/API. DNS, HTTPS, API health and the deployed
workflows were checked during cutover. The steps below remain the provisioning,
verification and rollback runbook. See [storage contract](server-storage.md).

## Independent workflows

| Workflow | Trigger | Result |
| --- | --- | --- |
| deploy-pages.yml | main push/manual | Full build; root base `/`, dedicated API at `https://api.bluek.online`; independent Pages artifact/deployment |
| deploy-server.yml | main push/manual | API/migration tests, API source/dependencies only, restart existing bluek-share service; no static build or rsync |
| deploy-beta.yml | beta push/manual | Full build and API tests; back up only the beta database; deploy the beta API service, then beta static files |

Pages and the production API are separate workflows with no job dependency. A
failed production API build/deployment cannot block Pages. Beta keeps its own
static host and now has a separate service, port, database path, origin allowlist
and host-only session cookies. Beta deployment backs up and restarts only
`bluek-beta-share`; it never reads or writes `/opt/bluek-share` or the production
database. `beta.bluek.online/api/*` remains routed to port 8788 for compatibility
with already-built beta clients; new beta builds call `api-beta.bluek.online`
directly. Both APIs may run on the same physical machine, so they still share
host availability and operating-system administration.

The first beta deployment creates a new empty beta database. The workflow does
not copy the formerly shared database: that database has no reliable field that
distinguishes records created from beta from any other records. If existing
beta accounts/projects must carry over, make and review a separate database-copy
plan before enabling the new service. Copying the old database duplicates its
contents; it does not separate their history.

Secrets: `BLUEK_DEPLOY_SSH_KEY`, `BLUEK_DEPLOY_KNOWN_HOSTS`, `BLUEK_DEPLOY_HOST`,
`BLUEK_DEPLOY_USER`, `BLUEK_DEPLOY_PORT`, `BLUEK_BETA_DEPLOY_PATH`.
The beta static path secret must resolve to `/root/bluek-beta`, matching the
current Caddy document root; the workflow checks this before uploading files.
`BLUEK_DEPLOY_PATH` is no longer used for production static files. Existing
server service paths are retained. API rsync excludes `server/data/`, does not
use `--delete`, and never copies databases to Pages. Keep secrets in a root-owned
service environment/token file outside the repository. The Pages artifact is
only `frontend/dist`; do not add server data, credentials or symlinks there.

The editorial [inf-schule handoff](inf-schule-handoff.md) is part of the normal
static app on main and beta, including GitHub Pages. It requires no API or
special build flag; offline builds disable the receiver. The sender script and
project files are copied to inf-schule separately, outside these workflows.

## Cutover order and rollback

1. Provision the separate beta API service and its environment below. Point
   `api-beta.bluek.online` DNS to the existing host and add its Caddy HTTPS
   route. The beta service listens on `127.0.0.1:8788`, uses
   `/opt/bluek-beta-share/data/projects.sqlite`, and allows only the
   `https://beta.bluek.online` frontend Origin. The beta workflow verifies these
   settings before deploying. Configure this service before enabling the
   workflow.
2. Decide whether beta starts empty or receives a deliberately prepared copy of
   existing shared data. The workflow never seeds it automatically. Back up
   any source database and test a copy first; do not point beta at the
   production database.
3. The beta workflow backs up the beta SQLite database consistently with
   SQLite's backup API before restarting its service, keeps backups restricted,
   and removes backups older than seven days. It then health-checks port 8788
   before deploying beta static files. The production database is untouched.
4. Keep `api.bluek.online` on the production API service and configure its
   production environment below. Confirm its project/program routes and
   technical feedback continue to work from the main Origin.
5. In GitHub, verify ownership of `bluek.online`, select **Settings → Pages →
   Source: GitHub Actions**, and set custom domain **bluek.online**. Do this
   before DNS cutover. Publish the root-base Pages artifact. With an Actions
   publishing source, GitHub's custom-domain setting is authoritative; a CNAME
   file alone does not configure it.
6. Point the production apex directly at Pages, removing conflicting records to
   the old host: use ALIAS/ANAME to `tomkarp.github.io`, or the four GitHub Pages
   A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153`. If using IPv6, set all four Pages AAAA records
   `2606:50c0:8000::153` through `2606:50c0:8003::153`, with A records as well.
   `www` may CNAME directly to `tomkarp.github.io`. Do not point the production
   apex to Caddy or put an API-host redirect/proxy in front of it.
7. Wait for GitHub's DNS/certificate checks and enable **Enforce HTTPS**. Keep
   the API on HTTPS too. Confirm the actual answers and certificates rather than
   assuming a workflow changed DNS. Follow the current
   [GitHub custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
8. Remove the old `bluek.online` static vhost from Caddy after propagation. Keep
   API compatibility on old alias domains only where needed for downloaded old
   clients. Domain fragments survive browser redirects; legacy `/bluek/`,
   `/run/`, `/load/` and former `/BlueK/` paths use the Pages 404 app fallback.
   New query links require no rewrite and return the ordinary root document.
9. For a new cutover, verify production and beta independently: account registration/login/logout/password
   change, own/other private projects, publication/player, operator block,
   technical feedback, existing links. Then block the API origin in browser
   developer tools and verify editing/running/BluePlay/examples/help/JSON/BlueJ
   and HTML export from the Pages origin. Treat these as acceptance checks for
   future deployments; the initial production cutover is complete.

The API migration is additive and transactional: old `projects` JSON and expiry
values remain unchanged; every old identifier is permanently reserved before
cleanup. Old public copies keep their original deadline, including their old
media. New anonymous copies use seven days, regular account copies 30 days, and
trusted account copies 365 days. Only trusted accounts may publish custom media. No bulk deletion or deadline rewrite is
needed. Expired content continues to be cleaned according to its recorded
expiry. Never reset the
identifier registry, including when restoring a backup.

Rollback: stop new writes, make a consistent backup, and prefer fixing forward.
An old API can read the retained projects table but does not enforce new media,
expiry/suspension policy or account moderation; do not expose it as a production
rollback. A database rollback must preserve all codes issued since the backup
by merging their identifier reservations first; otherwise old links could be
reused. Restoring a stale snapshot must also preserve blocks and must not revive
expired public payloads. Keep all account/private data restricted during repair.

## Service configuration

| Variable | Default / use |
| --- | --- |
| BLUEK_SHARE_HOST / PORT | `127.0.0.1` / `8787` production; `127.0.0.1` / `8788` beta |
| BLUEK_SHARE_DB | Production retains its existing path. Beta uses `/opt/bluek-beta-share/data/projects.sqlite`; never point both services at one database. |
| BLUEK_API_ORIGINS | Set per service: production `https://bluek.online`; beta `https://beta.bluek.online`. Local API tests use their own explicit Origins. |
| BLUEK_COOKIE_SECURE | secure by default; `0` only for local HTTP tests/development |
| BLUEK_COOKIE_SAMESITE | `Lax`; optional `None` requires Secure and explicit cross-site Origin |
| VITE_BLUEK_API_URL | build-time API origin; main uses `https://api.bluek.online`, beta uses `https://api-beta.bluek.online`; localhost uses Vite's `/api` proxy |
| VITE_BASE_PATH | `/`; optional static-prefix builds use the same app/configuration |
| BLUEK_FEEDBACK_* | existing private-feedback configuration, see [feedback](feedback.md) |

Each API uses a host-only Secure cookie across its same-site HTTPS frontend/API
split with `credentials: include` and exact credentialed CORS. Main cookies are
hosted by `api.bluek.online`; beta cookies by `api-beta.bluek.online`. Do not set
a Domain cookie or wildcard allowlist. An unrelated github.io preview is not
an account Origin by default. Static/local features work there; cross-site
account cookies need explicit configuration and may be browser-blocked.
Feedback has a separate anonymous Origin allowlist for each service.

Example `/etc/bluek/api.env`, owned by root and readable only by the service:

```ini
NODE_ENV=production
BLUEK_SHARE_HOST=127.0.0.1
BLUEK_SHARE_PORT=8787
BLUEK_SHARE_DB=/opt/bluek-share/data/projects.sqlite
BLUEK_API_ORIGINS=https://bluek.online
BLUEK_COOKIE_SECURE=1
BLUEK_COOKIE_SAMESITE=Lax
BLUEK_FEEDBACK_TOKEN_FILE=/etc/bluek/feedback-token
BLUEK_FEEDBACK_ORIGINS=https://bluek.online
```

Example systemd unit `/etc/systemd/system/bluek-share.service`:

```ini
[Unit]
Description=BlueK account, project and report API
After=network.target
[Service]
Type=simple
User=bluek-share
WorkingDirectory=/opt/bluek-share
EnvironmentFile=/etc/bluek/api.env
ExecStart=/usr/bin/node /opt/bluek-share/server/share-server.mjs
Restart=on-failure
RestartSec=2
UMask=0077
[Install]
WantedBy=multi-user.target
```

For beta, use a separate user, environment file, working directory, service
unit, port and database path. These files are installed on the host before the
beta deployment workflow is enabled.

Example `/etc/bluek-beta/api.env`, owned by root and readable only by the
beta service:

```ini
NODE_ENV=production
BLUEK_SHARE_HOST=127.0.0.1
BLUEK_SHARE_PORT=8788
BLUEK_SHARE_DB=/opt/bluek-beta-share/data/projects.sqlite
BLUEK_API_ORIGINS=https://beta.bluek.online
BLUEK_COOKIE_SECURE=1
BLUEK_COOKIE_SAMESITE=Lax
BLUEK_FEEDBACK_TOKEN_FILE=/etc/bluek/feedback-token
BLUEK_FEEDBACK_ORIGINS=https://beta.bluek.online
```

Beta technical feedback uses the existing private repository, token file and
its own SQLite queue. Grant the `bluek-beta-share` service account read access
to `/etc/bluek/feedback-token` and traversal access to `/etc/bluek` while
keeping the token restricted from other users. The workflow verifies the
configured path and that the token file exists. Main and beta reports reach
the same private repository and use the same credential; their API processes
and local queues remain separate.

Example `/etc/systemd/system/bluek-beta-share.service`:

```ini
[Unit]
Description=BlueK beta account and project API
After=network.target
[Service]
Type=simple
User=bluek-beta-share
WorkingDirectory=/opt/bluek-beta-share
EnvironmentFile=/etc/bluek-beta/api.env
ExecStart=/usr/bin/node /opt/bluek-beta-share/server/share-server.mjs
Restart=on-failure
RestartSec=2
UMask=0077
[Install]
WantedBy=multi-user.target
```

Create the `bluek-beta-share` system user and `/opt/bluek-beta-share` data and
backup directories with restricted permissions. The deploy user needs restart
permission for `bluek-beta-share` separately from `bluek-share`. Run the two
services with distinct database files and do not copy a production database to
beta without an explicit data decision.

Create/reuse the dedicated `bluek-share` system user. Give it the database
directory, protect `/etc/bluek` and database backups, then `daemon-reload` and
restart/enable the service. The deploy user needs the existing service restart
permissions. Prefer dependencies/source owned by the deploy/root user and data
writable by the runtime user; review the inherited deploy ownership for your host.
Never run the runtime as root.

Caddy template is [server/Caddyfile.example](../server/Caddyfile.example). The
API hostname only proxies `/api/*`; all other paths return 404. Request-size
limits must permit 10 MiB technical reports, not apply the 1 MiB project limit
at the proxy. Do not log request bodies, passwords or session headers. Validate
Caddy configuration before reload. Check:

```sh
curl -fsS https://api.bluek.online/api/health
curl -i -X OPTIONS https://api.bluek.online/api/private-projects \
  -H 'Origin: https://bluek.online' -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-bluek-request'
```

## Moderation and retention operations

Run the protected [operator CLI](server-storage.md#operator-actions) via SSH
with permission to read the running service's process environment and access the
database. In the installed service directory it reads `BLUEK_SHARE_DB` from that
process; an explicit environment variable overrides it. Inspect
JSON without running it and block inappropriate copies promptly. No automated
notification or external message delivery was introduced. Arrange operator
responsibility before opening publication.

Hourly/startup cleanup removes expired public content, expired sessions, and
accounts inactive for twelve calendar months with their owned public copies and
their private projects. SQLite secure deletion and WAL checkpointing reduce
residual deleted data; this is not forensic erasure on every filesystem.
Backups must have an explicit finite rotation (recommended at most seven days)
and restricted access; do not retain public payloads indefinitely as evidence.
Existing technical-feedback outbox retention remains separate. A stopped service
cannot clean files until restart, but it never serves expired copies on restart.

There is no chosen global disk quota or publication rate limit. Monitor capacity,
backup expiry and service errors. When disk fills, saves fail;
local work remains available and users must download JSON backups. Provisioning,
DNS/TLS configuration, migration and deployment were completed during the
2026-10-25 cutover. No production load/capacity measurement is recorded here.
