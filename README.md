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

- `frontend/src/main.tsx` enthält die bestehende GUI.
- `frontend/src/localRuntimeClient.ts` erhält den Runtime-Vertrag als lokalen Adapter.
- `frontend/src/localRuntimeWorker.ts` lädt ausschließlich das statische Kotlite-Asset und verwaltet Worker-Nachrichten.
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

```sh
npm run browser-smoke
```

Der Smoke-Test prüft getrennte Sitzungsaktionen, Objekt-Handles, Alias-Identität, getrennte Instanzen, Vererbung, dynamischen Dispatch, Host-Aufrufe und die Ablehnung einer `val`-Neuzuweisung. Zusätzlich wurde die Produktionsanwendung über einen ausschließlich statischen Server in der Browser-GUI kompiliert und mit getrennten Codepad-Eingaben ausgeführt.

## Bewusste Grenzen dieses Architekturversuchs

Die Klassenkarten-Metadaten werden derzeit aus den Projektdateien für die vorhandene GUI abgeleitet; Kotlites AST-/Semantikanalyse ist die autoritative Ausführungsprüfung. Die Konsoleneingabe (`readln`) ist im lokalen Adapter noch nicht verfügbar. BluePlay ist für eine erste browserlokale Welt mit `World`, `Actor`, `act`, `show`, `start`, `stop`, `step`, Geschwindigkeit und Tastaturzustand angeschlossen. Das Beispiel ist über `?example=blueplay` ladbar; Medien und die vollständige BluePlay-API sind noch nicht portiert.

Kotlites dokumentierte Sprachgrenzen gelten weiterhin, unter anderem bei Teilen von Sichtbarkeiten, Packages/Imports, sekundären Konstruktoren und Teilen der Standardbibliothek. Einfache benutzerdefinierte Getter und Setter für Klassen-Properties werden vom eingebundenen Interpreter unterstützt; Property-Typ und ein separates Speicherfeld sind dafür erforderlich. Nicht unterstützter oder fehlerhafter Code wird lokal als Fehler zurückgegeben und nicht an einen Backend-Fallback weitergereicht.

Die Untersuchung zeigt, dass Kotlite als Grundlage für die lokale OOP-Ausführung und eine dauerhafte Codepad-/Objektbank-Sitzung taugt. Die Klassenkartenanalyse ist noch ein GUI-seitiger Adapter; die BluePlay-Integration ist ein bewusst kleiner erster Browserdurchstich und noch keine vollständige Funktionsparität.
