# BlueK

BlueK ist eine browserbasierte Kotlin-Lernumgebung nach dem BlueJ-Prinzip. Die
Svelte-Oberfläche mit Klassenkarten, Objektbank, Codepad und BluePlay ist die
einzige gepflegte Anwendung. Schülercode wird ausschließlich in einem
Browser-Worker mit Kotlite ausgeführt.

## Start und Build

Für die Entwicklung werden Node.js 22 und einmalig Java 21 für den Kotlin/JS-Build benötigt. Java und Gradle sind kein Bestandteil der ausgelieferten Laufzeit.

```sh
npm install
npm run build
npm run dev
```

Die Anwendung verwendet Svelte und den `LocalRuntimeClient` direkt. Ein
Produktionsbuild ist mit `npm run build:svelte` möglich. Die Oberfläche ist
lokal unter dem von Vite ausgegebenen Port
erreichbar; es wird nichts gepusht oder auf GitHub Pages verändert.

`npm run build:kotlite` erzeugt den lokal eingebundenen Bundle unter `frontend/public/kotlite/`; `npm run build` baut die statische Vite-Anwendung nach `frontend/dist/`. Die Produktionsdateien können mit jedem statischen Webserver ausgeliefert werden:

```sh
python3 -m http.server 4173 --directory frontend/dist
```

Zur Laufzeit werden keine Interpreter von CDNs geladen. Optional kann der
schlanke SQLite-Dienst `server/share-server.mjs` Projekt-Kurz-Links für 30 Tage
speichern. Er führt keinen Benutzeraccount und keine serverseitige Kotlin-
Verarbeitung ein, sondern speichert nur das Projekt-JSON.

Lokal werden Vite und der Dienst getrennt gestartet:

```sh
npm run share:server
npm run dev
```

Vite leitet `/api` im Entwicklungsbetrieb an `127.0.0.1:8787` weiter. Für den
Produktivbetrieb kann Caddy die statische Anwendung ausliefern und `/api/*` an
denselben Dienst weiterleiten. Siehe [Serverbetrieb](docs/server-deployment.md).

## Offline-Paket für Prüfungen

`npm run build:offline` erzeugt unter `dist-offline/` einen eigenständigen
Ordner `BlueK-offline/` samt ZIP. Er enthält die Anwendung (`app/`), einen
kleinen Server und Startskripte für Windows (`start.bat`) und macOS/Linux
(`start.command`). Auf dem Zielrechner wird nichts installiert, der Server
lauscht nur auf `127.0.0.1`, und es wird kein einziger externer Request
ausgelöst.

`start.bat` nutzt Node.js oder Python, falls vorhanden, sonst den mitgelieferten
PowerShell-Server (Windows-Bordmittel). Das ZIP landet zusätzlich unter
`frontend/public/downloads/`; die Online-Version verlinkt es unten links in der
Seitenleiste. `npm run build` baut es jedes Mal neu, `npm run dev` legt es über
`predev` an, falls es fehlt.

Im Offline-Build sind die Funktionen
ausgeblendet, die den Kurz-Link-Dienst brauchen; Export/Import als JSON und
`Copy Full Project Link` funktionieren weiter. Absicherung:
`npm run test:offline`.

## Lokale Architektur

Die verbindlichen Zuständigkeiten, Zustandsübergänge, Einschränkungen und die
Übergabe für weitere Tests stehen in [Runtime-Architektur](docs/runtime-architecture.md).

Die Klassenkarten-Metadaten für Klassen, Properties, Konstruktoren und Methoden stammen aus dem von Kotlite analysierten AST. Der Browser-Adapter ergänzt nur geerbte Mitglieder für die vorhandene GUI und ordnet Top-Level-Funktionen ihren Dateikarten zu.

- `frontend/src/SvelteApp.svelte` enthält die Svelte-GUI.
- `frontend/src/entry.ts` ist der alleinige Browser-Einstiegspunkt.
- `frontend/src/localRuntimeClient.ts` ist der einzige Befehlszugang und liefert einen gemeinsamen beobachtbaren Runtime-Snapshot an die GUI.
- `frontend/src/localRuntimeWorker.ts` lädt das statische Kotlite-Asset und serialisiert Worker-Nachrichten.
- `frontend/src/runtimeHost.ts` übersetzt Befehle in die Kotlin/JS-Schnittstelle und veröffentlicht danach Ausgaben und passive Objektzustände.
- `frontend/src/runtimeMetadata.ts` gruppiert ausschließlich die Metadaten aus Kotlite für die GUI.
- `kotlite-browser` baut die `KotliteSession` als Kotlin/JS-Browserbundle.
- `runtime-contract` enthält die weiterhin sinnvolle GUI-/Runtime-Schnittstelle.
- `examples` enthält lokale Projektdateien und Medien.

