# BlueK Regressionen und offene GUI-Punkte

Diese Liste wird bei jeder Änderung an einem erfassten Verhalten mitgepflegt.
Eine Nutzerbestätigung ersetzt keinen automatisierten Test. Ein Hilfsfunktionstest
belegt noch kein sichtbares GUI-Verhalten. Fehlgeschlagene oder nicht ausgeführte
Prüfungen bleiben ausdrücklich offen. BluePlay-Laufzeitfunktionen sind derzeit
nicht im Fokus; die Projektauswahl bleibt enthalten.

## Durchführung

- `npm run test:regression`: Typecheck, UI-Hilfsfunktionen, echte Laufzeit und GUI.
- `npm run test:gui`: isolierter Chromium-Browser mit eigenem Vite-Testserver.
- Einmalig nach `npm ci`: `npx playwright install chromium`.
- `npm run build:svelte`: Produktionsbuild separat prüfen.
- GUI-Bericht: `playwright-report/`; Fehlerbilder und Traces: `test-results/`.
- Nach Kotlin-Änderungen zuerst `npm run build:kotlite`; Tests verwenden das
  gebaute Bundle unter `frontend/public/kotlite/`.
- Neue Fehler erhalten eine ID und möglichst einen reproduzierbaren Test, bevor
  sie korrigiert werden. Bei Änderungen betroffene Nachbarabläufe mitprüfen.
- Keine Tests als bestanden markieren, die nur geschrieben, aber nicht ausgeführt wurden.

## Checkliste

| ID | Erwartetes Verhalten / Reproduktion | Bisheriger Nachweis | Automatisierung / offen |
| --- | --- | --- | --- |
| GUI-01 | New Project: vier Vorlagen wählbar, separate Hilfe, Cancel schließt | GUI grün: alle Vorlagen erzeugt, Cancel | Visuelle Abnahme und Hilfe-Interaktion offen |
| GUI-02 | Neue Instanz heißt standardmäßig hund1, danach hund2 | GUI grün: beide Konstruktor-Dialoge und Bench | Abgesichert |
| GUI-03 | Computed Property zeigt im Inspektor den Wert | Nutzerbestätigung + GUI grün mit echtem Getter | Abgesichert |
| GUI-04 | Nach jeder Änderung im Inspektor sofort aktueller Getter-Wert, keine Änderung Verzögerung | GUI grün: 1 → 2 → 3 → 7, zusätzlich Änderung über Codepad auf 9 | Abgesichert |
| GUI-05 | Codepad: Enter, danach Pfeil hoch wiederholt Eingabe; auch nach Terminalausgabe | GUI grün: Fokus und History nach Ausdruck und println | Abgesichert für diese Abläufe |
| GUI-06 | Terminal-Splitter reicht über gesamte Höhe; Ziehen verändert beide Bereiche korrekt | GUI grün: Höhe und Breiten beider Bereiche | Abgesichert bei 1440 × 1000 |
| GUI-07 | Alle Kotlin-Werte im Codepad haben bedienbaren roten Kasten und können auf die Bench | GUI grün: Int, String, eigene Klasse; Werte und Alias sichtbar | Weitere Typen noch ausbauen |
| GUI-08 | Editor ohne übergroßen Leerraum unter Close | GUI grün: Abstand unter Close < 50 px | Visuelle Abnahme offen |
| GUI-09 | Bench/Codepad-Splitter springt beim ersten Ziehen nicht | Nutzerbestätigung + GUI grün für ersten und zweiten Drag | Abgesichert bei 1440 × 1000 |
| GUI-10 | Klasse umbenennen benennt Datei um, auch nach vorübergehend leerem Editor | GUI grün: Hund → Tier → leer → Katze; danach instanziiert | Abgesichert für Ersetzen des Editorinhalts |
| GUI-11 | Codepad ohne manuellen Compile: Ausdruck im leeren Projekt und mit Klassen ausführen | GUI grün mit echtem Worker | Abgesichert |
| GUI-12 | Terminal zeigt Eingabe blau zwischen vorheriger und nachfolgender Ausgabe | GUI grün: A, Eingabe, B, Ausgabe; Echo-Klasse vorhanden | Exakte Farbe noch visuell prüfen |
| GUI-13 | Clear leert alle Terminalinhalte, App bleibt sichtbar; spätere Ausgabe funktioniert | GUI grün: Clear und Form Feed, danach neue Ausgabe | Abgesichert |
| GUI-14 | Print/println wird während laufender Schleife sichtbar | GUI grün: Ausgabe vor Schleifenende, danach Reset | Laufzeit prüft zusätzlich Einzelereignisse |
| GUI-15 | Keine EOF/Stop/Close-Leiste oder Hinweiszeile; aktives Eingabefeld farblich erkennbar | GUI grün: Eingabe aktiv/inaktiv, keine Hinweiszeile | Visuelle Details noch offen |
| GUI-16 | Add Media deaktiviert mit Tooltip | GUI grün | Abgesichert |
| GUI-17 | Vorlagen erscheinen untereinander; Escape bricht Projekt-, Konstruktor- und Methodendialoge ab | GUI grün: 17/17 Chromium-Tests | Weitere visuelle Abnahmen offen |
| RT-01 | Identität, Getter/Setter, Main, Reset, Input, veraltete Worker-Antworten bleiben korrekt | Bestehende Integrationstests | `test:runtime-state` |
| ARCH-01 | Inspektoransicht verändert keine Laufzeitdaten und ruft beim Rendern keine Getter auf | Modelltest grün | `test:inspector` |
| ARCH-02 | Parallele Getter-Refreshes nicht doppelt ausführen; alte Ergebnisse nach Reset/Schließen verwerfen | Modelltest grün | `test:inspector` |
| ARCH-03 | Fenster besitzen nur ID/Position, Feldwerte stammen aus Laufzeit plus typisiertem Getter-Modell | Refactoring umgesetzt, 16 GUI-Tests grün | Entwurf: `docs/architecture.md` |
| ARCH-04 | Projektdateien werden typisiert validiert und ohne Verlust von Dateien, Ressourcen oder Kartenpositionen importiert/exportiert | `test:project-format` grün; GUI 16/16 grün | Weitere historische Dateiformate nicht eingeführt |
| ARCH-05 | Codepad kompiliert bei Bedarf, führt nur nach erfolgreichem Compile aus und verwirft alte Generationen | `test:codepad-flow` grün; GUI 16/16 grün | Methodenaufrufe und BluePlay bewusst nicht Teil dieses Schritts |

