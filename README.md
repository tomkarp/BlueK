# BlueK

BlueK ist eine browserbasierte Kotlin-Lernumgebung nach dem BlueJ-Prinzip. Die vorhandene React-Oberfläche mit Klassenkarten, Objektbank, Codepad und BluePlay bleibt erhalten. Schülercode wird ausschließlich in einem Browser-Worker mit Kotlite ausgeführt.

## Start und Build

Für die Entwicklung werden Node.js 22 und einmalig Java 21 für den Kotlin/JS-Build benötigt. Java und Gradle sind kein Bestandteil der ausgelieferten Laufzeit.

```sh
npm install
npm run build
npm run dev
```

`npm run build:kotlite` erzeugt den lokal eingebundenen Bundle unter `frontend/public/kotlite/`; `npm run build` baut die statische Vite-Anwendung nach `frontend/dist/`. Die Produktionsdateien können mit jedem statischen Webserver ausgeliefert werden:

```sh
python3 -m http.server 4173 --directory frontend/dist
```

Es gibt keinen Anwendungsserver, keine HTTP-/WebSocket-Runtime, keine serverseitige Kotlin-Verarbeitung und keinen Server-Fallback. Zur Laufzeit werden keine Interpreter von CDNs geladen.

## Lokale Architektur

Die Klassenkarten-Metadaten für Klassen, Properties, Konstruktoren und Methoden stammen aus dem von Kotlite analysierten AST. Der Browser-Adapter ergänzt nur geerbte Mitglieder für die vorhandene GUI und ordnet Top-Level-Funktionen ihren Dateikarten zu.

- `frontend/src/main.tsx` enthält die bestehende GUI.
- `frontend/src/localRuntimeClient.ts` erhält den Runtime-Vertrag als lokalen Adapter und übernimmt das von Kotlite erzeugte AST-Manifest für Klassenkarten, Konstruktor- und Methoden-Dialoge.
- `frontend/src/localRuntimeWorker.ts` lädt ausschließlich das statische Kotlite-Asset und verwaltet Worker-Nachrichten einschließlich Tastatur- und Mausklick-Ereignissen.
- `kotlite-browser` baut die `KotliteSession` als Kotlin/JS-Browserbundle.
- `runtime-contract` enthält die weiterhin sinnvolle GUI-/Runtime-Schnittstelle.
- `examples` enthält lokale Projektdateien und Medien.

