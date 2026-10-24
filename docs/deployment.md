# Deployment

Target production split: **bluek.online is served directly by GitHub Pages**;
**api.bluek.online** is the optional Node 22/SQLite service on the existing host.
The static editor never depends on the API host, reverse proxy or a startup
health request. API requests time out after 15 seconds (feedback keeps its
separate bounded timeouts). Static resources include the interpreter, BluePlay,
standard media, formatter, examples, help, player and offline download.

The repository prepares this split; DNS, GitHub settings, live migration and
deployment must still be performed by the operator. No live infrastructure
change is part of the implementation. See [storage contract](server-storage.md).

## Independent workflows

| Workflow | Trigger | Result |
| --- | --- | --- |
| deploy-pages.yml | main push/manual | Full build; root base `/`, dedicated API at `https://api.bluek.online`; independent Pages artifact/deployment |
| deploy-server.yml | main push/manual | API/migration tests, API source/dependencies only, restart existing bluek-share service; no static build or rsync |
| deploy-beta.yml | beta push/manual | Full build and API tests; restricted database backup; deploy additive API migration to the shared service, then deploy beta static files |

Pages and API are separate workflows with no job dependency. A failed API
build/deployment cannot block Pages. Beta remains the existing separate static
host (`beta.bluek.online`). Its deployment tests and deploys the account API
first, takes a restricted SQLite backup, then updates the beta static files.
The API migration keeps the existing database path and data; it does not create
a beta database. `beta.bluek.de` redirects to `beta.bluek.online`, whose Origin
is already allowed by the shared API. The beta UI can use accounts while the
main UI remains unchanged. Later, the main UI can use this same API and database.
Never deploy untrusted beta code under an allowed account Origin.

Secrets: `BLUEK_DEPLOY_SSH_KEY`, `BLUEK_DEPLOY_KNOWN_HOSTS`, `BLUEK_DEPLOY_HOST`,
`BLUEK_DEPLOY_USER`, `BLUEK_DEPLOY_PORT`, `BLUEK_BETA_DEPLOY_PATH`.
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

1. The beta workflow backs up the SQLite database consistently with SQLite's
   backup API before restarting the service, keeps backups restricted, and
   removes backups older than seven days. For manual deployments, make the same
   backup and test migration on a copy first.
2. Configure `api.bluek.online` DNS to the existing API host, Caddy HTTPS and the
   service environment below. Deploy the new API before the static cutover.
   Existing project/program routes remain available. Confirm old word codes and
   technical feedback work from their intended Origins.
3. In GitHub, verify ownership of `bluek.online`, select **Settings → Pages →
   Source: GitHub Actions**, and set custom domain **bluek.online**. Do this
   before DNS cutover. Publish the root-base Pages artifact. With an Actions
   publishing source, GitHub's custom-domain setting is authoritative; a CNAME
   file alone does not configure it.
4. Point the production apex directly at Pages, removing conflicting records to
   the old host: use ALIAS/ANAME to `tomkarp.github.io`, or the four GitHub Pages
   A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153`. If using IPv6, set all four Pages AAAA records
   `2606:50c0:8000::153` through `2606:50c0:8003::153`, with A records as well.
   `www` may CNAME directly to `tomkarp.github.io`. Do not point the production
   apex to Caddy or put an API-host redirect/proxy in front of it.
5. Wait for GitHub's DNS/certificate checks and enable **Enforce HTTPS**. Keep
   the API on HTTPS too. Confirm the actual answers and certificates rather than
   assuming a workflow changed DNS. Follow the current
   [GitHub custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
6. Remove the old `bluek.online` static vhost from Caddy after propagation. Keep
   API compatibility on old alias domains only where needed for downloaded old
   clients. Domain fragments survive browser redirects; legacy `/bluek/`,
   `/run/`, `/load/` and former `/BlueK/` paths use the Pages 404 app fallback.
   New query links require no rewrite and return the ordinary root document.
7. Verify production and beta: account registration/login/logout/password
   change, own/other private projects, publication/player, operator block,
   technical feedback, existing links. Then block the API origin in browser
   developer tools and verify editing/running/BluePlay/examples/help/JSON/BlueJ
   and HTML export from the Pages origin. This live acceptance is still required.

The API migration is additive and transactional: old `projects` JSON and expiry
values remain unchanged; every old identifier is permanently reserved before
cleanup. Old public copies keep their original deadline (up to the existing
30-day period), including their old media. New copies use seven days and the
new validation. No bulk deletion or deadline rewrite is needed. Expired content
continues to be cleaned according to its recorded expiry. Never reset the
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
| BLUEK_SHARE_HOST / PORT | `127.0.0.1` / `8787` |
| BLUEK_SHARE_DB | repository-relative `server/data/projects.sqlite`; in production, retain the existing configured path when deploying an additive migration |
| BLUEK_API_ORIGINS | `https://bluek.online,https://beta.bluek.online,http://localhost:5173,http://127.0.0.1:5173`; production set only the two HTTPS origins |
| BLUEK_COOKIE_SECURE | secure by default; `0` only for local HTTP tests/development |
| BLUEK_COOKIE_SAMESITE | `Lax`; optional `None` requires Secure and explicit cross-site Origin |
| VITE_BLUEK_API_URL | build-time API origin; beta uses its same-site `/api` proxy on `https://beta.bluek.online`, later Pages builds use `https://api.bluek.online`; localhost uses Vite's `/api` proxy |
| VITE_BASE_PATH | `/`; optional static-prefix builds use the same app/configuration |
| BLUEK_FEEDBACK_* | existing private-feedback configuration, see [feedback](feedback.md) |

The API host-only Secure cookie works across the same-site HTTPS frontend/API
split with `credentials: include` and exact credentialed CORS. Do not set a
Domain cookie or wildcard allowlist. An unrelated github.io preview is not an
account Origin by default. Static/local features work there; cross-site account
cookies need explicit configuration and may be browser-blocked. Feedback keeps
its separate anonymous Origin allowlist (including offline `null`).

Example `/etc/bluek/api.env`, owned by root and readable only by the service:

```ini
NODE_ENV=production
BLUEK_SHARE_HOST=127.0.0.1
BLUEK_SHARE_PORT=8787
BLUEK_SHARE_DB=/opt/bluek-share/data/projects.sqlite
BLUEK_API_ORIGINS=https://bluek.online,https://beta.bluek.online
BLUEK_COOKIE_SECURE=1
BLUEK_COOKIE_SAMESITE=Lax
BLUEK_FEEDBACK_TOKEN_FILE=/etc/bluek/feedback-token
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

Run the protected [operator CLI](server-storage.md#operator-actions) via SSH as
the service user with `BLUEK_SHARE_DB` set to the production database. Inspect
JSON without running it and block inappropriate copies promptly. No automated
notification or external message delivery was introduced. Arrange operator
responsibility before opening publication.

Hourly/startup cleanup removes expired public content, expired sessions, and
accounts inactive for twelve calendar months with
their private projects. SQLite secure deletion and WAL checkpointing reduce
residual deleted data; this is not forensic erasure on every filesystem.
Backups must have an explicit finite rotation (recommended at most seven days)
and restricted access; do not retain public payloads indefinitely as evidence.
Existing technical-feedback outbox retention remains separate. A stopped service
cannot clean files until restart, but it never serves expired copies on restart.

There is no chosen global disk quota or publication rate limit. Monitor capacity,
backup expiry and service errors. When disk fills, saves fail;
local work remains available and users must download JSON backups. Provisioning,
load/capacity measurement, DNS/TLS behavior, live migration and final production
acceptance have not been performed by this repository change.
