# Serverbetrieb für Projekt-Kurz-Links

BlueK bleibt im Browser eine statische Svelte-Anwendung. Für „Copy Short Link“
kommt lediglich ein kleiner Node-Prozess mit SQLite hinzu. Caddy bleibt der
einzige öffentliche Dienst: statische Dateien werden direkt ausgeliefert,
`/api/*` wird intern weitergeleitet.

## Dienst

```sh
npm install
npm run build
BLUEK_SHARE_DB=/var/lib/bluek/projects.sqlite npm run share:server
```

Der Dienst lauscht standardmäßig nur auf `127.0.0.1:8787`. SQLite legt neben
der Datenbank eventuell `-wal`- und `-shm`-Dateien an; alle drei Dateien müssen
im Datenverzeichnis bleiben. Projekte laufen nach 30 Tagen ab. Jeder Link
besteht immer aus genau drei englischen Wörtern.

Ein mögliches systemd-Unit-Template (`/etc/systemd/system/bluek-share.service`):

```ini
[Unit]
Description=BlueK project share API
After=network.target

[Service]
Type=simple
User=bluek
WorkingDirectory=/srv/bluek
Environment=NODE_ENV=production
Environment=BLUEK_SHARE_HOST=127.0.0.1
Environment=BLUEK_SHARE_PORT=8787
Environment=BLUEK_SHARE_DB=/var/lib/bluek/projects.sqlite
ExecStart=/usr/bin/node /srv/bluek/server/share-server.mjs
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Pfade, Benutzer und Node-Pfad anpassen. Danach einmalig:

```sh
sudo install -d -o bluek -g bluek /var/lib/bluek
sudo systemctl daemon-reload
sudo systemctl enable --now bluek-share
```

## Caddy

Im vorhandenen `bluek.de`-Site-Block müssen API-Regel und SPA-Fallback vor dem
statischen File-Handler stehen:

```caddyfile
bluek.de {
    root * /srv/bluek/frontend/dist

    handle /api/* {
        reverse_proxy 127.0.0.1:8787
    }

    try_files {path} /index.html
    file_server
}
```

Danach prüfen und neu laden:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -fsS https://bluek.de/api/health
```

Es gibt absichtlich keine Benutzerverwaltung. Wer einen Kurz-Link kennt, kann
das zugehörige Projekt lesen; sensible Daten gehören daher nicht in geteilte
Projekte.
