# BlueK – Entwicklungsstand

Diese Datei dient als kurze Übergabenotiz für die Weiterarbeit an BlueK.

## Aktueller Arbeitsstand

- Aktiver Entwicklungszweig: `kotlin-js-blueplay-runtime`
- BlueK ist eine BlueJ-nahe Kotlin-Lernumgebung im Browser.
- Im normalen Betrieb werden Schülerprogramme lokal im Browser-Worker ausgeführt.
- Der Server übernimmt Kompilierung, Codeanalyse und die Auslieferung der kompilierten Module.
- Die JVM-Ausführung ist nur noch für ausdrücklich markierte Legacy-Regressionsläufe vorgesehen.
- BluePlay-Projekte und gewöhnliche Kotlin-OOP-Projekte gehören zum selben Projektmodell.
- BluePlay stellt browserfähige Laufzeitklassen und eine lokale Darstellung der Welt bereit; Schülerklassen bleiben gewöhnlicher Kotlin-Code.

## Start und Prüfungen

```sh
npm install
npm start
```

Die Anwendung ist anschließend unter [http://localhost:5173](http://localhost:5173) erreichbar.

Wichtige Prüfungen:

```sh
npm run browser-smoke
npx vite build --config frontend/vite.config.ts
```

`npm run smoke` ist der JVM-Referenz- bzw. Legacy-Regressionslauf und nicht der normale Browserbetrieb. Bei parallelen lokalen Instanzen kann beispielsweise `BLUEK_PORT=5175 npm start` verwendet werden.

## Bereits vorhandene Funktionen

- BlueJ-ähnliche Klassen- und Funktionskarten mit gespeicherten Positionen.
- Schraffierte Karten für nicht kompilierte Klassen und Funktionen.
- Objektbank mit persistenten Objekt-Handles innerhalb einer Runtime-Generation.
- Konstruktor- und Methodenaufrufe mit Kotlin-Syntax, einschließlich parameterloser Aufrufe.
- BlueJ-ähnliches Codepad mit einer Eingabezeile, Enter-Ausführung und Eingabe-History über Pfeil hoch/runter.
- Rückgabewerte werden mit Kotlin-Typnotation angezeigt, `Unit` wird nicht als Ergebnis ausgegeben.
- Codepad-Variablen und Bench-Objekte können in späteren Eingaben wiederverwendet werden.
- Reset leert die aktuelle Runtime, Objektbank und sichtbare Codepad-Historie, behält aber die History zum erneuten Eingeben.
- BluePlay-Welt mit lokaler Darstellung, Actor-Objekten, Maus-/Tastaturereignissen und separatem verschiebbarem Weltfenster.
- Oberer Arbeitsbereich, Objektbank und Codepad besitzen verstellbare Bereiche sowie Ein-/Ausklappfunktionen.
- Der Browserbetrieb verwendet nicht den früheren JVM-Bild- bzw. Snapshot-Transport als Ausführungsweg.

## Bekannte offene Punkte

- Nicht jedes reale Schülerprojekt und nicht jede BluePlay-Variante ist vollständig im Browser geprüft.
- Die Metadatenanalyse ist keine vollständige Kotlin-PSI- oder `kotlin-reflect`-Analyse; komplexe Konstrukte können deshalb in Kontextmenüs fehlen.
- Vollständige Kotlin-Compilerdiagnosen und Codepad-Fallbacks bleiben der maßgebliche Weg für nicht vorbereitete Ausdrücke.
- Der vollständige JVM-Smoke-Test wurde zuletzt nicht in jedem Lauf bis zum abschließenden Erfolgssignal durchgeführt; Testserver und Ports müssen bei erneuten Läufen sauber beendet werden.
- Weitere visuelle Prüfungen im eingebauten Browser sind insbesondere für große BluePlay-Projekte, schnelle Eingaben und verschiedene Fenstergrößen sinnvoll.

## Arbeitsweise für den nächsten Chat

Der übergeordnete Umbauauftrag gilt nicht als autonom weiterzuverfolgendes Ziel. Neue Änderungen sollen sich an den jeweils konkret gemeldeten Problemen orientieren. Bei relevanten Änderungen sind Zwischen-Commits sinnvoll; vor Änderungen sollten Branch und Arbeitsbaum geprüft werden.

Die ausführlichere Beschreibung von Bedienung, Architektur, Beispielen und bisherigen Nachweisen steht in [README.md](README.md).
