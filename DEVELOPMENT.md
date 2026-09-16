# BlueK – Entwicklungsstand

Der Architekturversuch läuft auf dem Branch `main`.

## Entwicklung

```sh
npm install
npm run build
npm run dev
```

Der Build erzeugt zuerst den gebündelten Kotlite-Interpreter und danach die statische Vite-Anwendung. Für einen Produktionscheck genügt ein statischer Server:

```sh
python3 -m http.server 4173 --directory frontend/dist
```

Der einzige Runtime-Ausführungspfad ist der Browser-Worker. Die langlebige Kotlite-Sitzung erhält Objektidentität und Codepad-Bindings über getrennte Eingaben hinweg; Compile, Reset und Stop beginnen mit einer neuen Sitzung beziehungsweise einem neuen Worker.

Für Projekt-Kurz-Links läuft zusätzlich `npm run share:server`. Der Dienst
verwendet SQLite, speichert ohne Benutzerverwaltung 30 Tage und wird im
Produktivbetrieb nur lokal an Caddy gebunden. Die Einrichtung steht in
[docs/server-deployment.md](docs/server-deployment.md).

## Prüfungen

```sh
npm run browser-smoke
npm run build
```

Der Smoke-Test deckt Objektidentität, Alias-Verhalten, getrennte Instanzen, Vererbung, dynamischen Dispatch, Host-Aufrufe, private Property-Zugriffe, Handle-Verlust nach `remove`/`reset`, BluePlay-Schritte und Klick-Rückrufe sowie Typ- und `val`-Fehler ab. Die Produktions-GUI wurde zusätzlich über einen statischen lokalen Server geöffnet und mit Compile, `main()`, Act, Run und Pause geprüft. Der gemeinsame Objektwelt-Ablauf wurde ebenfalls direkt geprüft: `Figure` und `World` wurden über Klassenkarten erzeugt, `world1.addObject(figure1, 5, 6)` im Codepad ausgeführt und `Act` bewegte denselben Actor sichtbar weiter.

## Bekannte Grenzen

Die vorhandene GUI bleibt die Basis. In diesem Versuch sind Kotlite-Ausführung, Codepad, Objektbank und der erste BluePlay-Durchstich lokal angebunden. Die Klassenkarten werden aus Kotlites AST-Manifest erzeugt; der lokale Adapter ergänzt nur GUI-spezifische geerbte Mitglieder. `readln`/`readlnOrNull`/`readLine` verwenden einen lokalen Eingabepuffer, der über das vorhandene Terminal befüllt wird; ein bereits laufender Interpreter-Aufruf kann nicht asynchron auf spätere Eingabe warten. BluePlay bietet noch keine vollständige API-/Medienparität. Die erste `Image`-Zeichen-API wird als Snapshot-Daten im Browser gerendert. Der Stop-Lebenszyklus wurde zusätzlich in der Produktions-GUI mit einer Endlosschleife im Codepad geprüft: Die Oberfläche blieb bedienbar, `Stop` beendete den Worker und verwirkte anschließend die Objektbank. Siehe [README.md](README.md).
