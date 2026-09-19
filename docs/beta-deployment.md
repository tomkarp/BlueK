# Öffentliche BlueK-Beta

Die Beta läuft unabhängig vom öffentlichen `main`-Stand:

- Branch: `beta`
- Ziel: `https://beta.bluek.de`
- Deployment: `.github/workflows/deploy-beta.yml`
- Trigger: jeder Push auf `beta` oder manueller Workflow-Start
- Share-Service/Datenbank: gemeinsam mit der öffentlichen Version; die
  bestehenden 30-Tage-Regeln gelten unverändert

Der bestehende `main`-Workflow bleibt unverändert und deployt weiterhin die
öffentliche Version. Der Beta-Workflow baut dieselbe Anwendung, kopiert aber
nur die statischen Dateien in ein separates Verzeichnis. Dadurch beeinflusst
ein Beta-Deployment weder die Dateien noch den laufenden Share-Service der
öffentlichen Version.

## Einmalige Einrichtung durch Thomas

### GitHub-Secret

In den Repository-Settings unter **Secrets and variables → Actions** muss
folgendes zusätzliches Secret angelegt werden:

```text
BLUEK_BETA_DEPLOY_PATH=/root/bluek-beta
```

Die vorhandenen Secrets `BLUEK_DEPLOY_SSH_KEY`, `BLUEK_DEPLOY_KNOWN_HOSTS`,
`BLUEK_DEPLOY_HOST`, `BLUEK_DEPLOY_USER` und `BLUEK_DEPLOY_PORT` werden
wiederverwendet. Der Deploy-Benutzer muss das Zielverzeichnis anlegen und
beschreiben dürfen.

Auf dem Server kann das Zielverzeichnis beispielsweise so vorbereitet werden
(Benutzer und Pfad an die vorhandene Serverkonfiguration anpassen):

```sh
sudo install -d /root/bluek-beta
```

### DNS

Für `beta.bluek.de` muss ein DNS-Eintrag auf denselben Server wie
`bluek.de` zeigen. Möglich sind je nach DNS-Verwaltung ein `A`-/`AAAA`-Eintrag
auf die Serveradresse oder ein `CNAME` auf `bluek.de`.

### Caddy

Im Caddyfile muss ein eigener Site-Block ergänzt werden. Der API-Handler kann
auf denselben Share-Service zeigen, weil keine getrennte Beta-Datenbank
gewünscht ist:

```caddyfile
beta.bluek.de {
    root * /root/bluek-beta

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
```

Der TLS-Zertifikatserwerb für `beta.bluek.de` erfolgt dann über Caddy, sobald
der DNS-Eintrag öffentlich auf den Server zeigt.

## Verwendung

Die aktuelle lokale Arbeitskopie steht bereits auf dem Branch `beta`. Nach
einem Commit und Push deployt GitHub Actions automatisch:

```sh
git push origin beta
```

Die Produktionsversion bleibt an `main` gebunden.