Die Svelte-GUI deckt die zentralen Bedienpfade (Editor, Compile, main, Codepad,
interaktive Eingabe/EOF, Terminal, Objektbank, Konstruktor-/Methodendialoge,
Inspector, BluePlay sowie Projekt- und Dateifunktionen) ab. Add Media bleibt in
dieser Vorschau entsprechend der aktuellen Produktentscheidung deaktiviert.

Kotlite ist auf `io.github.sunny-chung:kotlite-interpreter:1.1.2` und `io.github.sunny-chung:kotlite-stdlib:1.1.0` festgelegt. Herkunft ist [sunny-chung/kotlite](https://github.com/sunny-chung/kotlite), Lizenz MIT (Upstream-Lizenzdatei). Der Bundle wird während des Builds in die Anwendung kopiert; ein installiertes Kotlin-System ist beim Betrieb nicht nötig.

## Zustandsmodell

Pro Compile wird ein neuer Worker und damit eine neue Kotlite-Sitzung gestartet. Innerhalb einer Sitzung bleibt ein `Interpreter` bestehen. Projektdateien werden gemeinsam analysiert und einschließlich ihrer Top-Level-Initialisierungen ausgewertet. Eine neue Codepad-Eingabe wird gegen den bisherigen Quelltext analysiert, aber nur ihr neuer Quelltextbereich ausgeführt. Dadurch werden frühere Konstruktoren und Seiteneffekte nicht wiederholt. Analysefehler sind korrigierbar; nach einem Laufzeitfehler ist ein Reset oder Compile erforderlich, da bereits ausgeführte Seiteneffekte nicht zurückgerollt werden.

Objekte bleiben echte Kotlite-Instanzen. Codepad und Objektbank verwenden einen gemeinsamen Namensraum. Die Runtime besitzt die Namensbindungen; die Oberfläche zeigt ihren Snapshot an und verwaltet keine unabhängige Referenzliste.

- Ein über die Objektbank erzeugter Name ist auch im Codepad verfügbar. Entfernen löscht diese Namensbindung und gibt den Namen frei.
- Codepad-Variablen bleiben bis Compile/Reset bestehen. Übernimmt man ein Ergebnis unter einem bereits vorhandenen Namen für **dasselbe Objekt**, wird nur die Objektbank-Ansicht eingeblendet. Entfernen blendet diese Ansicht aus, löscht aber nicht die Codepad-Variable.
- Ein neuer Name erzeugt eine zusätzliche, unabhängig entfernbare Referenz. Ein vorhandener Name für ein anderes Objekt oder einen anderen Wert wird abgewiesen.
- Bei `var` folgt die Objektbank-Ansicht dem aktuellen Wert der Variablen. Ein anderer Alias behält seinen eigenen Wert.
- Weitere Referenzen – auch über Objektfelder, unterstützte Collections oder eingefangene Lambda-Variablen – halten das Objekt erreichbar. Erst wenn keine solche Referenz mehr existiert, werden seine alten UI-Handles ungültig: Inspektoren schließen sich und alte Codepad-Ergebnisse können das Objekt nicht wiederherstellen. Neue Ausdrucksergebnisse können zunächst übernommen werden; das gilt auch für einen gerade zurückgegebenen Wert wie bei `items.removeAt(0)`, ohne alte Ergebnis-Schaltflächen wieder zu aktivieren.

Beispiel: Nach interaktivem Erzeugen von `timer1` und `val t3 = timer1` kann `timer1` entfernt werden. `t3` funktioniert weiter, ebenso eine unabhängige Eingabe wie `val a = 5`. Ein später neu erzeugtes `timer1` ist eine neue Referenz und verändert `t3` nicht. Details zur Analyse-Historie und zu Host-Datentypen stehen in [docs/architecture.md](docs/architecture.md).

Inspektoren lesen Backing-Felder passiv; berechnete Getter werden nicht beim Rendern ausgeführt. `Stop`, `Reset` und `Compile` verwerfen Worker beziehungsweise Sitzung; verspätete Antworten alter Worker werden nicht weiterverwendet. Reset lädt die zuletzt kompilierten Projektdateien neu.

## Bedienung

`Compile` analysiert alle Kotlin-Dateien gemeinsam und aktualisiert die Klassenkarten. Über den Konstruktor-Dialog der Klassenkarten lassen sich benannte Objekte erzeugen; Rechtsklick auf ein Objekt bietet Methoden, Inspektion und Entfernen. Codepad-Ergebnisse können unter einem neuen Namen oder – falls der Name bereits dieselbe Referenz bezeichnet – als vorhandene Referenz in die Objektbank übernommen werden. Codepad-Eingaben werden einzeln ausgeführt, und Variablen aus früheren Eingaben bleiben bis zum Reset verfügbar. Projektdateien und Medien werden lokal geöffnet, gespeichert und eingebettet.

## Tests

Die Tests umfassen außerdem `init`-Blöcke ohne Wiederholung sowie Safe-Call/Elvis-Ausdrücke mit nullbaren und später gesetzten Werten.

```sh
npm run typecheck
npm run browser-smoke
npm run test:references
```

Die Smoke-Tests prüfen getrennte Sitzungsaktionen, Objekt-Handles, Alias-Identität, getrennte Instanzen, Vererbung, dynamischen Dispatch, Host-Aufrufe, Sichtbarkeit privater Properties, Reset und die Ablehnung einer `val`-Neuzuweisung. `npm run test:runtime-state` prüft zusätzlich den echten Client und Host mit dem gebauten Kotlite-Bundle: gemeinsame Objektzustände, passive Inspektion, Fehlerphasen, konkurrierende Befehle und verspätete Worker-Antworten. Die Browser-Abnahme prüft außerdem den realen Compile-/Main-Dialog, `waitingForInput`, Fortsetzung nach Return sowie Reset während einer offenen Eingabe.

## Aktuelle Grenzen und bewusste Entscheidungen

Die Klassenkarten-Metadaten werden aus dem von Kotlite erzeugten AST-Manifest gewonnen; der TypeScript-Adapter ergänzt nur geerbte Mitglieder und Top-Level-Funktionskarten für die vorhandene GUI. Der Kotlite-Kern enthält eine suspendierbare Aufrufkette sowie Continuation-basierte Zeilen-/EOF-Eingabe. Worker, Client und UI führen dazu ein generation- und request-id-gesichertes Ereignisprotokoll; während `waitingForInput` bleiben Ausgabe, Eingabefeld, EOF und Stop aktiv, ohne die Worker-Warteschlange zu blockieren. Lange Schleifen geben über kooperative Checkpoints an die Event-Schleife zurück. BluePlay ist für eine browserlokale Welt mit `World`, `Actor`, `act`, `show`, `start`, `stop`, `step`, Geschwindigkeit, Tastaturzustand, Klickabfragen, `setBackground`, `showText`, `getObjectsAt` sowie grundlegenden Actor-Zugriffen (`getX`, `getY`, `setLocation`, `getRotation`, `setRotation`, `move`, `turn`) angeschlossen. `move(distance)` unterstützt dabei beliebige Winkel und rundet die Bewegung auf ganze Zellen. Das Beispiel ist über `?example=blueplay` ladbar; die vollständige BluePlay-API ist noch nicht portiert.

Kotlites dokumentierte Sprachgrenzen gelten weiterhin, unter anderem bei `protected`, Packages, sekundären Konstruktoren, `data class`/`object`/`companion object`/`sealed`, verschachtelten Klassen und Teilen der Standardbibliothek. JVM-Bibliotheken (`java.*`, `javax.*`) stehen im Browser nicht zur Verfügung; ein solcher Import wird mit Datei und Zeile gemeldet, `kotlin.*`-Imports sind erlaubt. Private Properties und Methoden werden innerhalb der jeweiligen Schülerklasse zugelassen und außerhalb bereits beim Kompilieren abgewiesen; private Methoden erscheinen nicht im Objektmenü. BlueJ-Projekte lassen sich als ZIP oder Ordner öffnen (siehe `frontend/src/blueJImport.ts`). Einfache benutzerdefinierte Getter und Setter für Klassen-Properties werden vom eingebundenen Interpreter unterstützt; Property-Typ und ein separates Speicherfeld sind dafür erforderlich. In BlueK ist dafür ein gepinnter Quellstand des eigenen Kotlite-Forks eingebunden; der Patch hält eingebaute Erweiterungsfunktionen auch nach mehreren Analyseläufen einer dauerhaften Sitzung auflösbar und erlaubt dem Objektinspektor den passiven Zugriff auf Setter-Backing-Felder. Grundlegende Listenoperationen wie Indexzugriff, `size`, `count { ... }` und `MutableList.add` sind damit inkrementell nutzbar; der parameterlose Aufruf `count()` ist in der aktuellen Kotlite-Stdlib noch nicht vorhanden. Die BluePlay-API umfasst zusätzlich `turnTowards(x, y)` und `distanceTo(actor)`; die Berechnung erfolgt lokal über die Browser-Bridge. `Image` unterstützt lokale Zeichenoperationen (`setColor`, `fill`, `fillRect`, `drawRect`, `fillOval`, `drawOval`, `drawLine`, `drawString`, `drawImage`, `clear`) sowie Transparenz; diese werden als Stage-Daten im Browser gerendert. Nicht unterstützter oder fehlerhafter Code wird lokal als Fehler zurückgegeben und nicht an einen Backend-Fallback weitergereicht.

Kotlite bildet die Grundlage für die lokale OOP-Ausführung und eine dauerhafte Codepad-/Objektbank-Sitzung. Der eingebundene Kotlite-Fork löst geerbte Methoden auch über den impliziten Empfänger auf; innerhalb einer Unterklasse funktionieren daher sowohl `move(1)` als auch `this.move(1)`. Die BluePlay-Integration bleibt bewusst auf die im Abschnitt beschriebenen Funktionen begrenzt und bietet noch keine vollständige Funktionsparität.
