# Deployment

BlueK ist eine statische Anwendung. Optional kommt ein kleiner Node-Dienst mit
SQLite für Projekt-Kurzlinks hinzu. Auf dem eigenen Server ist Caddy der
einzige öffentliche Dienst: Er liefert die statischen Dateien aus und leitet
`/api/*` intern an den Share-Dienst weiter.

## Workflows

Alle Workflows bauen vollständig neu (Java 21, Node 22, `npm ci`,
`npm run build`) und lassen sich auch manuell starten.

| Workflow | Auslöser | Ziel |
| --- | --- | --- |
| `.github/workflows/deploy-server.yml` | Push auf `main` | statische Dateien per rsync nach `BLUEK_DEPLOY_PATH` (bluek.de); Share-Dienst nach `/opt/bluek-share/`, dort `npm ci --omit=dev` und `systemctl restart bluek-share` |
| `.github/workflows/deploy-pages.yml` | Push auf `main` | GitHub Pages unter dem Basispfad `/BlueK/`; ohne Share-Dienst |
| `.github/workflows/deploy-beta.yml` | Push auf `beta` | nur statische Dateien nach `BLUEK_BETA_DEPLOY_PATH` (beta.bluek.de); nutzt den Share-Dienst der öffentlichen Version mit |

Benötigte Repository-Secrets (Settings → Secrets and variables → Actions):
`BLUEK_DEPLOY_SSH_KEY`, `BLUEK_DEPLOY_KNOWN_HOSTS`, `BLUEK_DEPLOY_HOST`,
`BLUEK_DEPLOY_USER`, `BLUEK_DEPLOY_PORT`, `BLUEK_DEPLOY_PATH` und
`BLUEK_BETA_DEPLOY_PATH` (z. B. `/root/bluek-beta`). Der Deploy-Benutzer muss
die Zielverzeichnisse anlegen und beschreiben sowie `bluek-share` neu starten
dürfen.

## Share-Dienst

`server/share-server.mjs` speichert Projekt-JSON ohne Benutzerverwaltung für
30 Tage. Jeder Code besteht aus drei englischen Wörtern aus
`data/share-words-en.txt` (siehe [share-wordlist.md](share-wordlist.md)).
Wer einen Code kennt, kann das Projekt lesen; sensible Daten gehören nicht in
geteilte Projekte.

| Endpunkt | Zweck |
| --- | --- |
| `GET /api/health` | Lebenszeichen |
| `POST /api/projects` | Projekt speichern (höchstens 10 MB), liefert `code` und `expiresAt` |
| `GET /api/projects/<code>` | Projekt laden |

Die Oberfläche öffnet Kurzlinks unter `/load/<code>`.

| Umgebungsvariable | Standard |
| --- | --- |
| `BLUEK_SHARE_HOST` | `127.0.0.1` |
| `BLUEK_SHARE_PORT` | `8787` |
| `BLUEK_SHARE_DB` | `server/data/projects.sqlite` relativ zum Projektordner |
| `BLUEK_SHARE_WORDS` | `data/share-words-en.txt` relativ zum Projektordner |

SQLite legt neben der Datenbank `-wal`- und `-shm`-Dateien an; alle drei
müssen im Datenverzeichnis bleiben. Lokal: `npm run share:server`, Test:
`npm run test:share-server`.

### systemd

Die Unit auf dem Server ist nicht Teil des Repositorys. Eine Vorlage, die den
Pfaden des Workflows folgt (`/etc/systemd/system/bluek-share.service`):

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

Einmalig einrichten:

```sh
sudo useradd --system --home /opt/bluek-share bluek-share
sudo install -d -o bluek-share -g bluek-share /opt/bluek-share/data
sudo systemctl daemon-reload
sudo systemctl enable --now bluek-share
```

## Caddy

API-Regel und SPA-Fallback müssen vor dem statischen File-Handler stehen; der
Fallback ist auch für `/load/<code>` nötig.

```caddyfile
bluek.de {
    root * <BLUEK_DEPLOY_PATH>

    handle /api/* {
        reverse_proxy 127.0.0.1:8787
    }

    try_files {path} /index.html
    file_server
}

beta.bluek.de {
    root * <BLUEK_BETA_DEPLOY_PATH>

    handle /api/* {
        reverse_proxy 127.0.0.1:8787
    }

    try_files {path} /index.html
    file_server
}
```

Danach:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -fsS https://bluek.de/api/health
```

Für `beta.bluek.de` muss ein DNS-Eintrag (`A`/`AAAA` oder `CNAME` auf
`bluek.de`) auf denselben Server zeigen; das TLS-Zertifikat holt Caddy
automatisch.