Kotlite ist auf `io.github.sunny-chung:kotlite-interpreter:1.1.2` und `io.github.sunny-chung:kotlite-stdlib:1.1.0` festgelegt. Herkunft ist [sunny-chung/kotlite](https://github.com/sunny-chung/kotlite), Lizenz MIT (Upstream-Lizenzdatei). Der Bundle wird während des Builds in die Anwendung kopiert; ein installiertes Kotlin-System ist beim Betrieb nicht nötig.

## Zustandsmodell

Pro Compile wird ein neuer Worker und damit eine neue Kotlite-Sitzung gestartet. Innerhalb einer Sitzung bleibt ein `Interpreter` bestehen. Projektdateien werden gemeinsam analysiert; beim Laden werden nur neue Klassen- und Funktionsdefinitionen ausgewertet. Eine neue Codepad-Eingabe wird gegen den bisherigen Quelltext analysiert, aber nur ihr neuer AST-Teil ausgeführt. Dadurch werden frühere Konstruktoren und Seiteneffekte nicht wiederholt.

Objekte bleiben echte Kotlite-Instanzen. Die Objektbank speichert nur zusätzliche Handles auf dieselben Instanzen. Bench-Namen werden als Kotlin-Bindings in derselben Sitzung angelegt, sodass Codepad, Objektbank und spätere Host-Aufrufe dieselbe Objektidentität und denselben Feldzustand sehen. `Stop`, `Reset` und `Compile` verwerfen Worker beziehungsweise Sitzung; verspätete Antworten alter Worker werden nicht weiterverwendet.

## Bedienung

`Compile` analysiert alle Kotlin-Dateien gemeinsam und aktualisiert die Klassenkarten. Über den Konstruktor-Dialog der Klassenkarten lassen sich Objekte erzeugen; Rechtsklick auf ein Objekt bietet Methoden, Inspektion und Entfernen. Codepad-Eingaben werden einzeln ausgeführt, und Variablen aus früheren Eingaben bleiben bis zum Reset verfügbar. Projektdateien und Medien werden lokal geöffnet, gespeichert und eingebettet.

## Tests

Die Tests umfassen außerdem `init`-Blöcke ohne Wiederholung sowie Safe-Call/Elvis-Ausdrücke mit nullbaren und später gesetzten Werten.

```sh
npm run browser-smoke
```

Der Smoke-Test prüft getrennte Sitzungsaktionen, Objekt-Handles, Alias-Identität, getrennte Instanzen, Vererbung, dynamischen Dispatch, Host-Aufrufe und die Ablehnung einer `val`-Neuzuweisung. Zusätzlich wurde die Produktionsanwendung über einen ausschließlich statischen Server in der Browser-GUI kompiliert und mit getrennten Codepad-Eingaben ausgeführt.

## Bewusste Grenzen dieses Architekturversuchs

Die Klassenkarten-Metadaten werden aus dem von Kotlite erzeugten AST-Manifest gewonnen; der TypeScript-Adapter ergänzt nur geerbte Mitglieder und Top-Level-Funktionskarten für die vorhandene GUI. `readln`, `readlnOrNull` und `readLine` werden im lokalen Adapter mit einer eindeutigen Fehlermeldung abgewiesen, da der synchrone Eingabepfad noch nicht angeschlossen ist. BluePlay ist für eine erste browserlokale Welt mit `World`, `Actor`, `act`, `show`, `start`, `stop`, `step`, Geschwindigkeit, Tastaturzustand, Klickabfragen, `setBackground`, `showText`, `getObjectsAt` sowie grundlegenden Actor-Zugriffen (`getX`, `getY`, `setLocation`, `getRotation`, `setRotation`, `move`, `turn`) angeschlossen. Das Beispiel ist über `?example=blueplay` ladbar; die vollständige BluePlay-API ist noch nicht portiert.

Kotlites dokumentierte Sprachgrenzen gelten weiterhin, unter anderem bei Teilen von Sichtbarkeiten, Packages/Imports, sekundären Konstruktoren und Teilen der Standardbibliothek. Einfache benutzerdefinierte Getter und Setter für Klassen-Properties werden vom eingebundenen Interpreter unterstützt; Property-Typ und ein separates Speicherfeld sind dafür erforderlich. In BlueK ist dafür ein gepinnter Quellstand des eigenen Kotlite-Forks eingebunden; der Patch hält eingebaute Erweiterungsfunktionen auch nach mehreren Analyseläufen einer dauerhaften Sitzung auflösbar und erlaubt dem Objektinspektor den passiven Zugriff auf Setter-Backing-Felder. Grundlegende Listenoperationen wie Indexzugriff, `size`, `count { ... }` und `MutableList.add` sind damit inkrementell nutzbar; der parameterlose Aufruf `count()` ist in der aktuellen Kotlite-Stdlib noch nicht vorhanden. Die erste BluePlay-API umfasst zusätzlich `turnTowards(x, y)` und `distanceTo(actor)`; die Berechnung erfolgt lokal über die Browser-Bridge. `Image` unterstützt lokale Zeichenoperationen (`setColor`, `fill`, `fillRect`, `drawRect`, `fillOval`, `drawOval`, `drawLine`, `drawString`, `drawImage`, `clear`) sowie Transparenz; diese werden als Stage-Daten im Browser gerendert. Nicht unterstützter oder fehlerhafter Code wird lokal als Fehler zurückgegeben und nicht an einen Backend-Fallback weitergereicht.

Die Untersuchung zeigt, dass Kotlite als Grundlage für die lokale OOP-Ausführung und eine dauerhafte Codepad-/Objektbank-Sitzung taugt. Bei überschriebenen BluePlay-Methoden müssen geerbte Methoden im aktuellen Kotlite-Stand explizit über `this.` angesprochen werden; die BluePlay-Beispiele berücksichtigen diese Einschränkung. Die BluePlay-Integration ist ein bewusst kleiner erster Browserdurchstich und noch keine vollständige Funktionsparität.