## Letzter Prüflauf

2026-09-15: Nach dem Inspektor-Refactoring alle 16 GUI-Tests gemeinsam bestanden.
Neue Modelltests prüfen insbesondere Reset/Schließen während Getter-Aufrufen.
Typecheck (0 Fehler,
0 Warnungen), UI-Hilfsfunktionen, Runtime-Integration und Svelte-Produktionsbuild
ebenfalls erfolgreich. Chromium, 1440 × 1000, vorhandenes Kotlin-Bundle.

Dabei korrigiert: Codepad zeigte für Int/String mit Objekt-Handle nur `<object>`.
Es zeigt jetzt wieder den Wert samt Typ im bedienbaren Ergebnis-Button.
Die Suite prüft das auch nach Bindung an einen Bench-Namen.

2026-09-15: Projektformat und Compile-/Codepad-Ablauf schrittweise aus
`SvelteApp.svelte` ausgelagert. `test:project-format` und `test:codepad-flow`
prüfen Roundtrip/Validierung sowie Compile-on-demand und Generationsschutz.
Typecheck, UI-Helfer, Runtime-Integration, Inspector-Modell, Svelte-Build und
16 GUI-Tests erfolgreich. Der Entwicklungsserver lief auf
`http://127.0.0.1:5184`; Playwright verwendete den separaten Testserver auf
Port 5194.

2026-09-15: Vorlagenraster auf eine Spalte geändert und zentraler Escape-Abbruch
für relevante Fenster ergänzt. GUI-Suite erfolgreich mit 17/17 Chromium-Tests;
Typecheck und Svelte-Build erfolgreich.

Offen bleiben die explizit genannten visuellen Abnahmen, weitere Datentypen,
Viewportgrößen und Browser. Die Liste bedeutet keine vollständige Feature-Parität.
