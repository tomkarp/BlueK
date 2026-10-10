# Deployment

BlueK is a static application. An optional Node/SQLite service provides short
project links and [private feedback](feedback.md). Caddy serves static files
and proxies `/api/*` to that service.

## Workflows

All workflows run Java 21, Node 22, npm ci and a full npm run build;
manual dispatch is also available.

| Workflow | Trigger | Deployment |
| --- | --- | --- |
| deploy-server.yml | Push to main | rsync static files to BLUEK_DEPLOY_PATH; service to /opt/bluek-share, production dependencies and service restart |
| deploy-pages.yml | Push to main | GitHub Pages under /BlueK/, without share service |
| deploy-beta.yml | Push to beta | Static files to BLUEK_BETA_DEPLOY_PATH, using the public share service |

Repository secrets: `BLUEK_DEPLOY_SSH_KEY`, `BLUEK_DEPLOY_KNOWN_HOSTS`,
`BLUEK_DEPLOY_HOST`, `BLUEK_DEPLOY_USER`, `BLUEK_DEPLOY_PORT`,
`BLUEK_DEPLOY_PATH`, `BLUEK_BETA_DEPLOY_PATH`.
The deployment user needs directory write and service-restart permissions.

## Share service

`server/share-server.mjs` stores JSON for 30 days without user accounts.
Codes contain three random English words from the
[attributed word list](share-wordlist.md). Anyone with a code can read its
project; avoid sensitive content in shared projects.

| Endpoint | Purpose |
| --- | --- |
| GET /api/health | Health check |
| POST /api/projects | Store up to 10 MB; returns code/expiry |
| GET /api/projects/<code> | Retrieve project |

The UI opens `/load/<code>`.

| Variable | Default |
| --- | --- |
| BLUEK_SHARE_HOST | 127.0.0.1 |
| BLUEK_SHARE_PORT | 8787 |
| BLUEK_SHARE_DB | server/data/projects.sqlite relative to repository |
| BLUEK_SHARE_WORDS | data/share-words-en.txt relative to repository |

Keep SQLite database, -wal and -shm files together.
Local command: `npm run share:server`; test: `npm run test:share-server`.

### systemd example

The server unit is not checked in. Example matching workflow paths,
`/etc/systemd/system/bluek-share.service`:

```ini
[Unit]
Description=BlueK project share API
After=network.target

[Service]
Type=simple
User=bluek-share
WorkingDirectory=/opt/bluek-share
Environment=NODE_ENV=production
Environment=BLUEK_SHARE_HOST=127.0.0.1
Environment=BLUEK_SHARE_PORT=8787
Environment=BLUEK_SHARE_DB=/opt/bluek-share/data/projects.sqlite
ExecStart=/usr/bin/node /opt/bluek-share/server/share-server.mjs
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Initial setup:

```sh
sudo useradd --system --home /opt/bluek-share bluek-share
sudo install -d -o bluek-share -g bluek-share /opt/bluek-share/data
sudo systemctl daemon-reload
sudo systemctl enable --now bluek-share
```

## Caddy

API routing precedes the static handler; the SPA fallback supports `/load/<code>`.

```caddyfile
bluek.de {
    root * <BLUEK_DEPLOY_PATH>
    handle /api/* {
        reverse_proxy 127.0.0.1:8787
    }
    handle {
        try_files {path} /index.html
        file_server
    }
}

beta.bluek.de {
    root * <BLUEK_BETA_DEPLOY_PATH>
    handle /api/* {
        reverse_proxy 127.0.0.1:8787
    }
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

Validate and reload:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -fsS https://bluek.de/api/health
```

beta.bluek.de needs DNS to the same server; Caddy obtains TLS certificates.
