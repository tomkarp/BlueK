# BlueK Regressionen und offene GUI-Punkte

Diese Liste wird bei jeder Änderung an einem erfassten Verhalten mitgepflegt.
Eine Nutzerbestätigung ersetzt keinen automatisierten Test. Ein Hilfsfunktionstest
belegt noch kein sichtbares GUI-Verhalten. Fehlgeschlagene oder nicht ausgeführte
Prüfungen bleiben ausdrücklich offen. BluePlay wird über eine versionierte
Built-in-Library geladen; die sichtbare Canvas-Abnahme bleibt von den
Worker-/Runtime-Smokes getrennt.

## Durchführung

- `npm run test:regression`: Typecheck, UI-Hilfsfunktionen, echte Laufzeit und GUI.
- `npm run test:gui`: isolierter Chromium-Browser mit eigenem Vite-Testserver.
- Einmalig nach `npm ci`: `npx playwright install chromium`.
- `npm run build:svelte`: Produktionsbuild separat prüfen.
- GUI-Bericht: `playwright-report/`; Fehlerbilder und Traces: `test-results/`.
- Nach Kotlin-Änderungen zuerst `npm run build:kotlite`; Tests verwenden das
  gebaute Bundle unter `frontend/public/kotlite/`.
- Für die allgemeine Generics-/Reified-Schnittstelle `npm run test:generics`
  gegen dieses Bundle ausführen.
- Neue Fehler erhalten eine ID und möglichst einen reproduzierbaren Test, bevor
  sie korrigiert werden. Bei Änderungen betroffene Nachbarabläufe mitprüfen.
- Keine Tests als bestanden markieren, die nur geschrieben, aber nicht ausgeführt wurden.
- Alle Testbefehle im Überblick: `DEVELOPMENT.md`.

## Checkliste

GUI-74 und GUI-80 sind historisch doppelt vergeben (je zwei Verhalten, auch in
den Testtiteln von `tests/gui/regressions.spec.ts`). Die IDs bleiben stabil;
bei Verweisen die Beschreibung mitnennen.

| ID | Erwartetes Verhalten / Reproduktion | Bisheriger Nachweis | Automatisierung / offen |
| --- | --- | --- | --- |
| GUI-01 | New Project: Empty Project, BluePlay Template, BluePlay Example, BlueK Demo Project und Space Invaders Demo erscheinen in dieser Reihenfolge; die letzten beiden sind mit sichtbarem Abstand von den ersten drei abgesetzt und tragen den Hinweis, dass sie aktuell nur zum Testen und Demonstrieren von BlueK dienen und langfristig entfernt werden; Empty Project hat auch nach dem Ersetzen eines BluePlay Templates keine Library-Klassen oder README-Karte; in Space Invaders verwaltet jedes Objekt sein Verhalten selbst (Defender schießt, Laser trifft/verschwindet, Invader bewegen sich einzeln) | Echter Chromium-Lauf prüft alle fünf Vorlagen, den größeren Abstand vor der zweiten Gruppe und den Hinweistext; `test:blueplay-demos` prüft Welt, Invader, Defender, Laser über dem Defender, Treffer, Entfernen am Weltrand, einzeln umkehrende Invader und beliebige Dateireihenfolge; eingebauter Browser: Spiel läuft sichtbar mit Schüssen und Treffern | GUI-01/GUI-66 Chromium 7/7 grün; Typecheck 0 Fehler, 5 Svelte-Warnungen; laufendes Canvas-Spiel noch visuell abnehmen |
| GUI-02 | Auch ein parameterloser Konstruktor öffnet den Create-Dialog, schlägt hund1 bzw. hund2 vor und erstellt erst nach Bestätigung die Instanz | GUI-Test aktualisiert: beide parameterlosen Konstruktor-Dialoge, Namensvorschläge und Bench | Abgesichert |
| GUI-03 | Computed Property zeigt im Inspektor den Wert | Nutzerbestätigung + GUI grün mit echtem Getter | Abgesichert |
| GUI-04 | Nach jeder Änderung im Inspektor sofort aktueller Getter-Wert, keine Änderung Verzögerung | GUI grün: 1 → 2 → 3 → 7, zusätzlich Änderung über Codepad auf 9 | Abgesichert |
| GUI-05 | Codepad: Enter, danach Pfeil hoch wiederholt Eingabe; auch nach Terminalausgabe | GUI grün: Fokus und History nach Ausdruck und println | Abgesichert für diese Abläufe |
| GUI-06 | Terminal-Splitter reicht über gesamte Höhe; Ziehen verändert beide Bereiche korrekt; das Split-Symbol ist abgerundet, genauso groß wie das Maximieren-Symbol und behält den Mittelstrich | Chromium-GUI-Test GUI-06 (Symbolmaß und -geometrie, Höhe und Breiten beider Bereiche) | Abgesichert bei 1440 × 1000 |
| GUI-07 | Alle Kotlin-Werte im Codepad haben bedienbaren roten Kasten und können auf die Bench | GUI grün: Int, String, eigene Klasse; Werte und Alias sichtbar | Weitere Typen noch ausbauen |
| GUI-08 | Editor öffnet fokussiert; der Close-Button gehört zur gemeinsamen Fenster-Titelleiste | Chromium-Test prüft Fokus, Umbenennung nach leerem Inhalt und sichtbaren Close-Button | Abgesichert |
| GUI-09 | Bench/Codepad-Splitter springt beim ersten Ziehen nicht | Nutzerbestätigung + GUI grün für ersten und zweiten Drag | Abgesichert bei 1440 × 1000 |
| GUI-10 | Klasse umbenennen benennt Datei um, auch nach vorübergehend leerem Editor | GUI grün: Hund → Tier → leer → Katze; danach instanziiert | Abgesichert für Ersetzen des Editorinhalts |
| GUI-11 | Codepad ohne manuellen Compile: Ausdruck im leeren Projekt und mit Klassen ausführen | GUI grün mit echtem Worker | Abgesichert |
| GUI-12 | Terminal zeigt Eingabe blau zwischen vorheriger und nachfolgender Ausgabe | GUI grün: A, Eingabe, B, Ausgabe; Echo-Klasse vorhanden | Exakte Farbe noch visuell prüfen |
| GUI-13 | Clear leert alle Terminalinhalte sofort, auch im geteilten Terminal; App bleibt sichtbar; spätere Ausgabe funktioniert | GUI grün: Clear im Split-Terminal, Form Feed, danach neue Ausgabe | Abgesichert |
| GUI-14 | Print/println wird während laufender Schleife sichtbar | GUI grün: Ausgabe vor Schleifenende, danach Reset. 2026-10-02 nach der Interpreter-Beschleunigung rot (Timeout beim Reset-Klick: jede einzelne Ausgabe baute das bis 1 MB große Terminal neu auf); seither fassen IDE und Player Ausgaben je Animation-Frame zusammen, danach grün. `test:ui` prüft, dass die Zusammenfassung dieselbe Ausgabe ergibt | Laufzeit prüft zusätzlich Einzelereignisse |
| GUI-15 | Keine EOF/Stop/Close-Leiste oder Hinweiszeile; aktives Eingabefeld farblich erkennbar | GUI grün: Eingabe aktiv/inaktiv, keine Hinweiszeile | Visuelle Details noch offen |
| GUI-16 | Entfallen: Der Files-Button mit Hinweis-Popup wurde durch GUI-79 entfernt (fb0666c) | Chromium-Test GUI-16 durch GUI-79 ersetzt, der das Fehlen des Buttons prüft | Durch GUI-79 abgelöst |
| GUI-17 | Vorlagen erscheinen untereinander; Escape bricht Projekt-, Konstruktor- und Methodendialoge ab; Eingabefokus startet sinnvoll | GUI grün: 17/17 Chromium-Tests | Weitere visuelle Abnahmen offen |
| GUI-18 | Primitive Inspektoren zeigen ihren Typ, bleiben feldlos und kompakt durch schlankere Innenabstände; Schriftgrößen bleiben unverändert; Hand-Cursor zeigt verschiebbare Flächen; Escape schließt den aktiven Inspector | GUI-03/04, GUI-18 und GUI-48 im Chromium 3/3 grün; GUI-03 prüft 390-px-Breite, 16-px-Schrift, konstante Spalten, gekürzten langen Wert neben dem Stift und volle Eingabebreite im Edit-Modus; beide Zustände im Chromium-Screenshot geprüft; Typecheck 0 Fehler/0 Warnungen. 2026-09-25: Regression durch c146fb1 (primitive Werte öffneten keinen Inspektor mehr) behoben, GUI-18 wieder grün, siehe Prüflauf unten | Automatisiert abgesichert; Nutzerabnahme der Optik offen |
| GUI-19 | Codepad-Eingaben und Ergebnisse stehen mit kompaktem vertikalem Abstand wie im BlueJ-Stil | GUI-Test grün | Visuelle Abnahme offen |
| GUI-20 | Lange Codepad-Werte werden per CSS dynamisch einzeilig gekürzt, behalten den Typ sichtbar und zeigen den vollständigen Wert per Hover | GUI-Test grün | Visuelle Abnahme offen |
| GUI-21 | Dasselbe Codepad-Objekt kann unter mehreren Referenznamen auf der Objektbank abgelegt werden; der gemeinsame Inspector zeigt den jeweils aufgerufenen Referenznamen | GUI-Test grün | Visuelle Abnahme offen |
| GUI-22 | Obere Aktionen sind zu New Project, Open / Import und Save / Export gebündelt (Files entfällt seit GUI-79); Open nutzt ein Drop-Feld, dessen Dateiauswahl nur JSON anbietet (vom Nutzer bestätigt, 08963a8), Save das New-Project-Layout und alle schalten gemeinsam auf Icon-only um | Chromium-Test GUI-22: drei Aktionen, Drop-Feld „JSON“/„Accepted: .json“, `accept` nur JSON, keine Ordnerwahl | Visuelle Abnahme offen |
| GUI-23 | Save / Export ist bei leerem Projekt bereits auf der Hauptleiste deaktiviert | GUI-Test grün | Abgesichert |
| RT-01 | Identität, Getter/Setter, Main, Reset, Input, veraltete Worker-Antworten bleiben korrekt | Bestehende Integrationstests | `test:runtime-state` |
| GUI-24 | Direkte Anweisungen in Projektdateien ergeben vor jeder Ausgabe einen Compilerfehler mit Dateiposition; auch Codepad kann den fehlgeschlagenen Compile nicht umgehen; direkte Codepad-Anweisungen bleiben erlaubt | GUI grün: echter Worker, Fehlerdialog mit Actions.kt/Zeile/Spalte, keine Terminalausgabe, Codepad nach Projektwechsel | Abgesichert in Chromium |
| GUI-25 | CodeMirror zeigt keine automatische Codevervollständigung und verwendet vier Leerzeichen für manuelle Einrückung; normale Editorfunktionen und Klammerergänzung bleiben erhalten | Chromium-Tests grün: 2/2; Typecheck grün | Abgesichert |
| GUI-26 | Cmd/Ctrl-Shift-I formatiert die komplette Kotlin-Datei mit dem lokal gebündelten ktfmt-WASM-Formatter im Hauptthread; komprimierte WASM-Auslieferung wird korrekt behandelt; normale Tab-/Shift-Tab-Einrückung bleibt separat | Chromium-Test grün: 2/2 für Ctrl und Cmd; Typecheck und Produktionsbuild grün | Abgesichert |
| GUI-27 | Kotlin-Editor ist als benannter modeless Dialog ausgezeichnet; sein Codebereich ist eine benannte Gruppe. Er bietet Maximieren, Schließen per `×` und einen Formatier-Button unten rechts mit Shortcut-Hinweis. Die Terminal-Ebene ist präsentational ausgezeichnet | Chromium-Test prüft ARIA-Rollen/Namen für Editor, Codebereich und Terminal-Ebene sowie Formatieren, Maximieren und Schließen | Abgesichert |
| GUI-28 | Kotlin-Editor lässt sich wie das Terminal verschieben und an allen Seiten/Ecken in der Größe verändern; Codepad bleibt dabei sichtbar | Chromium-Test für Verschieben und Resize ergänzt | Abgesichert |
| GUI-29 | Kotlin-Editor verwendet die Terminal-Fensteroptik, zeigt Verschiebe-Cursor und hat keinen unnötigen Leerraum unter dem Editor | Chromium-Test für Stil, Cursor und unteren Abstand ergänzt | Abgesichert |
| GUI-30 | Editor und Terminal sind nicht modal; das zuletzt angeklickte Fenster liegt jeweils oben | Chromium-Test für Fensterfokus und aktiven Z-Index ergänzt | Abgesichert |
| GUI-31 | Die erste Datei öffnet ein Editorfenster; jede weitere Datei öffnet standardmäßig als Tab im selben Editorfenster und wird aktiv | Chromium-Test prüft Standard-Tabmodus, beide Tabs und den Inhalt der zuletzt geöffneten Datei; 1/1 grün | Abgesichert |
| GUI-32 | Editor und Terminal verwenden identische Fenster-Buttons (Maximieren als abgerundetes SVG-Symbol wie in GUI-06, Schließen als `×`), gemeinsame Mindestgrößen und vollständig nutzbare Rahmenbereiche für Resize | Chromium-Test für Icons, 24-Pixel-Rahmenbereiche und Mindestgrößen; Maximieren-Prüfung von `□` auf SVG-Symbol und zugänglichen Namen umgestellt | Abgesichert |
| GUI-33 | Standardmäßig geöffnete Editor-Tabs lassen sich in einzelne Fenster zerlegen und wieder sammeln; aktive Tab-Markierung, vertikaler Header-Abstand, Tabwechsel, Tab-Schließen und Gruppenschließen funktionieren | Chromium-Test für Standard-Tabs, aktive Markierung, Tabwechsel/-Schließen, Aufteilen und erneutes Sammeln; 1/1 grün | Abgesichert |
| GUI-34 | Eine fehlgeschlagene Formatierung zeigt einen schließbaren Fehler ohne unnötigen Formatter-Paketpräfix; ein neuer Formatierungsversuch entfernt die alte Meldung vor dem erneuten Ergebnis | Chromium-Test für Fehler, Schließen und erneuten Versuch grün | Abgesichert |
| GUI-36 | Terminal-Splitter bleibt auf der Trennlinie zwischen BlueK und Terminal zentriert und verändert beim Ziehen beide Bereiche | Chromium-Test erweitert: Griffposition und Breitenänderung grün | Abgesichert |
| GUI-37 | Der Terminal-Splitter wird bei geöffnetem Editorfenster nicht über den Editorinhalt gezeichnet | Chromium-Test für aktives Editorfenster grün | Abgesichert |
| GUI-38 | Die Kotlin-Schrift im Editor ist auf 16 px eingestellt | GUI-Test grün | Abgesichert |
| GUI-39 | Die Editor-Schriftgröße lässt sich über Settings oben rechts (Bereich Editor, Feld „Font size“, siehe GUI-74) von 10 px bis 30 px einstellen und wirkt sofort auf Code und Zeilennummern | GUI-Test erweitert und grün; Feldname nach GUI-74 angepasst | Abgesichert |
| GUI-40 | Settings und New File liegen beim Öffnen über Editoren, Terminal und Objektinspektoren; der Dialog bietet zusätzlich Kotlin Functions an | Chromium-Test grün: Settings/New File, Kotlin-Functions-Option und kein New-Functions-Button | Abgesichert |
| GUI-41 | New Project, Open / Import und Save / Export liegen beim Öffnen über Editoren, Terminal und Objektinspektoren (Files entfällt seit GUI-79) | Chromium-Test GUI-41 ohne Files grün | Abgesichert |
| GUI-42 | Ohne Vim schließt Escape den Editor sofort. Mit Vim gehört ein einfaches Escape ganz Vim (verlässt sofort den Insert-Modus, schließt aber nie das Editorfenster, egal wie oft/lang gedrückt); erst Shift+Escape schließt gezielt den aktiven Editor-Tab | Chromium-Tests prüfen sofortiges Schließen ohne Vim, Escape in Insert-/Normal-Mode und Shift+Escape für den aktiven Tab; 3/3 grün | — |
| GUI-43 | Nach dem Laden eines gespeicherten Projekts wird `/load/<code>` aus der URL entfernt; weitere Vorlagen funktionieren normal | GUI-Test grün | Abgesichert |
| GUI-44 | Open / Import kann einen dreiteiligen Wortcode eingeben und lädt das entsprechende gespeicherte Projekt | GUI-Test grün | Abgesichert |
| GUI-50 | Nach dem Laden eines vollständigen `#bluek=...`-Projektlinks wird der Link aus der URL entfernt; das geladene Projekt bleibt sichtbar | Chromium-GUI-Test grün | Abgesichert |
| GUI-45 | Nach einem Neustart ohne Projektlink wird der zuletzt bearbeitete Projektzustand aus dem Browser-Speicher wiederhergestellt | GUI-Test grün: Projekt laden, URL ohne Link öffnen, Klasse bleibt sichtbar | Abgesichert |
| GUI-46 | Method result trennt Methodenname, Rückgabewert und Aktionen sichtbar und ohne Überlappung | Produktionsbuild grün; visuelle Prüfung anhand des Fehlerbilds noch offen | GUI-Test offen |
| GUI-47 | Parameterlose Funktionen/Methoden und Aktivitätsanzeige; der erforderliche Create-Namensdialog wird von GUI-02 gemeinsam verwendet | Vollständiger Chromium-Lauf 2026-09-18: alle 7 GUI-47-Tests grün; der Test beobachtet nur unerwartete Parameterdialoge | Abgesichert |
| GUI-48 | Private Attribute werden im Objektinspektor durch eine klar graue Zeile und graue, weiterhin gut lesbare Schrift unterschieden; öffentlich lesbare Properties mit `private set` zeigen weiterhin ein moderat abgesetztes, deaktiviertes Stift-Symbol mit Tooltip | Chromium-Test prüft grauen Hintergrund und graue Schrift der privaten Zeile sowie Symbol, Sperrung, Tooltip, Klick und Doppelklick ohne Editierung; Metadaten-/Kotlite-Smoke und Typecheck | Nach aktuellem CSS-Check zu verifizieren |
| GUI-49 | Lange Methodennamen mit Parametern werden im Objekt-Kontextmenü nicht umgebrochen | Chromium-Test grün: Methodenschaltfläche verwendet `white-space: nowrap` und bleibt einzeilig | Abgesichert |
| GUI-35 | Save / Export kann einen befristeten Wort-Kurz-Link anfordern; die drei Wörter werden separat und der vollständige Link darunter in einem schließbaren Fenster angezeigt, der 30-Tage-Löschhinweis ist sichtbar, beide Darstellungen kopieren den Link per Klick und `/load/<code>` lädt ihn wieder | Chromium-Test mit gemockter Save-API grün; API-Roundtrip-Smoke-Test grün | Abgesichert |
| API-01 | Projekt-Kurz-Links werden ohne Benutzerkonto in SQLite gespeichert, nach 30 Tagen entfernt und mit genau drei Wörtern wieder ausgeliefert | `npm run test:share-server` grün | Abgesichert; Last-/Produktionsserver noch nicht geprüft |
| RT-02 | Alle Projektdateien werden vor Initialisierung auf Deklarationen geprüft; Syntax-/Analysefehler verhindern Seiteneffekte; gültige Initialisierer und Codepad-Anweisungen bleiben ausführbar | Laufzeittest grün: mehrere Dateien, Aufruf/Zuweisung/Schleife/if/Literal, Syntax-/Typfehler, Initialisierung mit Eingabe, alle drei mitgelieferten Vorlagen | `test:runtime-state` |
| RT-03 | BlueJ-Dateiformat: Eine Datei darf genau eine Klasse enthalten oder mehrere Top-Level-Funktionen/-Properties; eine Klasse mit `main` außerhalb bzw. mehrere Klassen in einer Datei wird abgelehnt | Laufzeittest grün: gemischte Klasse/Funktion und zwei Klassen mit Dateiposition; gültige Deklarationsdatei und Vorlagen bleiben geprüft | `test:runtime-state` |
| RT-04 | Kotlite unterstützt `Thread.sleep(Int/Long)`; Timer wartet ohne Blockieren, setzt danach fort und kann per Reset beendet werden | Node/VM-Smoke: vollständiger Timer inkl. Range/Zufall, Wiederholung, Int/Long/0, negatives Argument mit catch/printStackTrace/finally, Typprüfung, synchroner Aufruf ohne verwaiste Fortsetzung. Echte Chromium-Tests: Timer, bedienbare Settings während der Wartezeit, Reset ohne alte Ausgabe | Kotlite-Smoke und beide RT-04-Browsertests grün; Benutzerbestätigung noch offen |
| RT-05 | Kotlite unterstützt Kotlin-Property-Setter mit eigener Sichtbarkeit (`private set`); interne Schreibzugriffe funktionieren, externe Schreibzugriffe werden abgewiesen | Kotlite-Smoke-Test mit `Timer.min/max`, `private set`, `zeitspanne` und `setzeBereich`; zusätzlich bestehende Setter mit eigenem Body im Runtime-State-Test | Kotlite-Smoke und Runtime-State-Integration grün |
| RT-06 | BlueK stellt für Schülercode `BlueK.beep()` als eingebaute Host-Funktion bereit; der Aufruf erzeugt einen optionalen Sound-Effekt ohne die Programmausführung zu blockieren | Kotlite-Smoke-Test prüft den typisierten Sound-Effekt; Typecheck und Browser-UI-Prüfung | Implementierung in diesem Schritt; visuelle Tonprüfung geräteabhängig |
| RT-07 | Gemeinsamer Laufzeit-Namensraum; entfernte interaktive Namen sind wieder frei; Codepad-Aliase und indirekte Referenzen bleiben gültig; Objektbank-Ansichten folgen `var`; nicht mehr erreichbare alte Handles sind gesperrt | `test:references`: Timer-Fall inkl. unabhängigem `val a = 5`, Entfernen/Wiederverwenden, stabile Symbole/keine wiederholten Seiteneffekte, Konflikte, persistente Ansichten, Felder/Collections/Lambda-Captures/Iteratoren/Zyklen/Reset. `test:runtime-state`: echte Client-/Host-/Session-Snapshots. Drei echte Chromium-Tests in `references.spec.ts` | Gezielte Laufzeit-/Integrationstests und 3/3 Browsertests grün; Benutzerabnahme dieses Umbaus offen. Grenzen opaker Host-Datentypen siehe Architektur |
| RT-08 | Generische Klassen/Member, Collection-Varianz, reifizierte Host-Aufrufe, lexikalisch verschachtelte und zurückgegebene Closures behalten Typen und Objektidentität; ungültige reifizierte Aufrufe und erasure-widrige Typprüfungen scheitern bei der Analyse | `test:generics` gegen das frisch gebaute Bundle; `tests/gui/generics.spec.ts` für Projekt-/Codepad-/Worker-Strecke | Automatisierte Ergebnisse siehe Prüflauf 2026-09-18; keine Benutzerabnahme oder vollständige Kotlin-Konformitätszusage |
| RT-09 | Inline-Parameter, `noinline`, `crossinline`, lokale Labels und nichtlokale Returns; eindeutige Aufrufziele bei Rekursion/Suspendierung; `finally` läuft, `catch` fängt keine Returns | `smoke-generics-boundaries.mjs`: positive/negative Fälle, Parameterweitergabe, entkommende Closures, Standardbibliothek und `Thread.sleep`; Browserfall in `generics.spec.ts` | Automatisierte Ergebnisse siehe Prüflauf 2026-09-18. Nichtlokales `break`/`continue`, Code-Inlining, Inline-Properties und Reflection sind nicht Teil dieser Unterstützung |
| RT-10 | Explizite BluePlay-Library v1 nutzt native `World`/`Actor`/`Image`-Typen; `step`/`start`/`stop`/`reset`/Geschwindigkeit, Eingabe während des Laufs und Migration alter Framework-Dateien funktionieren | Native Browser-Smoke sowie `RuntimeHost`-/`LocalRuntimeClient`-Smoke mit studentischen Dateien und versioniertem Projektmarker | `test:runtime-state` und `smoke-blueplay-browser` grün; Performance-Messung offen |
| FMT-01 | Öffentliches Projekt-JSON enthält keine internen Datei-IDs oder Editor-Revisionen; `fileName` bleibt Pflichtfeld und `path` ist optional | Format-Smoke-Test prüft Export, Import, optionalen Pfad und Rückwärtskompatibilität alter Zusatzfelder | `test:project-format` |
| ARCH-01 | Inspektoransicht verändert keine Laufzeitdaten und ruft beim Rendern keine Getter auf | Modelltest grün | `test:inspector` |
| ARCH-02 | Parallele Getter-Refreshes nicht doppelt ausführen; alte Ergebnisse nach Reset/Schließen verwerfen | Modelltest grün | `test:inspector` |
| ARCH-03 | Fenster besitzen nur ID/Position, Feldwerte stammen aus Laufzeit plus typisiertem Getter-Modell | Refactoring umgesetzt, 16 GUI-Tests grün | Entwurf: `docs/architecture.md` |
| ARCH-04 | Projektdateien werden typisiert validiert und ohne Verlust von Dateien, Ressourcen oder Kartenpositionen importiert/exportiert | `test:project-format` grün; GUI 16/16 grün | Weitere historische Dateiformate nicht eingeführt |
| ARCH-05 | Codepad kompiliert bei Bedarf, führt nur nach erfolgreichem Compile aus und verwirft alte Generationen | `test:codepad-flow` grün; GUI 16/16 grün | Methodenaufrufe und BluePlay bewusst nicht Teil dieses Schritts |
| ARCH-06 | Library-Version, Ressourcen und Kartenpositionen bleiben im Projektmodell erhalten; der Worker bleibt Scheduler-Eigentümer und liefert typisierte Canvas-Frames | Projektformat-, Typecheck-, Runtime-State- und Browser-Smoke-Prüfungen; Architektur-Dokumentation aktualisiert | Browser-/Canvas-Sichtprüfung und Kartenpositions-Editor offen |
| ARCH-07 | Svelte-Fenster, Dialoge, Diagramm und Objektleiste/Codepad sind getrennte Komponenten mit typisierten Daten/Callbacks; Darstellung erzeugt keine Runtime-Zugänge. Editor-Lebenszyklus, Drag/Resize, Menüs und Browser-Dateiaktionen liegen in fachlichen Modulen | Architektur-Smoke prüft angeschlossene Komponenten; `test:window-interaction` prüft Geometrie/Pointer-Abbruch; vorhandene GUI-Tests prüfen das tatsächliche Verhalten über Komponentengrenzen | Erster Umbau: Regression-Sammellauf einschließlich 135/135 GUI-Tests grün; Agent-Sichtprüfung erfolgt, keine Benutzerabnahme. Zustandsbesitz inzwischen weiter aufgeteilt: ARCH-08 |
| ARCH-08 | Reaktive UI-Controller besitzen Projekt-, Editor-, Ausführungs-, Objekt-, BluePlay- und Terminalzustand; fremde Bereiche werden über schmale Aktionen angesprochen. Ein Runtime-Client in ExecutionWorkspace; Objektwerte bleiben abgeleitet, Aufrufentwürfe verlassen die UI als klonbare Arrays | `test:workspace` prüft echte Svelte-Module, Worker-Klonbarkeit, unabhängige App-Instanzen und Generationswechsel; Architektur-Smoke prüft einzigen Client und verbietet fremde Zustandsschreibzugriffe | Abschließender Regression-Sammellauf einschließlich 135/135 GUI-Tests grün; Typecheck 0 Fehler/0 Warnungen, Agent-Sichtprüfung erfolgt, keine Benutzerabnahme |
| GUI-51 | Eingebaute BluePlay-Karten sind von editierbaren Schülerdateien getrennt; API-Hilfe ist separat; die Welt wird als Canvas-2D-Frame mit Zellkoordinaten gerendert | `build:svelte`, typisierte Stage-Frames und native Smoke-Tests grün | Tatsächliche Chromium-Interaktion und visuelle Abnahme offen |
| GUI-52 | BluePlay-Welt ist ein gemeinsames Fenster mit zusammengehöriger Titelleiste, Canvas und Steuerleiste; Schließen entfernt das gesamte Fenster; Titelzeile lässt sich verschieben | Built-in-Browser: gemeinsamer Rahmen, Close, Drag und Maximize visuell geprüft | Chromium-Automatisierung ergänzt |
| GUI-53 | BluePlay-Canvas nimmt Welt- und Actor-Klicks an; bei Actors zählen unter Skalierung und Rotation nur sichtbare Pixel, nicht der transparente Bildhintergrund | Built-in-Browser: transparenter Pixel ergibt `false`, sichtbarer Pixel abseits der Mitte ergibt `true`; Chromium wiederholt beide echten Canvas-Klicks | Abgesichert |
| GUI-54 | Eine Welt ohne eigenes `background` wird als weiße Canvas ohne weißen Außenbereich direkt unter der Titelleiste dargestellt; der umgebende World-Body ist grau, eigene Welt-Hintergründe bleiben Zeicheninhalt der Welt | Chromium-GUI-Test prüft weiße Canvas, grauen World-Body und `padding: 0`; native Smoke deckt `Image`-/Hintergrund-Zeichenoperationen ab | Keine pixelgenaue visuelle Abnahme |
| GUI-55 | Eine kleine Welt (z. B. `100x100`) bleibt in ihrer echten Pixelgröße; reicht sie nicht bis zur Buttonleiste, zeigt der World-Body einen grauen Rand statt die Welt zu skalieren | Chromium-GUI-Test misst Canvas `100x100` und prüft den grauen Surround; eingebauter Browser visuell bestätigt | Abgesichert |
| GUI-56 | Das World-Fenster wächst bis knapp an die Browsergrenzen, damit eine große unvergrößerte Welt möglichst lange ohne Scrollen sichtbar bleibt | Chromium-GUI-Test misst eine `1000x100`-Canvas in Originalgröße und bestätigt, dass der World-Body noch nicht horizontal scrollt | Abgesichert |
| GUI-57 | Maximieren füllt den gesamten Browser-Viewport; die Welt bleibt dabei unskaliert, kleine Welten zeigen weiterhin den grauen Surround und das Spielfeld ist horizontal/vertikal symmetrisch zentriert | Chromium-GUI-Test prüft Fenster `0,0` bis `100vw,100vh`, unveränderte `100x100`-Canvas, grauen Body sowie gleiche linke/rechte und obere/untere Abstände | Abgesichert |
| GUI-58 | BluePlay-Bibliothekskarten (`BluePlayFunctions`, `World`, `Actor`, `Image`) erscheinen wie normale Karten ohne Built-in-Leiste, sind verschiebbar, bilden mit `Actor`-/`World`-Unterklassen die Vererbungspfeile und öffnen dateibezogene API-Hilfe; jede Karte und die zugehörigen Pfeile folgen beim Überlappen derselben Stapelordnung | Chromium-GUI-Test prüft normale Darstellung, Karten-Drag, zwei Pfeile (`Figure -> Actor`, `MyWorld -> World`), das Nach-vorne-Holen einer verschobenen Karte samt Vererbungspfeil, `World API` per Doppelklick und das eingeschränkte Actor-Kontextmenü | Abgesichert |
| GUI-59 | Neue Schülerklassen werden bei der Kartenpositionierung hinter den vier BluePlay-Bibliothekskarten berücksichtigt | Chromium-GUI-Test prüft die Position der ersten neu angelegten Klasse nach der Vorlagenreihenfolge | Mit GUI-76 und GUI-01 geprüft; fokussierter Vorlagenlauf 8/8 grün |
| RT-13 | Eine Klasse darf eine später deklarierte Klasse verwenden, auch wenn deren Oberklasse nullable Member späterer Klassen hat (z. B. Defender erzeugt Laser, Laser erbt `image: Image?`) | Ursache: der Analyse-Retry verschob die Klasse an den Skriptanfang vor ihre eigenen Abhängigkeiten; betraf auch das alte Bundle. Kotlite-Smoke mit reinem Kotlin und fehlender Klasse als Negativfall; Space-Invaders-Smoke lädt alphabetisch (Defender vor Laser) | Seit RT-40 (2026-09-26) ohne Retry: Kotlite deklariert alle Klassen vor der Analyse. Laden der Vorlage (Node, Median aus 10): Dateireihenfolge 165 ms, alphabetisch 167 ms (vorher 166 ms bzw. 573 ms) |
| RT-14 | `getIntersecting<T>()`, `getOneIntersecting<T>()`, `isTouching<T>()` und `removeTouching<T>()` funktionieren in Schüler-Actors | Ursache: implizites `intersects(it)` im Lambda der inline-Library-Funktion war zur Laufzeit nicht auflösbar (auch im alten Bundle). Native BluePlay-Smoke prüft Treffer, Anzahl, Entfernen und den Zustand danach | Abgesichert |
| GUI-60 | Ein BlueJ-Projekt als ZIP (auch mit umschließendem Ordner, `__MACOSX`, `.ctxt`) öffnet mit allen Kotlin-Klassen und den Kartenpositionen aus `package.bluej`; private Methoden erscheinen nicht im Objekt-Kontextmenü | Chromium-GUI-Test mit ZIP-Fixture, per Drop auf das Open/Import-Feld (die Dateiauswahl bietet nur JSON) (Karten, Codepad, Kontextmenü ohne `zieheKarte`); echte inf-schule-ZIPs Blackjack, Goldrausch, Ausgebüxt einmalig per Playwright geöffnet und ausgeführt | Abgesichert |
| GUI-61 | Ein BlueJ-BluePlay-Projekt nutzt die eingebaute Library: `World.kt`/`Actor.kt`/`Image.kt`/`BluePlayFunctions.kt` werden ersetzt, `images/`/`sounds/` werden Projektressourcen. Seit 08963a8 (vom Nutzer als beabsichtigt bestätigt) bietet der Open/Import-Dialog nur JSON und keine Ordnerwahl; ZIPs und Ordner erreichen BlueK nur noch durch Ablegen auf dem Drop-Feld | Chromium-GUI-Test mit BluePlay-ZIP per Drop und `main()`; Ablegen eines Ordners nicht automatisiert | Ordner-Drop visuell abnehmen |
| GUI-62 | `npm run build:offline` erzeugt eine einzelne `BlueK.html` plus Anleitung/ZIP; per Doppelklick (`file://`) laufen dieselbe Svelte-IDE und Runtime ohne Server, einschließlich Projektvorlagen, Formatter, BluePlay und HTML-Programmexport. Kurzlink-Aktion und Drei-Wort-Code fehlen | `smoke-offline-build` prüft HTML/ZIP; `offline.spec.ts` prüft die echte IDE mit blockiertem HTTP-Netzwerk in Chromium und den Worker in WebKit | 2026-10-01: 4/4 echte Offline-Browsertests grün (Chromium und WebKit); Benutzerbestätigung und visuelle Abnahme offen. Der frühere Server-/Startskript-Test ist durch die serverlose Paketprüfung ersetzt |
| GUI-63 | Unten links in der Seitenleiste bietet BlueK die Offline-Version als ZIP an; `npm run build` und `npm run dev` (predev) legen die Datei immer an, im Offline-Build selbst fehlt der Link | Chromium-GUI-Test (Link sichtbar, `download`-Attribut, ZIP per Request geladen), `smoke-offline-build` (ZIP veröffentlicht, nicht im Offline-Paket selbst) | Abgesichert |
| GUI-64 | Compilerfehler erscheinen nicht mehr im zentralen Dialog, sondern am Ort des Fehlers: der Editor der betroffenen Datei öffnet sich, markiert die Zeile (roter Hintergrund, Wellenlinie) und meldet den Text unter dem Editor wie die Parser-Meldungen des Formatierers; Tippen löscht die Markierung, der nächste Compile setzt sie neu. Der Dialog bleibt nur für Fehler ohne Quelltextstelle (z. B. fehlgeschlagener Methodenaufruf) | Chromium-GUI-Test GUI-64 (Markierung, Meldung unter dem Editor, kein Dialog, Löschen beim Tippen, erneutes Melden, Verschwinden nach der Korrektur) und GUI-24 (Fehler in `Actions.kt`) | Abgesichert |
| GUI-65 | Compilerfehler lesen sich kompakt (kein `Token(...)`-Dump, keine wiederholte Position), lassen sich wie die Formatierer-Meldung per Kreuz schließen (samt Markierung), und ein Parser-Fehler des Formatierers markiert und zeigt seine Zeile ebenfalls | Chromium-GUI-Test GUI-65 (kompakter Text `Line 4: Unexpected token `fn``, Schließkreuz, markierte Zeile nach Format, Markierung verschwindet beim Schließen) | Abgesichert |
| GUI-66 | Projekte mit Dateien, Ressourcen oder einer README zeigen das dezente README-Blatt links oben im Diagramm; ein vollständig leeres Projekt bleibt leer. Im Fenster wird Markdown direkt beim Tippen formatiert dargestellt, die Marker sind nur auf der Cursor-Zeile sichtbar, bei Codeblöcken und Zitaten im ganzen Block (inkl. der Zaunzeilen), Kotlin in Codeblöcken wird eingefärbt; beim Öffnen liegt der Fokus nicht im Text, erstes Escape verlässt den Text, zweites schließt das Fenster; das Fragezeichen oben rechts zeigt die Syntax am Minimalbeispiel und verschwindet beim Klick daneben; Export/Autosave enthalten die README nur, wenn sie nicht leer ist, beim Import ist sie optional (BlueJ-`README.TXT` wird übernommen) | Chromium-GUI-Test GUI-66 (Blatt sichtbar bei vorhandenem Inhalt, leer nicht gespeichert, kein Fokus beim Öffnen, Formatierung beim Tippen, Marker auf der Cursor-Zeile, Hilfe inkl. Schließen daneben, Codeblock mit Zäunen und Einfärbung, Escape-Folge, Wiederöffnen) und `smoke-project-format` (Export nur bei Inhalt, optionaler Import, Formatierungsmarken, Block-Regionen, Kotlin-Token, BlueJ-README); GUI-01 prüft Empty Project ohne README-Blatt | Abgesichert |
| GUI-67 | Ein Projektlink kann die README beim Start öffnen (`readme=1` im Hash des vollen Links bzw. in der Query des Kurzlinks); der Save/Export-Dialog trägt die Option als Häkchen am rechten Rand beider Link-Kästen, nur bei nicht-leerer README wählbar, und listet zuerst die beiden Links, dann JSON, dann „Export as HTML (Beta)“ (EXP-08), dann das BlueJ-ZIP | Chromium-GUI-Test GUI-67 (ohne Flag kein Fenster, mit Flag gerenderte README, Reihenfolge der Einträge, beide Häkchen gemeinsam, Flag im kopierten Link, bei leerer README deaktiviert); 2026-09-25 veraltete Erwartung ohne „(Beta)“ korrigiert, 1/1 grün | Abgesichert |
| GUI-68 | Der Code-Editor hat einen Vim-Modus: standardmäßig aus, umschaltbar über Cmd/Ctrl+Shift+V oder die Einstellungen; im Modus zeigt der Editor unten die Vim-Statuszeile, Normal-Mode-Befehle (`j`, `dd`, `u`) wirken, ausgeschaltet tippt der Editor wieder normal | Chromium-GUI-Test GUI-68 (ohne Modus tippt `j` ein `j`, Kürzel schaltet ein, `--NORMAL--`, `dd`/`u`, Einstellungs-Checkbox synchron, Ausschalten beendet den Modus) | Abgesichert |
| GUI-69 | BlueK liefert die BluePlay-Standardgrafiken mit (`assets/standard-images/`, im Bundle erzeugt): `Image("duck.png")` und `setBackground("pizza.png")` sind ohne Projektimport nutzbar, die Grafik wird auf die Weltfläche gezeichnet; eine gleichnamige Projektressource hat Vorrang; die Grafiken stehen nicht im Projekt und werden nicht gespeichert | Chromium-GUI-Test GUI-69 (Standardgrafik im Codepad und auf dem Canvas) und `smoke-blueplay-browser` (Auflösung über `images/`, Vorrang der Projektressource) | Abgesichert |
| GUI-70 | Die im Build erzeugten Pixelmasken der Standardgrafiken stimmen mit der Browserdekodierung überein (Größe und Alphakanal), damit pixelgenaue Klicks und `isTouching` für sie stimmen | Chromium-GUI-Test GUI-70 über alle mitgelieferten Grafiken | Abgesichert |
| GUI-71 | Dark Mode lässt sich in den Einstellungen an-/ausschalten: Chrome (Sidebar, Toolbar, Dialoge, Popups, Terminal, README-Editor) wechselt auf ein dunkles Palette; Buttons sind flach, ohne systemabhängigen Relief-Rand, und haben sichtbare Hover-, Fokus- und Druckzustände; auch das aktive Terminal-Symbol hat ausreichenden Kontrast; Formularfelder, Editor-Tabs und Format-Button bleiben dunkel; der Code-Editor bekommt zusätzlich ein eigenes dunkles CodeMirror-Theme samt angepasster Syntaxfarben (reine CSS-Overrides reichen dafür nicht, CodeMirror rendert seine eigenen generierten Styles); bewusst farbige Elemente (rote Objektbank/Inspektor, gelbes inspiziertes Feld) behalten ihre Identitätsfarbe in beiden Modi | Chromium-GUI-Test GUI-71 (Umschalten setzt/entfernt `.dark`, flacher Dialog-Button ohne Schatten/Relief, Hintergrundfarben von Wurzel-Element und offenem Editor, Hoverfarben an Toolbar- und Format-Button, aktives Terminal-Icon, Dark-Mode-Formularfeld) | Abgesichert |
| GUI-72 | Die obere Toolbar schaltet auf reine Icons um, sobald ihre eigene verfügbare Breite (nicht die Fensterbreite) unter die Schwelle fällt — reagiert also gleichermaßen auf ein verkleinertes Browserfenster wie auf das geteilte Terminal, das rechts Platz wegnimmt, ohne dass Symbole hinter dem Terminal-Panel verschwinden; die Schwelle liegt knapp über dem tatsächlich benötigten Platz der beschrifteten Buttons (~750px), nicht bei der zuvor zu großzügigen, an der Fensterbreite orientierten Marke | Chromium-GUI-Test GUI-72 (Split verkleinert die Toolbar ohne Fensteränderung, Beschriftung bleibt bei ausreichend Platz sichtbar, verschwindet erst bei echtem Platzmangel) | Abgesichert |
| GUI-73 | Der Anfasser zum Verschieben des Terminal-Splits liegt im Z-Stapel immer unter einem geöffneten BluePlay-Weltfenster (analog zur bereits bestehenden Regel für ein aktives Editorfenster) statt gleichauf mit dessen Z-Index über der DOM-Reihenfolge zu gewinnen und sichtbar über dem Fenster zu schweben | Chromium-GUI-Test GUI-73 (Z-Index des Anfassers ist bei geöffneter BluePlay-Welt niedriger als der des Weltfensters) | Abgesichert |
| GUI-74 | Der Vererbungsmodus zeigt im Canvas einen sichtbaren Hinweis: zuerst Unterklasse, nach Auswahl dann Oberklasse; nach der zweiten Auswahl verschwindet der Hinweis | Chromium-GUI-Test GUI-74 (Hinweistext ändert sich zwischen beiden Auswahlstufen und verschwindet danach) | Abgesichert |
| GUI-74 | Die Einstellungen gruppieren Sprache und Dark Mode unter General sowie Schriftgröße und Vim-Modus darunter unter Editor; die einzige Sprachoption English weist knapp darauf hin, dass es vorerst keine weiteren Sprachen gibt; Feldnamen im Editor wiederholen nicht den Bereichsnamen | Chromium-GUI-Test GUI-74 prüft Gruppenreihenfolge, zugehörige Optionen, einzige Sprache samt Hinweis und knappe Feldnamen; `npm run typecheck` | Chromium-Test 1/1 grün; Typecheck 0 Fehler, 5 Svelte-Warnungen; abgesichert |
| GUI-75 | Klassenkarten rasten beim Verschieben auf ein unsichtbares Raster mit 20-px-Schritten ein, damit sie aneinander ausgerichtet und mit gleichem Abstand platziert werden können | Chromium-GUI-Test GUI-75 prüft Rasterpositionen und gleiche Spalte/Reihenabstand nach dem Ziehen; GUI-58 prüft weiterhin das Verschieben von BluePlay-Karten | Chromium 2/2 grün; Typecheck 0 Fehler, 5 Svelte-Warnungen; abgesichert |
| GUI-76 | BluePlay-Vorlagen zeigen die Bibliothekskarten in der Reihenfolge BluePlayFunctions, World, Actor, Image; danach folgen Main, World-Unterklassen und Actor-Unterklassen; alle Vorlagenkarten stehen auf einem 4-spaltigen 20-px-Raster mit gleichmäßigen 280-px-Spalten- und 160-px-Zeilenabständen | `npx playwright test --grep 'GUI-76|GUI-59|GUI-01'` prüft BluePlay Example und Space Invaders, Reihenfolge, Positionen, Rasterausrichtung und Vorlagenerstellung | 8/8 Chromium-Tests grün; Typecheck 0 Fehler, 5 Svelte-Warnungen; abgesichert |
| GUI-80 | Ein optionaler Projektname ist zwischen den Toolbar-Aktionen editierbar, Enter trimmt und bestätigt den Namen und löst den Fokus vom Feld; der Name wird in Autosave/JSON/full link/Server-Shortlink erhalten und bestimmt beim JSON-Export den Dateinamen; beim ersten Export ohne Namen fragt BlueK danach. Bei BluePlay stehen Images und Audio links vom Namen; das Namensfeld darf keine Buttons überdecken | `smoke-project-format`; Chromium-GUI-Test GUI-80 prüft Enter/Fokus, Medienreihenfolge und Klicks auf New Project, New File und Help | Ursache war `.toolbar input`: das transparente, absolut positionierte Upload-Input traf auch das Namensfeld und überdeckte vorgelagerte Aktionen. Auf `.toolbar label input` eingegrenzt; direkte Browserprüfung nach Korrektur öffnete New Project, New File und Help. Playwright-Lauf hier durch fehlende `chromium_headless_shell`-Installation blockiert |
| GUI-77 | Die linke Hauptaktion heißt „Start main“, damit sie klar vom „Run“-Button der BluePlay-Welt unterschieden ist | Chromium-GUI-Test GUI-77 prüft sichtbaren Text, zugänglichen Namen und Tooltip | Chromium-Test 1/1 grün; Typecheck 0 Fehler, 5 Svelte-Warnungen; abgesichert |
| GUI-78 | Markierte Kotlin-Zeilen lassen sich per Button und Cmd/Ctrl+/ gemeinsam ein- und auskommentieren; Kommentar- und Autoformat-Buttons sind als einheitliche Editor-Aktionsleiste gestaltet | Chromium-GUI-Test GUI-78 prüft Mehrzeilenauswahl, Button, Tastatureingabe über den physischen Slash-Key und sichtbaren Shortcut-Text; die bestehenden Formatierungstests bleiben Teil der Editorregression | Chromium-Test 1/1 grün; Typecheck 0 Fehler, 5 Svelte-Warnungen; abgesichert |
| GUI-79 | Der unbrauchbare Files-Button entfällt; nur BluePlay-Projekte erhalten zwei icon-only Aktionen für Bilder und Audio. Images öffnet eine Kachelansicht für ungefähr fünf Spalten mit Dateiname und Vorschau, einer wirkungslosen Add-Kachel mit Implementierungshinweis sowie mittigem Close-Button darunter; Audio zeigt ebenfalls einen Implementierungshinweis | Chromium-GUI-Test GUI-79 (ersetzt GUI-16): kein Files-Button, Images/Audio nur im BluePlay-Projekt und ohne Text, Add-Kachel zuerst, `duck.png` mit Vorschau und Namen, beide Hinweise, Close | Chromium-Test 1/1 grün; Spaltenzahl, Zentrierung des Close-Buttons und visuelle Abnahme offen |
| GUI-80 | Beim Maximieren füllen Editor und Terminal den vollständigen Browser-Viewport ohne Außenrand aus | Chromium-GUI-Test GUI-80 misst beide Fenster von `0,0` bis `innerWidth,innerHeight` | Abgesichert |
| GUI-81 | Eine geschlossene BluePlay-Welt bleibt bei gewöhnlichen Codepad-Auswertungen geschlossen; erneutes Starten von `main()` oder explizites `show()` öffnet sie wieder | Chromium-GUI-Test GUI-81 schließt die Welt, führt `5 + 3` aus und prüft Ergebnis `8` bei weiterhin fehlendem Weltfenster; danach startet `main()` die Welt erneut | Abgesichert |
| GUI-83 | Wenn Laufzeiteingabe oder Programmausgabe das Terminal öffnet, wird es auch über bereits geöffnete Editoren nach vorn geholt | Chromium-Test GUI-83 prüft Terminalausgabe, aktives Fenster und Z-Index über einem Editor; Testaufbau am 2026-09-25 korrigiert (öffnet erst das Terminal, dann den Editor), 1/1 grün | Abgesichert |
| GUI-84 | Der Dialog zur Objekterzeugung per Rechtsklick auf eine Klasse liegt über einem geöffneten Editor | Chromium-Test GUI-84 prüft den Dialog und dessen Z-Index über dem aktiven Editor | Implementiert; nicht ausgeführt |
| GUI-85 | Der Parameterdialog eines per Mausklick aufgerufenen Objekts liegt über einem geöffneten Editor | Chromium-Test GUI-85 prüft den Methodendialog und dessen Z-Index über dem aktiven Editor | Am 01.10.2026 im GUI-93-Prüflauf tatsächlich grün |
| GUI-82 | Geerbte Methoden im Objekt-Kontextmenü sind beim Öffnen des Oberklassen-Untermenüs vollständig sichtbar, ohne horizontalen Scrollen; das Untermenü ist so breit wie die längste Signatur (mindestens 260 px), öffnet nur nach links, wenn rechts der Platz fehlt und links mehr ist, und bleibt auch vertikal im Browser-Viewport | Chromium-GUI-Test GUI-82 prüft sichtbare `World`-Methoden, deaktiviertes horizontales Scrollen und vollständig im Viewport liegende Grenzen des Untermenüs. 2026-10-06 vom Nutzer gemeldet (Screenshot: Signaturen wie `getObjectsAt(x: Int, y: Int): List<Actor>` erst nach Scrollen nach rechts lesbar, das Untermenü hatte feste 260 px). Test erweitert um `scrollLeft = 0`, `scrollWidth <= clientWidth` und die längste Signatur innerhalb des Untermenüs: mit dem alten Stand rot (265 > 258), danach grün; zusätzlich in WebKit grün und in Chromium und WebKit mit 1000×420-Viewport grün (Headless-Browser mit Overlay-Scrollleisten; klassische Scrollleisten nicht automatisch geprüft) | Echter Browsertest; visuelle Abnahme in Safari durch den Nutzer offen |
| GUI-86 | Selbst gezeichnete Actor-Bilder werden auf der Bühne gezeichnet: `Image(20, 20)`, `setColor(200, 0, 0)`, `fill()`, `setImage(picture)` ergibt ein rotes Quadrat statt des Platzhalters mit Klasseninitiale; ebenso `fill()` mit anschließend per `drawImage` eingebettetem gefülltem Bild. Hintergrund und Actor-Bilder nutzen dieselbe Umsetzung aller Image-Operationen (`fill`, `fillRect`, `drawRect`, `fillOval`, `drawOval`, `drawLine`, `drawString`, `drawImage`); `clear`, `setTransparency` und `scale` erzeugen keine Operationen | Chromium-GUI-Test GUI-86 (`blueplay-images.spec.ts`) lädt ein BluePlay-Projekt per `#bluek=p1.`-Link, startet main und prüft Canvas-Pixel beider Actors; `test:ui` prüft die Hilfsfunktionen für `fill`, verschachtelte Bilder und bestehende Operationen | Ursache: `drawnImageDataUrl` kannte `fill` nicht (nur `backgroundDataUrl`). GUI-86 und Hilfsfunktionstest scheiterten vor der Korrektur und sind danach grün. Visuelle Benutzerabnahme offen. Prüflauf siehe unten |
| GUI-87 | Ein angeklickter oder verschobener Objektinspektor liegt über einem offenen Editor; nach Aktivierung des Editors liegt dieser wieder oben und Escape schließt den Editor | Erster GUI-Lauf durch Testaufbau blockiert (Inspector verdeckte Klassenkarte); nach geänderter Öffnungsreihenfolge prüft GUI-87 Aktivierung, Z-Index, tatsächlichen Treffer im Überlappungsbereich, Ziehposition und Escape: 1/1 grün; GUI-18 und GUI-30 ebenfalls grün; Typecheck 0 Fehler/0 Warnungen | Abgesichert |
| GUI-88 | Objektattribute werden als abgerundete Referenzpfeile statt Konstruktorwerte dargestellt; Klick öffnet den referenzierten Inspektor mit Attributnamen (auch bei mehrfach referenziertem Objekt). Feld-Doppelklick startet keine Wertänderung; Bearbeiten läuft über den Stift | Chromium-Test GUI-88 grün: zwei Aliase für dieselbe Instanz und Doppelklick ohne Editiermodus; `npm run typecheck`: 0 Fehler/0 Warnungen; `npm run build:kotlite` und `npm run build:svelte`: erfolgreich (Webpack-/Chunk-Größenhinweise) | Automatisiert abgesichert; visuelle Abnahme der Pfeilform offen |
| GUI-89 | Reine Inspektion per Objekt-Doppelklick, Kontextmenü oder Attributpfeil schaltet den Compile-Button nicht kurz um. Ein Pfeilklick auf einem inaktiven Inspektor oder während zweier laufender Getter-Aktualisierungen öffnet das referenzierte Objekt beim ersten Versuch; ein gespeichertes Attribut führt dabei keinen Getter aus. Entfernte Referenzen geben auch direkt geöffnete Objekt-Handles frei | Chromium-Test GUI-89 grün, inklusive inaktiver Fenster; kompletter `references.spec.ts`-Lauf 5/5 grün; GUI-87 Fenster-Aktivierung/Drag weiterhin grün; `test:references` inkl. direktem Attribut-Handle und Freigabe grün; `test:runtime-state` grün; Typecheck 0 Fehler/0 Warnungen | Automatisiert abgesichert; bei einem tatsächlich laufenden Getter bleibt der Ausführungszustand sichtbar |
| GUI-90 | Der Stift auf einem Objekt-, Collection- oder Pair-Feld im Inspektor öffnet ein leeres Eingabefeld (Platzhalter „expression“) statt des Anzeigetexts `Hund()`, `[…] (size n)` bzw. `(1, a)` (RT-52); Enter auf einem leeren Feld bricht ohne Zuweisung ab, es entsteht also kein neues Objekt. Einfache Werte bleiben vorbelegt. Solange ein Feld bearbeitet wird, fügt ein Klick auf ein Objekt der Objektbank dessen Namen an der Cursorposition ein, statt es auszuwählen; ein Doppelklick fügt ihn einmal ein und öffnet keinen Inspektor. Danach wählt ein Klick wieder aus | Chromium-Test GUI-90: leeres Feld mit Platzhalter, Enter ohne Eingabe lässt `hund1.freund === hund2`, Collection-Feld leer, `Int`-Feld vorbelegt, Klick und Doppelklick auf `hund3` setzen `hund3` ein (Fokus bleibt, keine Auswahl, kein zweiter Inspektor), Enter ergibt `hund1.freund === hund3`, danach wählt ein Klick wieder aus | Automatisiert abgesichert; visuelle Abnahme offen |
| RT-31 | Eine fehlende Grafik meldet einen klaren Laufzeitfehler statt eines unsichtbaren 30x30-Platzhalters: `Image("duckk.png")` ergibt `IllegalArgumentException: Image file not found: duckk.png (expected e.g. in the folder 'images/')` mit den verfügbaren Namen; gilt ebenso für `setImage` und `setBackground` | `smoke-blueplay-browser` (Image, Hintergrund, Namensliste) und Chromium-GUI-Test GUI-69 | Abgesichert |
| RT-15 | `private fun` in Klassen: intern aufrufbar, von außen Compilefehler, Manifest `visibility: private` | `smoke-curriculum-kotlin` | Abgesichert |
| RT-16 | String-Templates enden am ersten Nicht-Bezeichnerzeichen (`"│$rang│"`, `"$name's"`); einzelnes `$` bleibt Text | `smoke-curriculum-kotlin` | Abgesichert |
| RT-17 | `IllegalArgumentException`, `IllegalStateException`, `NumberFormatException` u. a. sind werfbar/fangbar; unbehandelt erscheint `IllegalArgumentException: Nachricht` statt `EvaluateRuntimeException` | `smoke-curriculum-kotlin` | Abgesichert |
| RT-18 | Typargumente werden aus dem deklarierten Typ abgeleitet (`val karten: MutableList<Karte> = mutableListOf()`) | `smoke-curriculum-kotlin` | Nur Property-Deklarationen, nicht Rückgabe-/Argumentpositionen |
| RT-19 | Ausgabe wie Kotlin: `6.0` statt `6`, Listen `[1, 2, 3]` statt `List()`; Inspector zeigt Listen mit Größe und ersten Elementen und ruft kein Schüler-`toString()` auf | `smoke-curriculum-kotlin`, Harness Blackjack-Inspector | Abgesichert |
| RT-20 | `Float` wird als `Double` genähert, `1.5f`/`2F` sind Literale | `smoke-curriculum-kotlin` | Genauigkeit wie Double (bewusste Näherung) |
| RT-21 | `import kotlin.…` wird akzeptiert; JVM-Imports (`java.*`, `javax.*`) melden verständlich Datei und Zeile | `smoke-curriculum-kotlin` | JVM-Bibliotheken werden bewusst nicht nachgebaut |
| RT-22 | Property-Accessors sehen alle Properties der Klasse (auch spätere) und nie Konstruktorparameter; Parameter und Property gleichen Namens (`init { this.alter = alter }`) | `smoke-curriculum-kotlin` | Abgesichert |
| RT-23 | Property ohne Startwert/Getter und ohne init-Block ist ein Compilefehler | `smoke-curriculum-kotlin` | Mit init-Block wird die Zuweisung erst zur Laufzeit geprüft |
| RT-24 | Argumente eines Member-Aufrufs werden im Aufrufer-Scope ausgewertet (`karten.add(neueKarte(i))`) | `smoke-curriculum-kotlin` | Benannte, `vararg`- und Lambda-Argumente nutzen den bisherigen Pfad |
| RT-25 | Parameterlose Top-Level-`main()` in beliebiger Funktionsdatei: „Start main“ und BluePlay-Reset starten den einzigen Kandidaten direkt oder fragen bei mehreren jedes Mal nach der Datei; Cancel/Escape führt nichts aus, keine gespeicherte Auswahl. Rechtsklick startet weiterhin die Funktion der Karte. Reset erhält die Session und initialisiert Top-Level-Properties nicht erneut | `smoke-runtime-state`: eindeutiges/mehrdeutiges/ungültiges/fehlendes Ziel, wechselnde Dateien, Session-Erhalt und Eingabe während Reset. Echte Chromium-Tests in `main-selection.spec.ts`: beide Buttons, beliebige Dateinamen, wiederholte Auswahl, Abbruch, Neuladen, Klassenmethode ausgeschlossen, Tastenkürzel und Verwerfen des Dialogs nach Compile | Runtime-Smoke grün; 6/6 neue Chromium-Tests sowie GUI-77 und GUI-81 grün; Typecheck 0 Fehler/0 Warnungen; visuelle Benutzerabnahme offen. Prüflauf siehe unten |
| RT-26 | Compilefehler zeigen Datei und Zeile auch hinter der BluePlay-Library; „No matching function“ nennt die Argumenttypen | `smoke-runtime-state` | Abgesichert |
| RT-27 | `stop()`/`start()` funktionieren auch nach `welt.show()` (nicht nur nach `showWorld(welt)`) | Harness Goldrausch (Spieler sammelt letzte Münze), `smoke-curriculum-kotlin` | Abgesichert |
| RT-28 | `private` gilt für alle Member, nicht nur den ersten (Lookahead für `private set` verschluckte den Modifier der Folge-Property); Semikolons am Zeilenende im Klassenrumpf sind erlaubt | `smoke-curriculum-kotlin` | Abgesichert |
| RT-11 | `Run` führt dauerhaft Schritte aus, fokussiert sofort die Spielfläche für Tastatursteuerung, `Pause` beendet den nächsten Scheduler-Schritt ohne zweiten Lauf; Speed bleibt während Run änderbar und plant den nächsten Schritt neu | Native Runtime-Smoke + Built-in-Browser mit laufendem `simulation=running`, fokussiertem Canvas, Pause und Slider-Drag | Abgesichert |
| RT-12 | `isTouching`/`intersects` verwenden sichtbare Alpha-Pixel mit Skalierung und Rotation; ein angeklickter Actor darf in `act()` sicher `world.removeObject(this)` ausführen | Native Browser-Smoke prüft getrennte Alpha-Flächen trotz überlappender Rechtecke, 180°-Rotation, sichtbare Überdeckung, Klick-ID außerhalb der Mittelpunktzelle und Selbstentfernung ohne Fault | Abgesichert; 100-Actor-Performance bleibt PERF-01 |
| RT-30 | Fehlt ein Name, sagt BlueK auf welcher Seite die Lücke liegt statt Kotlites generischer Meldung: bekannte Lücke mit Alternative (arrayOf -> listOf), naher Treffer als Vorschlag (minOff -> minOf), sonst neutral (neither declared in this project nor provided by BlueK). Ein vorhandener Name mit falschen Argumenttypen behält Kotlites Meldung, weil nur sie die Argumenttypen nennt | `npm run test:kotlin-surface` prüft 17 Meldungen, darunter zwei Durchreich-Fälle (`split(1,2,3)`, `zeige(5)`); Curriculum-Smoke weiterhin grün, inklusive der Zusicherung `argument types (Int)` | Abgesichert für die geprüften Formen; die Umschreibung erkennt Kotlites Wortlaut per Textmuster und fällt bei geändertem Wortlaut auf die Originalmeldung zurück |
| PERF-01 | Scheduler, Frame-Abstände, Stop-Reaktion, Historien- und Ressourcenwachstum bei Referenzspielen und 100 Actoren sind messbar | Node-Benchmark prüft 180 komplette Schritte mit 1-Pixel-Bewegung, echte Laser und synchrone Invader (Dauerschießen: Mittel 13,1 → 4,5 ms). Chromium: Speed 95, Pfeil+Space für 4 s, 321–326 DOM-Frame-Updates, p95 15,2–15,5 ms, max. 24,4–24,9 ms (vorher 203–206, p95 ≈ 27 ms). 2026-10-02 nach PERF-03 bis PERF-05: 319–324 Frames, p95 15,2 ms, max. 17,2–17,7 ms. Gateway-Test: gleichzeitige Key-down/up ohne Busy-Phase oder alte Frames. Alpha-Kollisionen unverändert | 100–400-Schuss-Messungen siehe PERF-04 (nur gemessen, kein Grenzwert); keine 60-FPS-Garantie; visuelle Benutzerabnahme offen |
| RT-29 | Schul-Kotlin erreicht die zugesagte Stdlib-Oberfläche: `minOf`/`maxOf` (2..n Werte), `coerceIn`/`coerceAtLeast`/`coerceAtMost`, `Int.MAX_VALUE`/`MIN_VALUE`, `Int.toChar`, `Char.code`/`digitToInt`, `sum`/`average`/`sumOf`/`reduce`/`flatten`/`indices` auf Listen und Ranges sowie String als Zeichenfolge (`for (c in wort)`, `wort[i]`, `split`, `toList`, `indices`) | `npm run test:kotlin-surface` prüft 48 Ausdrücke gegen das gebaute Bundle und hält 13 bekannte Lücken (Arrays, `format`, `withIndex`, qualifizierte `kotlin.math.*`-Aufrufe) ausdrücklich als Lücke fest; `benchmark-blueplay` vor/nach der Änderung ohne messbaren Unterschied (Mittel 1,04→1,12 bzw. 3,63→3,31 ms) | Abgesichert für die gelisteten Ausdrücke; Arrays und `format` bleiben offen, `String.indices` liefert `List<Int>` statt `IntRange` |
| PERF-02 | Ein längeres Spiel wird nicht mit jedem entfernten Actor langsamer: Hit-IDs entfernter Actors werden freigegeben, ein wieder hinzugefügter Actor erhält eine neue, klickbare ID | Ursache: die Hit-ID-Liste wuchs mit jedem Laser und wurde pro Frame und Actor linear durchsucht. Node-Langzeitmessung 3000 Schritte Dauerfeuer bei 5 Objekten: 4,1 ms → 1,0 ms pro Schritt. Native BluePlay-Smoke prüft Entfernen, erneutes Hinzufügen und Klick über die neue ID | Kein automatischer Wachstumsgrenzwert (zeitbasiert instabil); Speicherverlauf im Browser nicht gemessen |
| PERF-03 | Während Run sendet der Worker statt vollständiger Snapshots schlanke `frame`-Ereignisse (Revision, Phase, Simulation, Fehler, Bühne), höchstens alle 10 ms; Ausgabe und Effekte (Sound) jedes Schritts kommen trotzdem an, Klassen-Metadaten behalten ihre Identität. Jedes Bild steht einmal je Frame in `images`, Actors verweisen per Index. Endet Run oder tritt ein Fehler auf, folgt ein vollständiger Snapshot | 2026-10-02: `smoke-runtime-state` PERF-03 mit strukturiert klonendem Test-Worker (Frames kommen an, `beep` erreicht den Client, `classes` wird nicht ersetzt); `smoke-blueplay-browser` prüft die Bild-Deduplizierung, `smoke-blueplay-stage` das Frame-Format; Chromium PERF-01 | Runtime-/Helper-Tests und echter Browsertest grün; keine visuelle Benutzerabnahme |
| PERF-04 | Viele Actors bei hoher Geschwindigkeit: Space Invaders mit 100–400 Schüssen, die je Schritt `getOneIntersecting<Invader>()` aufrufen, hält bei Speed 90 (100 Schritte/s) seinen Takt. Speed 96–100 laufen tatsächlich schneller als 95 (genaues Warten statt Timer-Mindestpause). Kollisionen bleiben pixelgenau; `getObjects`, `getIntersecting`, `getOneIntersecting`, `getObjectsAt` und die Zeichenreihenfolge folgen der Reihenfolge der Welt | 2026-10-02, Node `benchmark-blueplay.mjs` (Mittel je Schritt) bei 0/100/200/400 Schüssen: vorher 0,9/81/165/– ms, jetzt 0,3/1,9/3,7/7,2 ms; Dauerschießen 2,81 → 0,40 ms. Chromium (eigene Messseite mit IDE-Worker, Agent): Speed 90 vorher ≈ 23 Schritte/s schon bei 50 Schüssen, jetzt ≈ 98–100 bis 400 Schüsse; Speed 80 hält 50/s bis 400; Speed 100 mit leichter Welt 832 statt 157 Schritte/s. `smoke-blueplay-browser`: Sichtbarkeitsraster gegen die Pixelregel (gerade/ungerade Bildgrößen, 285 Positionen), Weltreihenfolge über Klassengruppen mit Wiederhinzufügen und Weltwechsel | Reihenfolge und Raster automatisiert (echtes Bundle); Durchsatz nur gemessen, kein automatischer Grenzwert (zeitbasiert instabil); visuelle Benutzerabnahme offen |
| PERF-05 | Lange Schleifen geben nach etwa 10 ms Rechenzeit an den Worker ab statt nach 128 Durchläufen, über einen Message-Channel ohne die Mindestpause verschachtelter Timer; Pause/Stop, Eingabe, Ausgabe und Reset reagieren weiterhin während der Schleife | 2026-10-02: Mikromessung je `act()` mit `while` über 10 Durchläufe 172 → 20 µs, mit `for` 410 → 73 µs. GUI-14, RT-37/RT-38 (Suspension in Lambdas, nicht fangbares „cannot pause“) und `smoke-kotlite-browser` grün | Runtime- und echte Browsertests; Schleifendurchsatz nur gemessen |
| PERF-06 | Der Interpreter wird durch Änderungen nicht unbemerkt langsamer: Rekursion (`fib(18)`), Schleifen, Methodenaufrufe mit Objekten, Lambdas an Listenfunktionen, ein Lambda je Schleifendurchlauf auf oberster Ebene, Zeichenketten und das Compilieren von Space Invaders bleiben unter einem Grenzwert von etwa dem 1,6-Fachen der Messwerte; jedes Ergebnis wird mitgeprüft | `npm run test:performance` (`scripts/benchmark-interpreter.mjs`, Teil von `test:regression`): Median aus 5 Läufen je Fall in frischer Sitzung, bei Überschreitung bis zu zwei weitere Versuche (seit RT-95; vorher einer, ein Lauf unter Last scheiterte knapp). `BLUEK_BUNDLE=… node scripts/benchmark-interpreter.mjs --report` vergleicht ein älteres Bundle. 2026-10-05 auf dem ruhigen Entwicklungs-Mac 147–340 ms je Fall; das Bundle aus e247b7b scheitert am Lambda-Fall (428 statt 260 ms) | Zeitbasiert: braucht einen Rechner ohne andere schwere Last (unter 16 parallelen Testläufen fünf- bis zehnmal langsamer); kein geräteunabhängiges Leistungsversprechen; im Browser nicht gemessen |
| EXP-01 | Exportierte Konsolenprogramme laufen als einzelne HTML-Datei per `file://`: Titel/Überschrift = Projektname, Ausgabe, fokussierte Eingabezeile mit blauem Echo, Status (Waiting for input/Finished), Restart startet neu; keinerlei Netzwerk-Anfragen | `player.spec.ts` EXP-01, echtes Chromium | Abgesichert (Chromium); Firefox nur Nutzerbestätigung im Machbarkeitstest |
| EXP-02 | Der beim Export gewählte `main()` läuft, auch wenn eine andere Datei (z. B. `Main.kt`) ebenfalls `main()` hat | `player.spec.ts` EXP-02 | Abgesichert |
| EXP-03 | Compilefehler (Datei:Zeile:Spalte), fehlendes `main()` in der gewählten Datei und Laufzeitfehler erscheinen als Meldung; vorherige Ausgabe bleibt stehen | `player.spec.ts` EXP-03 | Abgesichert |
| EXP-04 | „Download project (.bluek.json)“ liefert das unveränderte Projektformat mit Dateinamen aus dem Projektnamen; „Open in BlueK“ öffnet in neuem Tab die exportierende BlueK-Instanz mit `#bluek=d1.…`, die das Projekt samt Namen lädt | `player.spec.ts` EXP-04 (gegen den Test-Server als BlueK-Adresse) | Abgesichert; Ziel `https://bluek.de/` nicht automatisiert |
| EXP-05 | Wäre der Link länger als 1 MB, fehlt „Open in BlueK“; stattdessen Hinweis auf den Download | `player.spec.ts` EXP-05 (900 KB Zufallsdaten als Sound) | Abgesichert |
| EXP-06 | Exportierte BluePlay-Programme zeigen die Welt nach dem Laden pausiert; Step, gehaltene Taste (auch beim Loslassen mit Fokus auf einem Button), Klick auf Actor, Run/Pause, Reset (während Run gesperrt) wirken; keine Netzwerk-Anfragen | `player.spec.ts` EXP-06, echtes Chromium, Canvas-Pixel geprüft | Abgesichert; Sounds nicht automatisiert; visuelle Abnahme offen |
| EXP-07 | Konsolen- und BluePlay-Export laufen auch in WebKit | `player.spec.ts` EXP-07 (Playwright-WebKit) | Abgesichert; echtes Safari nicht geprüft |
| EXP-08 | Save / Export kennzeichnet „Export as HTML“ als Beta; der Export kompiliert bei Bedarf, fragt wie der JSON-Export nach einem fehlenden Projektnamen und lädt `<Projektname>.html` herunter; die Datei läuft per `file://` mit dem einzigen `main()` und verlinkt bei Export von localhost auf `https://bluek.de/` | `html-export.spec.ts` EXP-08, echtes Chromium | Abgesichert |
| EXP-09 | Bei mehreren `main()` fragt der Export jedes Mal („Which main() should the exported HTML file start?“); Abbrechen lädt nichts herunter; die gewählte Datei startet im Export | `html-export.spec.ts` EXP-09 | Abgesichert |
| EXP-10 | Ohne parameterloses `main()` gibt es keinen Export: Hinweis nach dem Kompilieren, danach ist „Export as HTML“ deaktiviert mit „Needs a file with a parameterless main().“; bei Compilefehlern öffnet sich wie bei Compile die Datei mit markiertem Fehler, kein Download | `html-export.spec.ts` EXP-10 | Abgesichert |
| EXP-11 | Ein BluePlay-Projekt aus der IDE exportiert zeigt im Player seine Welt (pausiert) und die Ausgabe von `main()` | `html-export.spec.ts` EXP-11 | Abgesichert |
| EXP-12 | Ein exportiertes Konsolenprogramm zeigt ANSI-Farben und löscht den Bildschirm wie das IDE-Terminal (gleicher Parser `terminalText.ts`, Farben als Inline-Stil, weil der Player kein eigenes CSS laden darf) | 2026-10-04 mit GUI-97. Ein erster Entwurf mit eigener CSS-Datei brach `npm run build:player` („must build to a single script“); umgestellt auf CSS-Variablen mit Standardwert. Browser-Test EXP-12 grün | Browser-Test EXP-12 |
| RT-37 | Ein Lambda, das an eine Stdlib-Funktion übergeben wird (`forEach`, `map`, `filter`, `repeat`, `let` …), darf suspendieren: Schleifen mit Checkpoint, `readln()` und `Thread.sleep()` darin funktionieren; jedes Lambda läuft genau einmal, Ergebnis und Ausgabe gleichen einem Lauf ohne Suspension. Reproduktion über die asynchrone API: `(1..50).toList().forEach { for (i in 1..3) { } }` bzw. `listOf(1, 2).map { readln() }`, `listOf(1).forEach { Thread.sleep(5) }`. In `toString()`/`equals()`/`hashCode()`/`compareTo()` melden `readln()`/`Thread.sleep()` einen verständlichen Fehler statt den Aufrufstapel zu beschädigen | 2026-09-24: Probe gegen das eingecheckte Bundle schlug fehl (`A wrong scope is completed`; bei `sleep`: `Execution suspended at a synchronous compatibility boundary`). 2026-09-25: behoben durch Wiederholung des nativen Stdlib-Aufrufs mit gemerkten Callback-Ergebnissen und Checkpoint-Verzicht in synchronen Callbacks (`vendor/kotlite-interpreter`, `PATCH.md`); `test:runtime-state` (echter Client/Host: Checkpoint, Eingabe, `sleep`) und RT-37-Block in `smoke-kotlite-browser.mjs` (11 Fälle suspendiert = gepuffert, `removeAll`/`retainAll`/`sortBy`, Scope-Funktionen, nichtlokaler Return, Ausnahmen, Rekursion, Ablehnung in `toString()`) grün; beide gegen das alte Bundle rot | Abgesichert (Node, echtes Bundle); nicht im echten Browser/GUI geprüft. Bekannte Grenze: Schleifen in synchronen Callbacks geben nicht an den Worker ab. Mit RT-38 und RT-39 zusammengeführt (2026-09-25): der RT-38-Fall, der diesen Fehler nutzte, ist ersetzt (siehe Prüfprotokoll „Zusammenführung RT-37, RT-38 und RT-39“). Die Meldung „cannot pause …“ fängt seit der Nutzerentscheidung vom 2026-09-25 kein `catch` mehr (Prüfprotokoll „„cannot pause“ nicht mehr fangbar“); abgesichert in `smoke-curriculum-kotlin.mjs` |
| RT-38 | Eine Ausnahme aus einer nativen Stdlib-Funktion ist mit ihrer Kotlin-Klasse fangbar: `try { "x".toInt() } catch (e: NumberFormatException) { -1 }` ergibt `-1`, ebenso mit `catch (e: Exception)`; gilt für `NumberFormatException`, `IllegalArgumentException`, `IllegalStateException`, `IndexOutOfBoundsException`, `NoSuchElementException` und `ArithmeticException` (auch Ganzzahldivision durch 0) | 2026-09-24: Probe gegen das eingecheckte Bundle: nur `catch (e: Throwable)` fängt; selbst geworfene `NumberFormatException` wird korrekt gefangen. 2026-09-25: `node scripts/smoke-curriculum-kotlin.mjs` prüft alle sechs Klassen (u. a. `"x".toInt()`, `require`, `check`, `listOf(1)[5]`, `first()`, `1 / 0`, `5L % 0L`), Fangen über Oberklasse und `Exception`, eine unpassende Klausel, `printStackTrace()` und die ungefangene Meldung; scheitert gegen das alte Bundle, grün gegen das neue. Nach Zusammenführung mit RT-37 zusätzlich Ausnahmen aus suspendierten und wiederholten Stdlib-Lambdas | **Behoben**, abgesichert durch Node-Laufzeittest (Teil von `browser-smoke`); kein GUI-Test. Offen: andere Host-Ausnahmen (z. B. `UnsupportedOperationException`) nur mit `Throwable` fangbar; kein Stacktrace für native Ausnahmen |
| RT-39 | `String.substring` prüft die Grenzen wie Kotlin: `"abc".substring(5)`, `substring(1, 10)`, `substring(2, 1)` und `substring(-1)` werfen `IndexOutOfBoundsException` („begin 5, end 3, length 3“), fangbar mit ihrer Klasse und `Exception` (RT-38); gültige Aufrufe bleiben unverändert (`"abc".substring(3)` ergibt `""`) | 2026-09-25: vorher JavaScript-Semantik (`"abc".substring(5)` → `""`, `substring(2, 1)` → `"b"`); `smoke-curriculum-kotlin.mjs` prüft gültige und ungültige Aufrufe, das Fangen und die ungefangene Meldung; scheitert mit dem Bundle vor der Korrektur, grün mit dem neuen | **Behoben**, abgesichert durch Node-Laufzeittest (Teil von `browser-smoke`); die JVM-Unterklasse `StringIndexOutOfBoundsException` gibt es in BlueK nicht |
| RT-40 | Klassen, die einander verwenden, lassen sich in jeder Datei- und Deklarationsreihenfolge compilieren und ausführen: `class Hund { var herrchen: Mensch? = null; var frauchen: Mensch? = null; val alle = mutableListOf<Mensch>() }` mit `class Mensch { var hund: Hund? = null }`, `class Mensch { fun gassi(h: Hund) { … } }`, `class Mensch { fun kaufen() { val h = Hund(); h.herrchen = this } }`, `class Mensch { val hunde = mutableListOf<Hund>() }` oder `class Mensch(var hund: Hund? = null)`; ebenso Methodenaufrufe in beide Richtungen, eine später stehende Oberklasse oder ein Interface und zusammen im Codepad deklarierte Klassen. Echte Fehler bleiben Fehler (fehlende Klasse, Zyklus in der Vererbung) | 2026-09-26: mit dem Bundle vor der Korrektur scheitert jede Variante in beiden Reihenfolgen (`Cannot resolve type Hund?`, `Unknown type Hund`, `No matching function or constructor Hund`, `RuntimeException: Unknown type Hund`); im GUI markiert Compile `Line 1: SemanticException: Cannot resolve type Hund?`. Behoben durch Deklaration aller Klassen vor der Analyse, Analyse bei Bedarf und Auswertung der Klassen vor dem übrigen Quelltext (`vendor/kotlite-interpreter`, `PATCH.md`). RT-40-Block in `smoke-curriculum-kotlin.mjs` und GUI-Test RT-40 in `regressions.spec.ts` scheitern mit dem alten Bundle und sind mit dem neuen grün | **Behoben**, abgesichert durch Node-Laufzeittest (Teil von `browser-smoke`) und Chromium-GUI-Test. Offen: Top-Level-Funktionen und -Properties sehen weiterhin nur vorher stehende Top-Level-Deklarationen (seit RT-45 behoben); von einer Klasse, deren Analyse gerade läuft, sind nur die bis dahin analysierten Member bekannt (siehe `docs/kotlite.md`) |
| RT-42 | Endlose oder zu tiefe Rekursion (Funktion, Methode, Setter/Getter, Konstruktor) ergibt nach 1000 verschachtelten Aufrufen `StackOverflowError: More than 1000 nested calls. Does a function or property accessor call itself endlessly?` statt „NullPointerException: Kotlite evaluation failed.“; `catch (e: Throwable)`, `catch (e: Error)` und `catch (e: StackOverflowError)` fangen ihn, `catch (e: Exception)` nicht, und nach dem Fangen läuft das Programm weiter. Rekursion bis Tiefe 1000 funktioniert im Browser-Worker (vorher 117); in Stdlib-Lambdas und `toString()` wird ein Überlauf des Browsers ebenfalls als `StackOverflowError` gemeldet | `smoke-kotlite-browser` (Setter per `startSet`, Tiefe 990/1001, Fangen nach Klasse, Konstruktor, `forEach`, Weiterlaufen nach Fangen); Chromium-Test „RT-42 RT-43 …“ mit dem Hund/Mensch-Projekt des Nutzers | Automatisiert abgesichert; Grenze wegen quadratischer Namenssuche niedrig (siehe `docs/kotlite.md`) |
| RT-43 | Ein Setter, der seine eigene Property zuweist (`herrchen = value`, `this.x = value`), oder ein Getter, der sie liest, ergibt beim Compile eine Warnung an der Stelle („The setter of `herrchen` assigns `herrchen` and so calls itself endlessly. Write `field = value` to store the value.“); der Compile gelingt, der Editor öffnet sich mit gelber Markierung und gelbem Hinweis ohne Fehlerdialog. Keine Warnung für `field`, Lesen im Setter, andere Instanzen oder lokale Variablen gleichen Namens | `smoke-kotlite-browser` (positive und negative Fälle, Datei/Zeile/Spalte); Chromium-Test „RT-42 RT-43 …“ | Automatisiert abgesichert; visuelle Abnahme offen |
| RT-44 | Ein Safe Call von `toString()`, `equals()` oder `hashCode()` auf einem nullable Wert (`n?.toString()` bei `Int?`, `s?.equals("a")` bei `String?`, eigene Klasse mit und ohne Überschreibung) kompiliert und ruft die Funktion des nicht-nullable Typs auf; mit `null` ergibt er `null`. Das BluePlay-Projekt aus `examples/blueplay/` (`World.kt` Zeile 35: `current.image?.transparency?.toString() ?: "255"`) lädt. Seit 34c8c91 (`Any?`-Erweiterungen in `BlueKStdlibModule`) war das ein Compilefehler „Ambiguous function call for `toString`. 2 candidates match: Int.toString(), Any?.toString()“; `s?.equals("a")` war schon vorher mehrdeutig | 2026-09-26: `smoke-blueplay-browser` und 11 neue Fälle in `smoke-kotlin-surface.mjs` rot gegen das Bundle aus 936652c, grün nach der Korrektur in `SemanticAnalyzer.FunctionCallNode.visit` (`PATCH.md`); danach `browser-smoke` komplett, `test:references`, `test:generics` und Playwright 125/125 grün (Prüfprotokoll „RT-44“) | Automatisiert abgesichert (Node, echtes Bundle); kein eigener GUI-Test |
| RT-45 | Top-Level-Funktionen (auch Erweiterungs- und Operatorfunktionen) und -Properties lassen sich unabhängig von der Dateireihenfolge verwenden: `Main.kt` mit `fun main() { println(hilfe()) }` und `Util.kt` mit `fun hilfe(): Int = 1`, `class Hund { fun f() = hilfe() }` bzw. `class Hund { fun f() = maximum + 1 }` mit `val maximum = 3` in einer späteren Datei, eine `var` einer späteren Datei aus einer Klasse ändern, gegenseitig rekursive Funktionen in zwei Dateien, ein Initialisierer, der eine spätere Funktion aufruft; Überladungen nach dem Aufruf nehmen an der Auflösung teil. Im Codepad darf eine Eingabe ihre eigenen späteren Deklarationen verwenden; spätere Eingaben (auch eine neue Überladung) ändern frühere nicht. Property-Initialisierer laufen weiter in Dateireihenfolge: direktes Lesen einer später initialisierten Property ist ein Compilefehler („`b` is initialized after this code in file order …“), indirektes über Funktion/Klasse ein nicht fangbarer Laufzeitfehler („`maximum` is used before it is initialized …“) | 2026-09-26: mit dem Bundle vor der Korrektur (RT-40-Stand) scheitern alle drei gemeldeten Reproduktionen (`No matching function or constructor hilfe`, `` `maximum` is unknown``), in umgekehrter Dateireihenfolge funktionieren sie; im GUI markiert Compile `Line 2: SemanticException: No matching function or constructor hilfe`. Behoben durch Analyse bei Bedarf innerhalb der Quelltexteinheit, Funktionsdeklarationen vor den übrigen Knoten und Prüfung der Initialisierungsreihenfolge (`vendor/kotlite-interpreter`, `PATCH.md`; Einheitsgrenzen in `KotliteSession`). RT-45-Block in `smoke-curriculum-kotlin.mjs` und GUI-Test RT-45 in `regressions.spec.ts` scheitern mit dem alten Bundle und sind mit dem neuen grün | **Behoben**, abgesichert durch Node-Laufzeittest (Teil von `browser-smoke`) und Chromium-GUI-Test. Grenzen: Initialisierer laufen strikt in Dateireihenfolge (Kotlin/JVM initialisiert Dateien bei Bedarf); gegenseitig rekursive Funktionen mit Ausdruckskörper brauchen einen Rückgabetyp an der zuerst analysierten (siehe README „Aktuelle Grenzen“, `docs/kotlite.md`) |
| RT-46 | Smart Casts nach `is`: `other is Q && other.n == n` in `equals(other: Any?)` wird akzeptiert (vorher `` `n` is unknown for Any ``, Workaround `(other as Q).n`). Ebenso `if (x is T) { x.f }`, `x !is T` mit frühem `return`/`throw`/`continue`, der `else`-Zweig von `x !is T`, `when (x) { is T -> … }` (auch `!is`, ohne Subjekt, `when (val y = …)`), `while (x is T && …)`, `!(x is T)`, Argumente an überladene Funktionen und `x is Int`/`String` auf `Any?`. Nicht gecastet werden wie in Kotlin: nach `\|\|`, außerhalb des Blocks, nach einer Zuweisung an die Variable, `var`-/Getter-/`open`-Properties, `var` in einem Lambda, ein verdeckter (shadowing) Name, mehrere Bedingungen in einem `when`-Eintrag. Null-Prüfungen gelten jetzt auch im `else`-Zweig, in `while (k != null)` und nach `continue`/`break`/`throw`, und enden mit dem umgebenden Block | 2026-09-26: Vorher-Probe mit dem eingecheckten Bundle: keine der Formen außer `x as T` ging (`smoke-curriculum-kotlin.mjs` scheitert dort schon an der ersten Form). `smoke-curriculum-kotlin.mjs` (neuer RT-40-Block) prüft 48 akzeptierte Ausdrücke mit Laufzeitergebnis (auch `equals` mit fremdem Typ und `null`) und 14 Gegenfälle, die weiter abgelehnt werden. Eingebauter Browser gegen den Dev-Server dieses Worktrees: `Punkt(1) == Punkt(1)` `true`, `Punkt(1) == Punkt(2)` `false`, im Codepad `val a: Any = "abc"; if (a is String) a.length else -1` → `3`, `if (a is String \|\| a.length > 1) 1 else 2` weiter abgelehnt | Abgesichert durch Node-Laufzeittest (`browser-smoke`) und eine Browser-Probe; Grenzen siehe README „Aktuelle Grenzen“: nur einfache Namen (nicht `objekt.eigenschaft`), keine Schnittmengen-Typen, keine Schleifen-Rückkanten bei `var` |
| GUI-91 | Die BluePlay-API-Hilfe zeigt die vollständige Schüler-API des GitHub-BlueJ-Projekts: Konstruktoren, val/var-Properties, Methoden und kurze Erklärungen; ohne Links/Beispiele, kompakt, scrollbar und in Light/Dark Mode lesbar | `test:blueplay-api` vergleicht das generierte Interpreter-Manifest mit den Originalsignaturen; Chromium GUI-91 prüft alle vier Dialoge, korrekte Signaturen, keine Links/Beispiele, horizontalen Überlauf und erreichbares Close; Screenshots bei 1440×1000, 390×844 und Dark Mode geprüft | **Behoben**, Helper-/Runtime-Test und echter Browsertest grün; visuell durch Agent anhand Screenshots geprüft, keine Benutzerabnahme |
| GUI-92 / RT-49 | Alle Properties im Objektinspektor werden automatisch ausgewertet. Gewöhnliche Getter-Exceptions stehen gekürzt im normalen Wertfeld; Hover/Klick zeigt die volle Meldung. Weitere Werte/null/Referenzen bleiben sichtbar, die Runtime bleibt bereit. Im Programm ist derselbe unbehandelte Zugriff fatal. `Actor.world: World` wirft ohne Welt; weltabhängige Zugriffe werfen ebenfalls | `test:inspector`, tatsächlicher Host/Client-Runtime-Test RT-49 und Chromium GUI-92; Einzelheiten und echte Laufresultate im Protokoll unten | Runtime-/Helper-Tests und echte Browsertests grün; visuell durch Agent geprüft, keine Benutzerabnahme; Entscheidung im Inspektor-Abschnitt von `docs/architecture.md` |
| RT-47 | Library und Beispiele entsprechen der öffentlichen BlueJ-Schüler-API: exakte Typen/Namen/Typschranken, echte Image-Konstruktoren, keine Zusatzmethoden oder sichtbaren Engine-Felder; Bildkopie, drawImage, Skalierung, Transparenz und Simulationssteuerung funktionieren | `test:blueplay-api`: vollständige Signaturen, 14 gültige/28 ungültige Aufrufe, unveränderte GitHub-Schülerdateien, Objektlebensdauer, kopierte/scalierte Pixelmasken. Native BluePlay-Smoke und Chromium RT-47 prüfen Canvas-Pixel geladener/gemalter/kopierter/skaliert-transparenter Bilder und des grauen Platzhalters sowie show/step während Run | **Behoben**; Runtime-/Helper-Tests und echte Browser-Pixeltests; keine JVM-Ausführung. Font-/Antialiasing-Gleichheit mit AWT nicht zugesagt |
| RT-48 | Sekundäre Konstruktoren ohne Primärkonstruktor/Delegation lösen Überladungen und benannte/default Argumente auf; Argumente und init laufen einmal, der Rumpf kann Eingabe und sleep suspendieren; bisherige Primärkonstruktoren und vorwärts referenzierte Klassen bleiben korrekt | RT-48-Block in `smoke-kotlite-browser.mjs`, vorhandener RT-40-Block im Curriculum-Smoke, alle drei Image-Konstruktoren im BluePlay-Konformitätstest; Änderung in `vendor/kotlite-interpreter/PATCH.md` | Node-Tests mit tatsächlich gebautem Bundle grün; Grenzen in README/kotlite.md dokumentiert |

| RT-50 | Eine nullable Sammlung als `for`-Subjekt ergibt „Non-nullable value required to call 'iterator()' method in a for-loop.“; die Position zeigt auf den Ausdruck nach `in`, bei Safe Calls auf den Empfänger. Elvis, `!!`, Smart Casts und Iterator-Erweiterungen auf nullable Empfängern bleiben gültig. Fehler im Subjekt und gewöhnliche unsafe Calls behalten ihre Meldung | RT-50 in `smoke-kotlite-browser.mjs`: echte Bundle-Analyse, Datei/Zeile/Spalte, List/Range/String/Safe Call und gültige Gegenfälle; Chromium RT-50 prüft `world?.getObjects<Ente>()`, Markierung von `world` und Korrektur mit Elvis | Echte Bundle-Tests und drei Chromium-Tests grün; Ergebnisse im RT-50-Prüfprotokoll |
| RT-51 | Welten erkennen ihre Actors an der Identität: zwei per überschriebenem `equals` gleiche Actors sind getrennte Mitglieder (`numberOfObjects` 2), finden einander bei Kollisionsabfragen und werden einzeln entfernt. Ein nur über seine Welt erreichbarer Actor behält seinen Inspektor-Handle, bis er die Welt verlässt | 2026-10-02, Probe gegen das Bundle aus 92e89a2: `numberOfObjects` 1, `getOneIntersecting<Coin>()` ergab `null`, `removeObject(second)` entfernte `first` aus der Liste (Library-Liste per `equals`, native Liste per Identität). RT-51-Block in `smoke-blueplay-browser.mjs` mit dem neuen Bundle grün; `smoke-references` prüft das Halten durch die Welt | Runtime-Tests mit echtem Bundle; kein GUI-Test |
| RT-52 | `List`, `Set`, `Map` und `Pair` vergleichen, hashen und drucken wie in Kotlin: `listOf(1, 2) == listOf(1, 2)`, `setOf(1, 2) == setOf(2, 1)`, `Pair(1, 2) == Pair(1, 2)` und `Pair(1, 2).equals(Pair(1, 2))` ergeben `true`; `setOf(1 to 2, 1 to 2).size` ist 1, `mapOf((1 to 2) to "x")[1 to 2]` findet `x`, `indexOf`/`contains`/`remove` finden gleiche Pairs und Listen; `Pair(1, "a")`, `zip` und `partition` zeigen `(1, a)`; `listOf(p).toString()` nutzt das eigene `toString()` der Elemente. Vergleiche mit `null` oder anderen Typen ergeben `false`; Iteratoren bleiben bei Identität. Der Inspektor zeigt Pair-Felder passiv als `(1, Leaf())` | 2026-10-02 beim Prüfen bekannter Lücken gefunden: mit dem Bundle aus f379d8e ergaben alle Vergleiche `false`, `setOf(…).size` 2, Pairs `Pair()`, `listOf(Hq(1)).toString()` `[Hq()]`. Ein erster Korrekturversuch ließ `Pair(1, 2) == null` endlos rekursiv enden (`StackOverflowError`); behoben, siehe `PATCH.md`. RT-52-Block in `smoke-curriculum-kotlin.mjs` (41 Fälle) scheitert mit dem alten Bundle beim ersten Fall und ist mit dem neuen grün; `test:runtime-state` prüft Inspektortext und `summary` gespeicherter und berechneter Pair-Felder; GUI-90 prüft Anzeige und leeres Eingabefeld | Runtime-Tests mit echtem Bundle und Chromium-Test GUI-90 |
| RT-53 | `super.equals()`, `super.hashCode()` und `super.toString()`, die bei `Any` ankommen, arbeiten mit dem ganzen Objekt: mit `override fun equals(other: Any?) = super.equals(other)` ist ein Objekt sich selbst gleich (`==`, `equals`, `setOf(e, e).size` 1, `contains`), anderen Objekten nicht; `super.hashCode()` gleicht `hashCode()`; `super.toString()` ergibt `Eigen()` statt `Any()`. Gilt mit und ohne eigene Oberklasse, auch geerbt; `super.toString()` einer Schüler-Oberklasse bleibt unverändert | 2026-10-02 beim Prüfen von RT-52 gefunden; mit dem Bundle aus f379d8e ergab `e == e` `false`, `super.toString()` `Any()`. Ursache: `super` ist ein Teilobjekt (der `Any`-Teil); ohne eigene Oberklasse landet der Aufruf bei BlueKs `Any?`-Erweiterung statt bei `Any`. RT-53-Block in `smoke-curriculum-kotlin.mjs` (10 Fälle) scheitert mit dem alten Bundle beim ersten Fall (`false false false false`) und ist mit dem neuen grün | Runtime-Test mit echtem Bundle; kein GUI-Test |
| RT-54 | Exceptions verhalten sich wie Kotlin-Objekte: `toString()` und String-Templates zeigen `MyEx: x` bzw. ohne Meldung `LeerEx` (auch `IllegalStateException("x").toString()` und `super.toString()` in einer Exception-Unterklasse); `catch` erhält das geworfene Objekt selbst (`e === geworfen`, Felder wie `e.betrag` einer eigenen `KontoException`); `message`, `cause` und `printStackTrace()` funktionieren auch außerhalb von `catch`; eigene Exceptions und Standard-Exceptions sind als `cause` möglich; eine nicht gefangene Exception ohne Meldung erscheint als `LeerEx` | 2026-10-02 beim Prüfen bekannter Lücken gefunden; mit dem Bundle aus f379d8e: `IllegalStateException("x").toString()` brach mit `memberFunctionsForSA not initialized` ab, Templates zeigten `MyEx()`, `MyEx("x").message` ergab `ClassCastException`, `catch (e: KontoException) { e.betrag }` eine `NullPointerException`, `Exception("a", IllegalStateException("b"))` einen Typfehler. RT-54-Block in `smoke-curriculum-kotlin.mjs` (20 Ausdrücke, `printStackTrace`, zwei ungefangene Fälle) scheitert mit dem alten Bundle beim ersten Fall und ist mit dem neuen grün | Runtime-Test mit echtem Bundle; kein GUI-Test. `null!!` behoben mit RT-61. Korrektur 2026-10-03: `stackTraceToString()` ist nur auf oberster Ebene im Codepad leer (kein Funktionsaufruf), bei eigenen wie bei Standard-Exceptions; innerhalb von Funktionen enthält er die Aufrufe. Offen: Die Positionen beziehen sich auf den zusammengesetzten Projekttext (`<BlueK project>:14:11`), nicht auf Datei und Zeile |
| RT-55 | `break` und `continue` funktionieren in `for`-Schleifen über Ranges, `until`, `downTo`, Listen und Strings, auch verschachtelt, in `when`-Zweigen und in Funktionen wie `main()`; danach läuft das Programm normal weiter | 2026-10-02 beim Arbeiten an RT-56 gefunden: mit allen eingecheckten Bundles seit dfb7fe0 (also auch auf `main`) endete jedes `break`/`continue` in `for` mit `NormalBreakException: Break` bzw. `NormalContinueException: Continue`; `while` war nicht betroffen. Der vorhandene Curriculum-Fall mit `continue` erreichte es nie (keine `null` in der Liste). RT-55-Block in `smoke-curriculum-kotlin.mjs` scheitert mit dem Bundle aus c65f27d beim ersten Fall und ist mit dem neuen grün | Runtime-Test mit echtem Bundle; kein GUI-Test |
| RT-56 | `when` ohne `else` ist als Anweisung erlaubt und tut nichts, wenn kein Zweig passt; als Wert (Initialisierung, Zuweisung, `return`, Argument, Ausdruckskörper) ist es erlaubt, wenn es alle Enum-Werte bzw. `true` und `false` abdeckt (bei nullable Subjekt auch `null`), sonst Compilefehler „'when' expression must be exhaustive. Add an 'else' branch.“ wie in Kotlin | 2026-10-02 auf Wunsch des Nutzers; mit dem Bundle aus c65f27d verlangte jedes `when` ein `else` („Currently, `when` expression must be used with an `else` branch“). RT-56-Block in `smoke-curriculum-kotlin.mjs` (7 Werte, Anweisungen mit Ausgabe, 7 abgelehnte Formen, `else` nicht zuletzt) scheitert mit dem alten Bundle beim Projekt und ist mit dem neuen grün | Runtime-Test mit echtem Bundle; kein GUI-Test. Nicht geprüft werden andere Wertpositionen (z. B. Operanden); dort führt `Unit` meist zu einem Typfehler |
| RT-57 | `override fun toString() = "…"`, `override fun equals(other: Any?) = …` und `override fun hashCode() = …` ohne Rückgabetyp compilieren und wirken wie mit Rückgabetyp (Templates, `==`, Sets, Listen, `super.toString()` einer Schüler-Oberklasse); ein unpassender Rumpf wie `override fun toString() = 5` ergibt wie in Kotlin einen Typfehler | 2026-10-02 auf Wunsch des Nutzers; mit dem Bundle aus 011b5c2 brach das Laden mit „Cannot infer return type of function equals“ ab. RT-57-Block in `smoke-curriculum-kotlin.mjs` (6 Ausdrücke, 2 abgelehnte Rümpfe) scheitert mit dem alten Bundle beim Projekt und ist mit dem neuen grün | Runtime-Test mit echtem Bundle; kein GUI-Test. Bekannte, nicht geänderte Grenze: Überschreibungen brauchen denselben Rückgabetyp wie die überschriebene Funktion (README) |
| RT-58 | `map.entries` liefert die Einträge als Set; Einträge erscheinen wie in Kotlin als `a=1` (auch aus `for (e in map)`, `forEach { }`, `maxByOrNull { }`) und sind gleich, wenn Schlüssel und Wert gleich sind; `entries` bleibt nach Änderungen der Map lesbar (Momentaufnahme). `map.forEach { k, v -> }` bleibt eine dokumentierte Lücke | 2026-10-02 auf Wunsch des Nutzers; mit dem Bundle aus 6b0669e war `entries` unbekannt und Einträge zeigten `MapEntry()`. Ein erster Ansatz mit zweiparametrigem `forEach` scheiterte beim Laden („The function `Map/forEach` has been declared repeatedly“) und wurde verworfen; ein zweiter ließ `entries` nach einer Änderung der Map mit `ConcurrentModificationException` scheitern und nutzt nun Kopien der Einträge. RT-58-Block in `smoke-curriculum-kotlin.mjs` und fünf `entries`-Ausdrücke in `smoke-kotlin-surface.mjs` scheitern mit dem alten Bundle und sind mit dem neuen grün | Runtime-Tests mit echtem Bundle; kein GUI-Test |
| RT-59 | Kleine Stdlib-Ergänzungen wie in Kotlin: `Double.MAX_VALUE`/`MIN_VALUE`/`POSITIVE_INFINITY`/`NEGATIVE_INFINITY`/`NaN`, `Char.MIN_VALUE`/`MAX_VALUE`, `map.containsKey`, `map.getOrDefault`, `String.lines()`, `String.zip(String)`, `String.count { }`, Zeichenbereiche (`for (c in 'a'..'z')`, `toList()`, `count()`), `chunked`/`windowed` für Listen und Ranges. `"abc".chunked(2)` bleibt eine dokumentierte Lücke, deren Hinweis nur noch für Strings gilt (vorher erschien er fälschlich auch für Listen) | 2026-10-03 beim Durchgehen bekannter Lücken; mit dem Bundle aus 1cd9a81 fehlten alle 20 neuen Ausdrücke in `smoke-kotlin-surface.mjs`, mit dem neuen Bundle grün (95 unterstützt, 12 bekannte Lücken, 22 Meldungen) | Runtime-Test mit echtem Bundle; kein GUI-Test. `Double.MAX_VALUE` wurde dabei noch im JavaScript-Format ausgegeben (behoben mit RT-60) |
| RT-60 | Doubles erscheinen wie in Kotlin auf der JVM: normal zwischen 10⁻³ und unter 10⁷ (`6.0`, `0.001`, `1234567.0`), sonst mit Exponent (`1.2345678E7`, `1.0E-4`, `1.0E20`, `1.7976931348623157E308`); gilt für Ausgaben, Templates, Listen und das Codepad | 2026-10-03 beim Prüfen von `Double.MAX_VALUE` gefunden; mit dem Bundle aus 4b29b27 ergaben `12345678.0` `12345678.0`, `10.0.pow(20)` `100000000000000000000.0` und `10.0.pow(-7)` `1e-7`. RT-60-Block in `smoke-curriculum-kotlin.mjs` (16 Fälle) scheitert mit dem alten Bundle und ist mit dem neuen grün | Runtime-Test mit echtem Bundle; kein GUI-Test. Abweichungen: `Double.MIN_VALUE` erscheint als `5.0E-324` (JVM: `4.9E-324`), das Literal `-0.0` als `0.0` |
| RT-61 | `null!!` wirft eine `NullPointerException` ohne Meldung wie in Kotlin: `e.message` ist `null`, Text und nicht gefangene Meldung lauten `NullPointerException`; eine eigene Meldung (`NullPointerException("eigen")`) bleibt | 2026-10-03, Rest aus RT-54; mit dem Bundle aus 9a020fa trug die NPE den Text `"null"` (`NullPointerException: null`). RT-61-Block in `smoke-curriculum-kotlin.mjs` scheitert mit dem alten Bundle und ist mit dem neuen grün | Runtime-Test mit echtem Bundle; kein GUI-Test |
| RT-62 | `Triple` (`first`/`second`/`third`, Ausgabe `(a, b, c)`, Inhaltsvergleich), `StringBuilder` (`append`, `appendLine`, `insert`, `reverse`, `clear`, `isEmpty`, `length`, `sb[i]`, Ausgabe des Inhalts), `buildString { append(…) }` auch mit `readln()` sowie `Random.nextInt`/`nextDouble`/`nextBoolean` wie in Kotlin | 2026-10-03 beim Durchgehen bekannter Lücken. Erster Ansatz mit `StringBuilder`-Erweiterungsfunktionen scheiterte in `buildString { append("a") }` („No matching function … `append`“): Kotlite findet über den impliziten Empfänger keine Bibliotheks-Erweiterungen (auch `mutableListOf(1).apply { add(2) }` scheitert, README); die Funktionen sind deshalb Methoden der Klasse. Mit dem Bundle aus 4594330 fehlen die 15 neuen Ausdrücke in `smoke-kotlin-surface.mjs`, und der RT-62-Eingabefall in `smoke-kotlite-browser.mjs` scheitert; mit dem neuen Bundle grün (110 unterstützt) | Runtime-Tests mit echtem Bundle; kein GUI-Test. Offen: `Random(seed)`, weitere `StringBuilder`-Funktionen; die allgemeine Lücke mit dem impliziten Empfänger ist mit RT-63 behoben |
| RT-63 | Über den impliziten Empfänger werden Erweiterungsfunktionen gefunden: `liste.apply { add(1) }`, `with(liste) { add(2); size }`, `"abc".run { uppercase() }`, `with("abc") { substring(1) }`, `liste.run { map { … } }`, eigene Erweiterungen wie `gruss()` für `fun Hund.gruss()` in einer `Hund`-Methode oder einer anderen `Hund`-Erweiterung; ebenso Erweiterungs-Properties eines Obertyps (`size` für `MutableList`). Unbekannte Namen und falsche Argumenttypen behalten ihre Meldung | 2026-10-03 auf Wunsch des Nutzers (beim Bau von RT-62 gefunden). Mit dem Bundle aus 2a8429b scheiterte schon das Laden des Testprojekts („`gruss` is unknown“), `mutableListOf(1).run { size }` war auch dort schon unbekannt. Ein erster Ansatz für die Obertyp-Properties ließ das Laden der Stdlib mit „Unknown type T“ scheitern; generische Typen werden dort nun übersprungen. RT-63-Block in `smoke-curriculum-kotlin.mjs` (12 Ausdrücke, 2 Fehlermeldungen) scheitert mit dem alten Bundle und ist mit dem neuen grün | Runtime-Test mit echtem Bundle; kein GUI-Test. Abweichung: Eine passende gleichnamige Top-Level-Funktion gewinnt gegen die Funktion des Empfängers; nur der innerste Empfänger wird versucht (README, `PATCH.md`) |
| RT-64 | `data class` wie in Kotlin: `toString()` (`Punkt(x=1, y=2)`), `equals`/`hashCode` über die Konstruktor-Properties (`==`, Sets, Map-Schlüssel), `copy(…)` mit den aktuellen Werten als Vorgabe, `componentN()`; selbst deklarierte Funktionen haben Vorrang; auch generisch und im Codepad. Fehlermeldungen wie in Kotlin für keine Parameter, Nicht-Property-Parameter und `open`/`abstract`/`enum` mit Datei und Zeile. Die erzeugten Funktionen erscheinen nicht im Methodenmenü; die Vorlage „Data Class“ im Dialog „New File“ funktioniert; `data` bleibt als Name nutzbar | 2026-10-03 auf Wunsch des Nutzers. Mit dem Bundle aus 7e19b32 lehnte BlueK jede `data class` ab („A BlueK project file may contain one class …“ bzw. „`data` is unknown“), auch die vorhandene Vorlage des Dialogs. Zwischenstände: erzeugter Code begann mit Zeilenumbrüchen vor `{` („Expected token Symbol `{`“), `data` wurde am Dateianfang noch als Ausdruck gelesen. RT-64-Block in `smoke-curriculum-kotlin.mjs` und Chromium-Test RT-64 in `regressions.spec.ts` scheitern mit dem alten Bundle und sind mit dem neuen grün | Runtime-Test mit echtem Bundle und echter Browsertest. Destrukturierung seit RT-65; `componentN` ohne `operator` |
| RT-65 | Destrukturierung wie in Kotlin: `val (a, b) = …` (auch `var`, `_`, Typangaben), `for ((k, v) in map)`, `for ((i, x) in liste.withIndex())`, Lambda-Parameter `{ (k, v) -> }` in `forEach`/`map`; für `data class`, `Pair`, `Triple`, Listen (zu kurze werfen `IndexOutOfBoundsException`), Map-Einträge und `IndexedValue`; mehrere Codepad-Eingaben nacheinander; Kotlins Meldungen ohne `componentN` und im Klassenrumpf; `{ (it + 1) * 2 }` bleibt ein Ausdruck | 2026-10-03 auf Wunsch des Nutzers. Mit dem Bundle aus 62d4016 war jede Form ein Parse-Fehler („Expected token Operator `)`“), `componentN` und `withIndex` fehlten. Erst mehrdeutige Meldung bei `val (e, f) = 5` („Did you mean `component2`?“), jetzt Kotlins Wortlaut. RT-65-Block in `smoke-curriculum-kotlin.mjs` und sechs Ausdrücke in `smoke-kotlin-surface.mjs` scheitern mit dem alten Bundle und sind mit dem neuen grün | Runtime-Tests mit echtem Bundle; kein GUI-Test. Abweichung: auf oberster Ebene einer Projektdatei erlaubt (README) |
| RT-66 | `"%.2f".format(x)` und `String.format(…)` wie `java.util.Formatter` (`%d %x %X %o %f %s %S %c %b %% %n`, Breite, Genauigkeit, `%2$s`, Flags `- 0 + ,` und Leerzeichen; Rundung wie Java), immer mit `.` als Dezimalpunkt; falsche Typen und fehlende Argumente werfen `IllegalArgumentException`. Dazu: Erweiterungsfunktionen mit `vararg` nehmen beliebig viele Argumente (`fun String.f(vararg a: Int)`, vorher nur genau eines) | 2026-10-03 nach „mache erst mal weiter“ des Nutzers; Dezimalpunkt statt Sprache des Rechners als eigene, dokumentierte Entscheidung. Beim Einbau von `format` gefunden: Erweiterungen verloren `vararg`, weil sie als Kopie registriert werden. Mit dem Bundle aus 2c81dd6 fehlen die 12 neuen Ausdrücke in `smoke-kotlin-surface.mjs`, und der RT-66-Block in `smoke-curriculum-kotlin.mjs` scheitert am ersten Fall; mit dem neuen Bundle grün (128 unterstützt, 9 bekannte Lücken) | Runtime-Tests mit echtem Bundle; kein GUI-Test. Offen: `%e`, `%g`, Datumsformate, Formatierung nach Sprache |
| RT-67 | `object Name { … }` und `companion object { … }` wie in Kotlin: genau eine Instanz, beim ersten Zugriff erzeugt (`init` läuft einmal), über den Namen benutzt (`Zaehler.erhoehe()`, `Karte.MAX`, `listOf<Tier>(Hund)`, `when` mit `Hund ->`), auch mit Interfaces und Oberklasse; Companion-Mitglieder in der Klasse und in Unterklassen auch ohne Klassennamen (Zähler `init { anzahl++ }`, Default-Argument `= START`, Getter, Lambdas), vor gleichnamigen Top-Level-Deklarationen; Klasse und Companion teilen `private`; `Box.von(5)` für generische Klassen; `const val` auf oberster Ebene, in Objekten und Companions. Klassenmenü: Objekt ohne Konstruktor, Methoden von Objekt und Companion werden als `Name.f(…)` aufgerufen; der Titel des Aufrufdialogs lautet `Hund.neu()` (vorher `Hund..neu()`, bei Top-Level-Funktionen `.summe()`). Eigene Meldungen für `Name()`, benannte und doppelte Companions, Objekt-Ausdrücke und falsches `const` (verschachtelte Objekte gehen seit RT-91); Parsermeldungen markieren ihre Zeile statt der ersten Dateizeile | 2026-10-03 nach „dann weiter“ des Nutzers. Vorher waren `object`, `companion object` und `const` Parse- bzw. Top-Level-Fehler. Beim Einbau gefunden: Aufrufe auf dem Companion generischer Klassen (`Box.f()`, auch `fun Box.Companion.f()`) scheiterten schon vorher an „Number of type arguments“; ein Klassenname allein (`Karte`) brachte die Laufzeit zum Absturz. Mit dem Bundle aus 891dd9a scheitert der RT-67-Block in `smoke-curriculum-kotlin.mjs` beim Laden des Projekts, alle früheren Blöcke laufen durch | Runtime-Tests mit echtem Bundle und Browser-Test RT-67 in `tests/gui/regressions.spec.ts`. Offen: Objekt-Ausdrücke, benannte Companions, verschachtelte Klassen; ein Companion, das seine Klasse schon während deren Analyse braucht, sieht nur deren bis dahin analysierte Member |
| RT-68 | Methoden ohne Rückgabetyp dürfen vor ihrer Deklaration benutzt werden wie in Kotlin: `fun a() = b(); fun b() = 1` in einer Klasse, ein Property-Initialisierer mit einer späteren Methode (`val start = doppelt(1)`), `override fun toString() = bericht()`, Objekte, die einander aufrufen (`A.f()` → `B.g()` → `A.h()`), ein Companion, das während `init { anzahl++ }` eine Methode seiner Klasse aufruft; auch im Codepad. Nur ein Typ, der von sich selbst abhängt (`fun a() = b(); fun b() = a()`), braucht einen Rückgabetyp: „Cannot infer return type of function a, because it depends on itself“ | 2026-10-03 nach „dann los“ des Nutzers; Vorschlag aus RT-67. Vorher „Cannot infer return type of function b. Please specify types manually“. Mit dem Bundle aus 7aa917b scheitert `smoke-curriculum-kotlin.mjs` am RT-67-Block, der jetzt `fun geheim() = wert + 1` ohne Rückgabetyp enthält | Runtime-Tests mit echtem Bundle; kein GUI-Test (reine Analyse). Offen: gegenseitige Rekursion von Top-Level-Funktionen braucht einen Rückgabetyp an der zuerst analysierten; Properties einer Klasse in Analyse nur, soweit analysiert |
| RT-69 | Eine Methode der eigenen Klasse lässt sich ohne `this.` in Lambdas aufrufen, die eine Bibliotheksfunktion ausführt: `map { laut() + it }` (auch überschrieben in einer Unterklasse), `filter { gerade(it) }`, verschachtelte Lambdas, `apply { add(gross()) }`, `sortedBy { … }` in einem Property-Initialisierer, `forEach { s += mal10(it) }` mit `private`-Methode, zurückgegebene Lambdas, geerbte Methoden, in Companions und Objekten | 2026-10-03 beim Prüfen von RT-68 gefunden. Vorher scheiterte der Aufruf zur Laufzeit mit „Function `…` not found on implicit receiver“, auch mit dem Bundle aus 891dd9a; mit dem Bundle aus 1724af8 scheitert der RT-69-Block in `smoke-curriculum-kotlin.mjs` am ersten Fall | Runtime-Tests mit echtem Bundle; kein GUI-Test. Daneben gefunden, offen: eine Property vom Funktionstyp lässt sich nicht als `objekt.f()` aufrufen (`val f = objekt.f; f()` geht) |
| RT-70 | Eine Klasse bleibt nach „Format Kotlin file“ compilierbar: Zeilenumbruch nach `=` in Property-Deklarationen (`val symbol =` mit dem `when` in der nächsten Zeile, auch auf oberster Ebene und lokal) und bei benannten Argumenten (`f(a =` …) | 2026-10-04 vom Nutzer gemeldet: die Klasse `Karte` compilierte, nach dem Formatieren „Line 27: Unexpected token Token(type=NewLine …)“. Mit dem Bundle aus a09d104 zeigt der Browser-Test RT-70 genau diese Meldung (Zeile 23 der Testklasse), der RT-70-Block in `smoke-curriculum-kotlin.mjs` scheitert beim Laden; mit dem neuen Bundle beide grün. Weitere typische Umbrüche des Formatierers (Aufrufketten, `&&`/`+` am Zeilenende, `?:` am Zeilenanfang, mehrzeilige `when`-Bedingungen, nachgestellte Kommas) liefen schon vorher | Runtime-Test und Browser-Test RT-70 (formatieren, schließen, compilieren, aufrufen) |
| RT-71 | `printStackTrace()` und `stackTraceToString()` zeigen den Stack wie Kotlin, innen zuerst mit Funktion und erreichter Zeile der Projektdatei: `at Karte.pruefe(Karte.kt:6)`, `at Karte.wert(Karte.kt:3)`, `at main(Main.kt:3)`, Konstruktoren als `Karte.<init>`, Objekte als `Z.f`, Lambdas als `<lambda>`; Bibliotheksfunktionen als `toInt(Kotlin library)`, `map(Kotlin library)`; im Codepad deklarierte Funktionen als `g(Codepad)`, die Codepad-Zeile selbst fehlt. Auch Ausnahmen aus Bibliothekscode (`10 / 0`, `"x".toInt()`) haben Frames. `stackTraceToString()` liefert denselben Text wie `printStackTrace()` | 2026-10-04 nach „weiter mit den Stacktraces“ des Nutzers. Vorher `at pruefe (<BlueK project>:11:22)` mit der Aufrufstelle im zusammengesetzten Quelltext, Bibliotheksausnahmen ohne Frames, `stackTraceToString()` nur mit den Frames. Mit dem Bundle aus c65c68d scheitert `smoke-curriculum-kotlin.mjs` schon an der angepassten RT-38-Erwartung (`at toInt(Kotlin library)` fehlt); mit dem neuen Bundle grün einschließlich RT-71-Block | Runtime-Tests mit echtem Bundle; kein GUI-Test. Offen: nicht gefangene Ausnahmen meldet die GUI nur mit Klasse und Meldung, ohne Stack; kein `Caused by:` |
| RT-73 | `error("Meldung")` wirft wie in Kotlin eine `IllegalStateException` mit der Meldung (auch `error(42)`); Rückgabetyp `Nothing`, also `?: error("…")` und `if (…) 1 else error("…")` | 2026-10-04 beim Testen von RT-71 gefunden: `error` war unbekannt. Mit dem Bundle aus 6e40ce1 fehlen die vier neuen Ausdrücke in `smoke-kotlin-surface.mjs`, mit dem neuen Bundle grün (132 unterstützt) | Runtime-Test `smoke-kotlin-surface.mjs` |
| RT-74 | Zahlliterale wie in Kotlin: Exponent (`1.5e3`, `2E-3`, `1e10`, `6.02E+23`, `1e2f`), hexadezimal (`0xFF`, `0xFFL`), binär (`0b1010`), `_` zwischen Ziffern (`1_000_000`, auch in `const val`); ganzzahlige Literale sind `Int`, wenn sie passen, sonst `Long` (`0xFFFFFFFF`). `1_` und `0x` sind Fehler | 2026-10-04, offener Punkt aus RT-67. Vorher Parsefehler; mit dem Bundle aus 9a357fd scheitert der RT-74-Block in `smoke-curriculum-kotlin.mjs` beim Laden. Mit dem neuen Bundle grün | Runtime-Test. Offen: `.5` ohne führende Ziffer, Bit-Operationen |
| RT-75 | Properties mit Funktionstyp lassen sich wie Methoden aufrufen: `objekt.f()`, `this.f()`, `f()` in der Klasse (auch in Lambdas), `k?.f()`, `Klasse.fabrik(7)` aus dem Companion, `k.f.invoke()`; Anzahl und Typen der Argumente werden geprüft | 2026-10-04 beim Prüfen von RT-69 gefunden. Vorher meldete `k.f()` „`f` is unknown for K“, `f()` in der Klasse scheiterte zur Laufzeit mit „Class Function `f` not found“. Zwischenstand: eine Vorab-Analyse des Empfängers jedes `objekt.f(…)` analysierte ihn doppelt und brach RT-65 (Destrukturierung in Lambdas) und einen Generics-Test; jetzt erst nach gescheiterter Methodensuche. Mit dem Bundle aus af66836 scheitert der RT-75-Block beim Laden | Runtime-Test. Offen: `.invoke()` auf einem zusammengesetzten Empfänger (`K(4).f.invoke()`) |
| RT-76 | Überschreibungen dürfen einen spezielleren Rückgabetyp haben: `override fun nachwuchs(): Hund` für `open fun nachwuchs(): Tier`, `String` für `Any`, `String` für `String?`, bei Interface-Funktionen und mit abgeleitetem Typ (`override fun alter() = 3` für `Any`); ein allgemeinerer Typ bleibt ein Compilefehler | 2026-10-04, offener Punkt aus RT-57. Vorher „Return type … is not the same as the overridden one“; mit dem Bundle aus 8990a6a scheitert der RT-76-Block beim Laden | Runtime-Test; Properties mit spezielleren Typen gehen ebenfalls (`override val laut: String` für `Any`, geprüft mit RT-77) |
| RT-77 | Ein Objekt mit überschriebener Property (`open val laut` / `override val laut`) bleibt im Codepad benutzbar: `val t: Tier = Hund(); t.laut`, `listOf<Tier>(Hund(), Tier()).map { it.laut }`; der Inspektor zeigt die überschriebene Property einmal mit ihrem Wert | 2026-10-04 beim Prüfen von RT-76 gefunden. Vorher brach jede Codepad-Eingabe, die ein solches Objekt in einer Variable hielt, mit „DuplicateKeyException: Duplicate key while merging maps“ ab (BlueKs Erreichbarkeitsprüfung führte die Properties aller Objektteile als Map zusammen), auch bei gleichem Typ und mit dem Bundle aus 891dd9a; in Funktionen ging es. Mit dem Bundle aus 6b29ca2 scheitert der RT-77-Block | Runtime-Test |
| RT-78 | Enums wie in Kotlin: Einträge geben ihren Namen aus (`println(Farbe.HERZ)` → `HERZ`, ein eigenes `toString()` hat Vorrang), `name`, `ordinal`, `values()` (als Liste), `valueOf()`, Member nach `;` (Properties mit Getter, Funktionen, `when (this)` mit Einträgen ohne Klassennamen und ohne `else`), `name` auch ohne `this.`; `Farbe("X")` ist ein Compilefehler; das Klassenmenü zeigt für Enums keinen Konstruktor (`kind: "enum"`) | 2026-10-04 beim Sondieren offener Punkte gefunden: vorher druckte `println(Farbe.HERZ)` `Farbe()`, `name`/`ordinal`/`values()` waren unbekannt, `HERZ("♥");` war ein Parsefehler und `Farbe("X")` legte einen neuen Eintrag an. Mit dem Bundle aus 9f0ccb0 scheitert der RT-78-Block beim Laden | Runtime-Test. Offen: `<`/`compareTo`, Einträge mit eigenem Rumpf, `companion object` in Enums |
| RT-79 | Interfaces mit Methoden mit Rumpf (`fun beschreibung() = "$name: ${flaeche()}"`, ruft überschriebene Methoden der Klasse) und abstrakten Properties (`val name: String`), abstrakte Properties in abstrakten Klassen (`abstract val laut: String`, von Methoden der abstrakten Klasse lesbar); implementiert auch als Konstruktor-Property (`class Hund(override val beine: Int)`); Zugriff über den Obertyp; fehlende Implementierungen, Anfangswerte bei abstrakten bzw. Interface-Properties sind Compilefehler; der Inspektor zeigt die implementierten Properties | 2026-10-04, offener Punkt der README (wichtig für den OOP-Unterricht). Vorher „Expected token Symbol `{`“, „Properties in interfaces are not supported“ bzw. „Modifier `abstract` cannot be applied to properties“; mit dem Bundle aus 06304ce scheitert der RT-79-Block beim Laden | Runtime-Test. Offen: Interface-Properties mit Getter, Extension-Properties mit Getter |
| RT-80 | `protected` an Properties, Funktionen und Konstruktor-Properties: in der Klasse, in Unterklassen und deren Companions benutzbar, von außen ein Compilefehler („Protected property/function … cannot be accessed here“); `internal` an Klassen und Membern wirkt wie `public`. Manifest meldet `protected`; Objektmenüs zeigen `protected`-Methoden nicht, der Inspektor bearbeitet `protected`-Felder nicht | 2026-10-04, offener Punkt der README. Vorher Parsefehler; `smoke-kotlite-browser.mjs` erwartete ausdrücklich die Ablehnung von `protected` und prüft jetzt den Zugriffsfehler. Mit dem Bundle aus 17e430b scheitert der RT-80-Block beim Laden | Runtime-Tests; Objektmenü-Filter in `objectMenuMethods.ts` ohne eigenen Browser-Test |
| RT-81 | `lateinit var` bei Klassen-Properties: Zuweisung später, Lesen vorher wirft `UninitializedPropertyAccessException: lateinit property x has not been initialized` (mit `catch` fangbar), der Inspektor zeigt `<uninitialized>`; Kotlins Regeln (nur `var`, ohne Anfangswert, nicht nullable, nicht primitiv) als Compilefehler | 2026-10-04, offener Punkt der README. Vorher Parsefehler; beim Einbau gefunden: ein nicht belegtes Feld brachte `inspect()` mit einer Host-Ausnahme zum Absturz. Mit dem Bundle aus 39b28cd scheitert der RT-81-Block beim Laden | Runtime-Test. Offen: `lateinit` auf oberster Ebene und lokal, `::x.isInitialized` |
| RT-82 | Eine nicht gefangene Exception beendet nur den Aufruf; die Laufzeit bleibt ohne Reset benutzbar (Objektbank, Codepad, Variablen, `main()`, BluePlay), wie in BlueJ. Kein Rollback: Änderungen vor der Exception bleiben. Methodenaufruf und Konstruktor zeigen den Dialog „Exception“ („The call ended with an exception.“) statt „Compiler errors“; das Codepad zeigt sie im Eintrag. `main()`, BluePlay-`main` und `act()` schreiben sie wie Kotlin rot ins Terminal: `Exception in thread "main" IllegalArgumentException: …` mit `at Karte.wert(Karte.kt:6)` usw.; Run hält an. Fatal (Reset nötig) bleiben nur Interpreterfehler wie `InterpreterStateException` | 2026-10-04 vom Nutzer gemeldet (Screenshot: `karte1.wert()` mit Rang 70, danach „Execution stopped. Reset the runtime“, Dialogtitel „Compiler errors“); Codepad ausdrücklich gewünscht. Browser-Test RT-82 grün, mit dem alten Stand rot; BluePlay-Fall in `smoke-runtime-state.mjs` grün, mit altem Bundle und Host rot. Angepasst: `smoke-blueplay-api.mjs` (fehlende Welt war fatal), `smoke-runtime-state.mjs` (direkter Getter-Aufruf war fatal) und EXP-03 (der exportierte Player zeigt den Stacktrace jetzt auch im Terminal, zusätzlich zu „The program stopped“) | Browser-Test RT-82, `smoke-runtime-state.mjs`, `smoke-blueplay-api.mjs` |
| RT-83 | Sekundäre Konstruktoren mit `: this(…)`, auch neben einem Primärkonstruktor: `class Hund(val name: String, val alter: Int) { constructor(name: String) : this(name, 1) }`. Die Delegation läuft zuerst (Property-Initialisierer und `init` des Primärkonstruktors), dann der Rumpf; Ketten über mehrere Konstruktoren, Standard- und benannte Argumente, generische und `data`-Klassen, Unterklassen und abstrakte Klassen. Rumpf optional. Wie Kotlin: „Primary constructor call expected“, „There's a cycle in the delegation calls chain“ (auch `this(s)` auf sich selbst), „Conflicting overloads“; `: super(…)` mit eigener Meldung. Die Klassenkarte bietet Primär- und Sekundärkonstruktoren an. Bei Überladungen gewinnt wie in Kotlin der Kandidat ohne Standardwerte (`Punkt(1, 2)`, `f(1)`) | 2026-10-04 offener Punkt der README, auf Wunsch des Nutzers bearbeitet. Testblock RT-83 in `smoke-curriculum-kotlin.mjs` grün, mit dem Bundle aus 80ca0d6 rot; Browser-Test RT-83 (Klassenmenü mit drei Konstruktoren, Erzeugen über zwei davon) grün, mit altem Bundle rot. `smoke-kotlite-browser.mjs` erwartete die alte Ablehnung und prüft jetzt die Delegation an einen fehlenden Konstruktor | `smoke-curriculum-kotlin.mjs`, `smoke-kotlite-browser.mjs`, Browser-Test RT-83 |
| RT-84 | Enum-Einträge vergleichen sich wie in Kotlin nach ihrer Reihenfolge: `Rang.ZWEI < Rang.DREI`, `compareTo`, `sorted()`, `sortedDescending()`, `minOrNull()`, `filter { it > Rang.DREI }`, `Rang.DREI..Rang.ASS`; Enum-Klassen dürfen Interfaces implementieren (`enum class Rang(val wert: Int) : Bewertet`), aber keine Klasse erweitern; ein eigenes `compareTo` ist wie in Kotlin verboten. Klassenkarte und Menüs zeigen das implizite `Comparable` und das erzeugte `compareTo` nicht | 2026-10-04 offener Punkt der README. Testblock RT-84 in `smoke-curriculum-kotlin.mjs` grün, mit dem Bundle aus 067f8dd rot (Enum mit Interface abgelehnt, `<` unbekannt) | `smoke-curriculum-kotlin.mjs` |
| RT-85 | Schleifen mit Label wie in Kotlin: `aussen@ for (…)`, `while`, `do … while`; `break@aussen` beendet, `continue@aussen` setzt die äußere Schleife fort, auch aus `when` und aus inneren Schleifen; in Methoden und im Codepad. Ein unbekanntes Label ist ein Analysefehler („There is no loop with the label `y`“) | 2026-10-04 offener Punkt der README. Testblock RT-85 in `smoke-curriculum-kotlin.mjs` grün, mit dem Bundle aus 91bc49c rot (Parsefehler) | `smoke-curriculum-kotlin.mjs` |
| RT-86 | `sealed class` und `sealed interface`: die sealed Klasse ist abstrakt; ein `when` ohne `else` ist erschöpfend, wenn `is`-Zweige und `object`-Einträge alle Unterklassen abdecken, auch verschachtelt (`sealed interface Ergebnis` mit `data class Ok` und `sealed class Fehler` mit `object Zeit`) und mit `null` bei nullbarem Subjekt; fehlt eine Unterklasse, bleibt es ein Compilefehler. Unterklassen dürfen in jeder Datei stehen (ein Modul) | 2026-10-04 offener Punkt der README. Testblock RT-86 in `smoke-curriculum-kotlin.mjs` grün, mit dem Bundle aus 77cf4b6 rot (`sealed` unbekannt) | `smoke-curriculum-kotlin.mjs` |
| RT-87 | Bit-Operationen wie in Kotlin für `Int` und `Long`: `and`, `or`, `xor`, `shl`, `shr`, `ushr` als Infix (auch `5.and(3)`) und `inv()`; Rangfolge wie Kotlin (`1 + 2 shl 1` ist `6`, `bits and 1 == 1` ist `(bits and 1) == 1`). Zahlliterale ohne führende Ziffer: `.5`, `.25e2`; `1..5` bleibt ein Bereich | 2026-10-04, offene Punkte der README und aus RT-74. Fälle in `smoke-kotlin-surface.mjs` grün, mit dem Bundle aus c9a3996 rot | `smoke-kotlin-surface.mjs` |
| RT-88 | `lateinit var` auch für lokale Variablen in Funktionen, Top-Level-Variablen und im Codepad; Lesen vor der Zuweisung wirft wie Kotlin `UninitializedPropertyAccessException: lateinit property x has not been initialized` (fangbar); Kotlins Regeln (nur `var`, kein primitiver oder nullbarer Typ) gelten weiter | 2026-10-04 offener Punkt der README (Rest aus RT-81). Testblock RT-88 in `smoke-curriculum-kotlin.mjs` grün, mit dem Bundle aus c9a3996 rot („supported for class properties only“) | `smoke-curriculum-kotlin.mjs` |
| RT-89 | Funktionsreferenzen wie in Kotlin: `liste.map(::quadrat)`, `filter(::istGerade)`, `reduce(::summe)`, `forEach(::println)`, `val f = ::quadrat`, `String::length`, `String::uppercase`, `sortedBy(Karte::wert)`, `Karte::doppelt`, `map(::Karte)`, `liste::add`, `this::mal`; die Parameter kommen aus dem erwarteten Funktionstyp. `::println` ohne Typ und unbekannte Namen geben eine verständliche Meldung. Nicht: Ausdrücke vor `::` (`Rechner(10)::mal`) | 2026-10-04 offener Punkt der README. Testblock RT-89 in `smoke-curriculum-kotlin.mjs` grün, mit dem Bundle aus c4bccad rot (Parsefehler) | `smoke-curriculum-kotlin.mjs` |
| RT-90 | `this` in einem Lambda ist wie in Kotlin das Objekt, in dem das Lambda steht: `liste.map { this.f(it) }`, `forEach { this.summe += … }`, `filter { this.f(it) > 3 }`, auch verschachtelt; Lambdas mit Empfänger (`buildString { this.length }`, `apply { this.size }`) unverändert. Vorher war `this` die Liste („Class Function `mal` not found“, NullPointerException) | 2026-10-04 beim Prüfen von RT-89 (`this::mal`) gefunden. Testblock RT-90 in `smoke-curriculum-kotlin.mjs` grün, mit dem Bundle aus c4bccad rot | `smoke-curriculum-kotlin.mjs` |
| RT-91 | Verschachtelte Klassen wie in Kotlin: `class Liste { class Knoten(val wert: Int, val naechster: Knoten?) }` mit `Knoten` innerhalb und `Liste.Knoten` außerhalb (Konstruktor, Typ, `is`), auch vor ihrer Deklaration benutzt; verschachtelte Enums, Interfaces, Objekte, `data class`- und `sealed`-Unterklassen (`is Form.Kreis` ohne `else`), generisch und über zwei Ebenen (`O.N.M`); `private` außerhalb abgewiesen; im Codepad, in `main`; eine gleichnamige Klasse auf oberster Ebene bleibt außerhalb erreichbar. Eine Datei zeigt weiter eine Klassenkarte | `smoke-curriculum-kotlin` (RT-91, 21 Ausdrücke, Manifest, Fehlermeldungen); Chromium `RT-91 RT-92 nested and inner classes …` (eine Karte, Codepad, Objektbank, Inspektor) | Runtime- und echter Browsertest grün |
| RT-92 | Innere Klassen (`inner class`) benutzen Properties und Methoden des äußeren Objekts, auch schreibend und in `init`, `this@Liste` und `this@Laeufer`, innere in inneren Klassen, Lambdas darin, generische äußere Klassen; ein Objekt entsteht nur im Code der äußeren Klasse (sonst Kotlins Meldung), `inner` auf oberster Ebene und sekundäre Konstruktoren abgewiesen; `inner` bleibt als Name benutzbar. Die versteckte Referenz auf das äußere Objekt erscheint weder als Property noch als Konstruktorparameter | `smoke-curriculum-kotlin` (RT-92); Chromium `RT-91 RT-92 …` (Inspektor des inneren Objekts zeigt nur `aktuell`, Methode aufrufbar) | Runtime- und echter Browsertest grün; `liste.Laeufer()` von außen und der Typ `Stapel<String>.Zeiger` nicht unterstützt |
| RT-93 | Generische Klassen wie im Unterricht: `class Stapel<T> { private val elemente = mutableListOf<T>() }`, `class Box<T>(val inhalt: List<T>)`, `class Lager<K, V>` mit `MutableMap<K, MutableList<V>>`, `List<List<T>>` mit dem Typparameter `T`; `emptyList()`/`emptySet()` mit Typ aus Deklaration, `?:`, `return` oder Ausdrucksrumpf; falscher Typ (`Box<Int>(listOf("x"))`) abgewiesen, Rückgabe-Fehlermeldungen mit Typargumenten | `smoke-curriculum-kotlin` (RT-93, 10 Ausdrücke, 2 Fehlermeldungen), `smoke-kotlin-surface` (4 Ausdrücke) | Runtime-Tests grün; Typargumente aus Lambda-Ergebnissen (`getOrPut(k) { mutableListOf() }`) weiter offen; `sumOf` mit `Double` seit RT-95 |
| RT-94 | String als Zeichenfolge wie Kotlins `CharSequence`: `ifBlank { }`, `ifEmpty { }`, `replaceFirstChar { }`, `indexOf`/`lastIndexOf` mit `Char`, `map`, `mapIndexed`, `find`, `findLast`, `single { }`, `sumOf`, `groupBy`, `associateWith`, `toSet`, `toMutableList`, `chunked`, `windowed`, `maxOrNull`/`minOrNull`, `elementAt`, `withIndex`, `trimIndent`, `trimMargin`, `toLong(OrNull)`; `Char.digitToIntOrNull`, `Int.mod`/`rem`/`toString(radix)`/`toFloat`, `Long.MAX_VALUE`/`MIN_VALUE`. `toCharArray()` nennt die Alternative | 2026-10-05 vom Nutzer gemeldet (`ifBlank` fehlte). `smoke-kotlin-surface` (RT-94, 34 Ausdrücke) grün, mit dem Bundle aus 1b47dff rot | `smoke-kotlin-surface.mjs` |
| RT-95 | Vergleicher und Sammlungen: `Comparator<T>` mit `compareBy` (1–3 Selektoren), `compareByDescending`, `naturalOrder`/`reverseOrder`, `Comparator<T> { a, b -> }`, `thenBy(Descending)`, `reversed`, `compare`; `sortedWith` (auch mit Lambda), `sortWith`, `maxWith`/`minWith`; generisches `sumOf` (`Int`/`Long`/`Double`), `slice`, `zipWithNext`, `ifEmpty`, `add(index, x)`, `addFirst`/`addLast`, `reverse`, `removeIf`, `associateBy` (vorher immer mehrdeutig), `putAll`, `toSortedMap`, `emptyMap`, `hashMapOf`, `HashMap()`, `ArrayList()`, `arrayListOf`, `hashSetOf`, `Set.random`, `measureTimeMillis`. Typvariable eines Vergleichers aus der Deklaration | 2026-10-05 Stdlib-Prüfung mit über 500 Ausdrücken (`ifBlank`-Meldung des Nutzers). `smoke-kotlin-surface` (RT-95, 31 Ausdrücke; `sortedWith(compareBy { … })` ohne Typargument als bekannte Lücke) grün, mit dem Bundle aus 1b47dff rot | `smoke-kotlin-surface.mjs`; Typargument im Argument eines anderen Aufrufs weiter nötig (README) |
| RT-96 | Arrays wie in Kotlin: `arrayOf`, `intArrayOf`/`booleanArrayOf`/… , `Array(n) { }`, `IntArray(n)` mit Nullwerten, `arrayOfNulls`, `toTypedArray`/`toIntArray`, `toCharArray`; `a[i] = x` mit Grenzprüfung, feste Größe (kein `add`), `sort`/`sortBy`/`sortedArray`, `fill`, `reverse`, `copyOf`, `a + x`, `contentToString`/`contentEquals`, `==` als Identität; mehrdimensional `Array(2) { IntArray(3) }`; alle Listenfunktionen (`sum`, `indices`, `for`, `in`, `map`). `fun main(args: Array<String>)` startet mit leerem Array. `Array<Int>` und `IntArray` bleiben verschieden | 2026-10-05 vom Nutzer gemeldet (KI-Code mit `booleanArrayOf`). `smoke-kotlin-surface` (RT-96, 26 Ausdrücke, 2 Meldungen) grün, mit dem Bundle aus 41edf7a rot; Chromium `RT-96 arrays run in main(args) …` (main mit `args`, `booleanArrayOf`, Objekt mit `IntArray`-Property im Inspektor) grün, mit altem Bundle rot | Runtime- und echter Browsertest grün; Spread-Operator `f(*a)` und `String(chars)` fehlen; Arrays sind in BlueK zugleich `List` |
| RT-97 | Gefunden mit den offiziellen Kotlin-Compilertests: `zaehler[i]++` und `--a[i]` (Listen, Arrays, Maps) laufen statt `UnsupportedOperationException`; `liste[0].punkte += 1` und `f().x += 1` statt NullPointerException; das Ziel von `=`, `+=`, `++` wird einmal und vor der rechten Seite ausgewertet (`h[(0..5).random()] += 1` zählt jeden Wurf genau einmal); `public` als Modifier; `RuntimeException` mit Kotlins Hierarchie (auch als Oberklasse eigener Ausnahmen), `ClassCastException` für gescheitertes `as`, `ConcurrentModificationException`, `AssertionError`, `NotImplementedError` (`TODO()`) | 2026-10-05 Konformitätsversuch auf Wunsch des Nutzers. `smoke-curriculum-kotlin` (RT-97, 12 Ausdrücke, `main` mit Würfelstatistik 600/300) grün, mit dem Bundle aus 3dc2527 rot; `npm run test:conformance`: 815 von 2.453 Tests im Umfang bestehen (vorher 734), keiner schlechter | Runtime-Tests grün; Konformität als eigener Lauf (nicht in `test:regression`); bekannte Abweichungen (Companion-`init`, Interface-Raute) in der README |
| RT-98 | Smart Cast nach `isNullOrEmpty()`/`isNullOrBlank()` wie Kotlins Contracts: `return if (eingabe.isNullOrEmpty()) standard else eingabe` mit `eingabe: String?` compiliert, ebenso `if (!l.isNullOrEmpty()) l.size`, `||`-Ketten, `when` ohne Subjekt und frühes `return`; im `true`-Zweig bleibt der Typ nullbar | 2026-10-06 vom Nutzer gemeldet (Blackjack-Projekt, „Expected type is `String`, but actual type is `String?`“). `smoke-curriculum-kotlin` (RT-98, 5 Ausdrücke, 1 Ablehnung) grün, mit dem Bundle aus 76f1b3e rot | `smoke-curriculum-kotlin.mjs` |
| RT-99 | Smart Casts wie in Kotlin: nach `x ?: return` (und `val y = x ?: return` hat den Typ von `x`), `x!!`, `x as T`, `requireNotNull`, `require`/`check`, Zuweisung (`s = "neu"`, auch in einem Zweig von `if (s == null)`), Eingabeschleife `while (zahl == null) { … }`, `person.adresse` bei `val`-Properties; abgelehnt bleiben `var`-Properties, Zuweisung von `null`, nur einseitige Zuweisung, Schleifen mit `break`. `for` über eine Liste mit `null`-Elementen läuft (stürzte ab) | 2026-10-06 auf Wunsch des Nutzers systematisch geprüft (60 akzeptierte, 24 abgelehnte Kotlin-Fälle; vorher 36 bzw. alle 24). `smoke-curriculum-kotlin` (RT-99, 17 Ausdrücke, 7 Ablehnungen) grün; Konformität 819 statt 815 (Baseline erneuert), mit dem Bundle aus 76f1b3e scheitern die Sonden (u. a. `for` über `listOf("a", null)`) | `smoke-curriculum-kotlin.mjs`; offen: `this is T` in Erweiterungen, `this.eigenschaft`, `is` auf `T`, Safe-Call-Bedingungen (README) |
| RT-100 | Typargumente wie in Kotlin aus dem äußeren Aufruf und dem erwarteten Lambda-Ergebnis: `personen.sortedWith(compareBy({ it.alter }, { it.name }))`, `compareBy { … }.thenBy { … }`, `compareByDescending`, `sortWith`/`maxWith(compareBy { … })`, `sortedWith(reverseOrder())`, `map.getOrPut(k) { mutableListOf() }`/`mutableSetOf()`, `ifEmpty { emptyList() }`, `f(mutableListOf())`, `f(mapOf())`, `Pair(emptyList(), 1)` mit deklariertem Typ; falsche Argumente (`mutableListOf(1).add("x")`) bleiben abgelehnt | 2026-10-06 auf Wunsch des Nutzers (häufig in KI-generiertem Code). `smoke-kotlin-surface` (RT-100, 13 Ausdrücke) grün, mit dem Bundle aus cb851d2 rot (13 Fehlschläge); `smoke-curriculum-kotlin` und `smoke-generics-boundaries` fingen zwei Zwischenstände ab; Konformität 819/819 der Baseline | `smoke-kotlin-surface.mjs`; offen: Zweige eines `if`-Ausdrucks als Quelle des erwarteten Typs |

| GUI-93 | Objekt-Kontextmenüs und geerbte Methoden-Untermenüs liegen über offenen Inspektoren und bleiben anklickbar; Parameterdialoge liegen weiterhin darüber | Chromium GUI-93 erzeugt tatsächliche Überlappungen mit einem verschobenen Inspektor, prüft den vordersten DOM-Treffer, öffnet den Parameterdialog und ruft eine geerbte Methode auf. Vor der Korrektur rot, nachher grün; GUI-49/82/85/87 ebenfalls grün | Automatisch im echten Browser abgesichert; keine separate visuelle Benutzerabnahme |
| GUI-94 | Reset erhält den maximierten bzw. wiederhergestellten Zustand des BluePlay-Weltfensters | Chromium GUI-94 wechselt die angezeigte Welt, maximiert und setzt zurück; prüft die erneut erzeugte ursprüngliche Welt und unveränderte Fenstergrenzen, danach Reset bei normaler Fenstergröße | Vor der Korrektur rot, danach grün; GUI-57 und beide RT-25-BluePlay-Reset-Tests ebenfalls grün; keine gesonderte visuelle Benutzerabnahme |
| GUI-95 | Methodenmenüs zeigen den Rückgabetyp in Kotlin-Schreibweise hinter den Parametern (`give(): Int`, `first<T>(items: List<T>): T`), ohne `: Unit`; gilt für direkte und geerbte Objektmethoden sowie Funktionen im Dateimenü. Hinweise wie `[redefined in …]` folgen danach | 2026-10-02 auf Wunsch des Nutzers (vorher `Int give()`). Chromium GUI-95 prüft Objektmenü, Untermenü „inherited from Person“ und Dateimenü einer Funktionsdatei; mit der alten Beschriftung rot, danach grün; GUI-49 und GUI-93 ebenfalls grün | Echter Browsertest; visuelle Abnahme durch den Nutzer offen |
| GUI-96 | Das Ergebnisfenster eines Methodenaufrufs („Method result“) liegt vor einem offenen Editor; ebenso die Compilerfehler- und die Share-Link-Meldung (alle `topmost-modal` wie die übrigen Dialoge) | 2026-10-04 vom Nutzer gemeldet (Screenshot auf bluek.de: Ergebnis hinter `Karte.kt`). Browser-Test GUI-96 grün; ohne `topmost-modal` am Ergebnisfenster rot (die Mitte des Ergebnisfensters gehört zum Editor) | Browser-Test GUI-96 (Methode am Objekt der Objektleiste bei offenem Editor); Compilerfehler- und Share-Link-Dialog nur per Code-Durchsicht, ohne eigenen Test |
| GUI-97 | Das Terminal wertet ANSI-Escape-Sequenzen und Steuerzeichen wie ein Terminal aus: Farben (16 Grundfarben, 256 Farben, RGB) für Schrift und Hintergrund, fett, blass, kursiv, unterstrichen, durchgestrichen, invertiert, verborgen; `ESC[2J`/`ESC[H` löschen, `ESC[K`/`ESC[J` löschen Zeilen- bzw. Bildschirmteile, Cursorbewegung (`H`, `A`–`G`, `s`/`u`), `\r` überschreibt die Zeile, `\b`, `\t` bis zum nächsten Tabulator; andere Sequenzen und Steuerzeichen werden verschluckt. Helles und dunkles Design mit eigener Palette (VS-Code-Farben). Nutzerdoku: `docs/terminal.md` | 2026-10-04 vom Nutzer gewünscht (Spielkarte mit roten Herzen). Browser-Test GUI-97 mit der Karte des Nutzers, `\r`, Löschen, fett und dunklem Design grün; mit der alten Terminaldarstellung rot (rohe ESC-Zeichen im Text). `smoke-ui-behavior.mjs` prüft Parser-Fälle | Browser-Test GUI-97, Node-Test in `smoke-ui-behavior.mjs`. Offen: kein fester Bildschirm (Zeile 1 = erste Zeile seit dem Löschen), kein Blinken |
| GUI-98 | Große und kleine Schrift im Terminal über das Text-Sizing-Protokoll von kitty (`ESC]66;s=…:n=…:d=…:w=…:v=…:h=…;Text BEL` bzw. `ESC \`): der Text belegt `s` Zeilen und `s`×Zeichen bzw. `s`×`w` Zellen, überdeckt die Zeilen darunter, der Cursor bleibt rechts daneben in der obersten Zeile; Schreiben in oder Löschen einer seiner Zellen entfernt ihn ganz; ungültige Werte gelten als Standard; DEC-Zeilen doppelter Höhe (`ESC#3/#4/#6`) bewusst nicht. Gleiche Darstellung im exportierten Player (EXP-12). Nutzerdoku: `docs/terminal.md` | 2026-10-04 vom Nutzer gewünscht (Spielkarte als Unicode-Zeichen mehrere Zentimeter hoch); nach kurzer Recherche (DEC vs. kitty) für kitty OSC 66 entschieden. Browser-Test GUI-98 (Herz-Ass mit `s=7`: Block 7 Zeilen hoch, Text daneben und 7 Zeilen tiefer an der richtigen Stelle) grün, mit dem alten Parser rot; Player-Test EXP-12 (Größe) grün; Node-Fälle in `smoke-ui-behavior.mjs` grün, mit dem alten Parser rot | Browser-Tests GUI-98 und EXP-12, Node-Test in `smoke-ui-behavior.mjs`. Ungetestet: Darstellung in Safari/Firefox (`lh`-Einheit ab Safari 16.4/Firefox 120) |
| GUI-99 | Der Anfasser zwischen BlueK und dem rechts angedockten Terminal liegt im Stapel des Terminalfensters: Ein Objektinspektor (oder jedes andere Fenster), der vor dem Terminal liegt, verdeckt ihn; ziehen am Anfasser aktiviert das Terminal nicht. Ersetzt die Einzelregeln für aktive Editoren (GUI-37) und das BluePlay-Weltfenster (GUI-73) | 2026-10-04 vom Nutzer gemeldet (Screenshot: Anfasser über dem Inspektor von `karte1`). Browser-Test GUI-99 grün, mit dem alten Stand rot; GUI-37, GUI-73 (prüft jetzt die Ebene des Terminals) und GUI-06 grün | Browser-Tests GUI-99, GUI-37, GUI-73, GUI-06 |
| GUI-100 | Konstruktor- und Methodendialog zeigen den Aufruf als Code wie BlueJ: `Karte(` und je Parameter ein Feld untereinander, getrennt mit `,` und abgeschlossen mit `)`; Name und Typ stehen als Platzhalter im Feld (`farbe: String`, mit Standardwert `bonus: Int = …`) und verschwinden beim Tippen; die Konstruktorauswahl steht in einer eigenen Zeile und wechselt die Felder; Methoden zeigen `karte1.wert(`. Labels der Dialoge im dunklen Design lesbar (vorher `#333` auf Dunkelgrau) | 2026-10-04 vom Nutzer gewünscht (Screenshot des BlueJ-Dialogs „new Karte( … )“). Browser-Test GUI-100 grün, mit dem alten Dialog rot; im Dev-Server hell und dunkel angesehen | Browser-Test GUI-100, GUI-47, RT-67, RT-83 |

## Prüfprotokoll

### BluePlay-API gegen das GitHub-BlueJ-Projekt geprüft (2026-09-30)

Referenz ist ausschließlich `tomkarp/BluePlay` bei
`c8ace580f0506571fc34f287280a3e04eba7c876`, einschließlich `docs/README.md`
und der Kotlin-Dateien des dortigen BlueJ-Projekts. BlueK-interne
Frameworkdateien sind keine unabhängige Referenz. Der vollständige Abgleich
mit reproduzierten Fehlern und Grenzen der Prüfung steht in
[blueplay-api-audit.md](blueplay-api-audit.md).

Geprüft wurde das bestehende Bundle aus BlueK-Stand `21bc5cc` durch
einmalige Node/VM-Proben. GUI und Laufzeit wurden nicht geändert;
kein neuer Kotlin-Build war erforderlich. Die zehn Compilefehler sind
festgestellte Konformitätsfehler, keine bestandenen Konformitätstests.
Die übrigen Proben zeigen unter anderem zu weit gefasste Typen und
zusätzliche Funktionen. Keine neue Nutzerbestätigung oder visuelle Abnahme.

Tatsächlich ausgeführte Prüfläufe. Die Einträge bis 2026-09-22 stehen nicht
streng chronologisch; ab 2026-09-23 hat jede Änderung einen eigenen Abschnitt.
Neue Einträge unten anhängen.

### Prüfläufe 2026-09-15 bis 2026-09-22

2026-09-19, inf-schule „OOP mit Kotlin“, Kapitel 1–3 (Blackjack, Goldrausch,
Tierisch Glücklich, Ausgebüxt, Snap/Timer einschließlich Fachkonzepte und
Übungen): Alle Seiten und die ZIP-/BlueK-Projekte wurden heruntergeladen und
jede Code-Stelle bzw. Aufgabe über den echten `LocalRuntimeClient`/`RuntimeHost`
geprüft (temporäres Harness, nicht eingecheckt): Blackjack 40/40, Tier 19/20,
Goldrausch 22/22, Ausgebüxt 18/18, Kapitel-2/3-Konzepte und Übungen 42/42,
FakeTimer-Inspector 2/2. Erwartete Fehlerbeispiele („Nichts als Fehler“,
Attribut-Vorschläge, `val`-Zuweisung, `private`) liefern Compilefehler mit
Datei/Zeile. Offen (Vorlagen, bewusst nicht in BlueK nachgebaut): Person-Übung
(`java.time.LocalDate`, `String.format`), Snap-BlueJ-ZIP (`javax.sound`,
`JOptionPane`; die BlueK-Links funktionieren), vorgegebene `Spiel`-Klasse von
Tierisch Glücklich (`data class`, `sealed interface`, `data object`,
`companion object`, verschachtelte Klassen, `kotlin.random.Random`); eine
BlueK-kompatible Fassung wurde mit Eingaben bis Spielende geprüft.

Gefundene und behobene BlueK/Kotlite-Fehler: RT-15 bis RT-28, GUI-60/61; Offline-Paket GUI-62/63; Fehleranzeige im Editor GUI-64/65; Projekt-README GUI-66/67; Vim-Modus GUI-68.
`npm run test:regression` grün mit 80/80 Chromium-Tests (75 dauerhafte plus 5 einmalige mit den echten inf-schule-ZIPs); `browser-smoke`
einschließlich neuem `smoke-curriculum-kotlin` (gegen das Bundle vom
Sitzungsbeginn rot), `test:references`, `test:generics`, `test:blueplay-demos`
grün. Visuelle Benutzerabnahme offen. Kein Commit und kein Push.

2026-09-19, Space-Invaders-Vorlage objektorientiert: `Defender` bewegt sich und
erzeugt Laser über sich, `Laser` fliegt, entfernt einen getroffenen `Invader`
und sich selbst oder verschwindet am oberen Rand, jeder `Invader` bewegt sich
und kehrt am Rand einzeln um; die World baut nur auf und erkennt das Spielende.
Dabei gefunden und behoben (beide auch im alten Bundle): RT-13 Vorwärtsreferenz
Defender → Laser scheiterte in der Analyse, RT-14 typisierte
Kollisionsabfragen scheiterten zur Laufzeit. Node/VM-Benchmark mit der neuen
Vorlage: Dauerschießen Mittel 3,1 ms (vorher 4,5 ms), ohne Schießen 0,95 ms.
Der Benchmark prüft jetzt, dass alle Invader im selben vollständigen Schritt
um je 8 Pixel ziehen, statt eine gemeinsame Richtung vorauszusetzen.
`browser-smoke`, `test:references`, `test:generics`, `test:blueplay-demos` und
`npm run test:regression` einschließlich 73/73 Chromium-Tests grün. Eingebauter
Browser: Vorlage geladen, Run mit Space/Pfeil, Treffer und einzeln
umkehrende Invader sichtbar. Benutzerabnahme offen. Kein Commit und kein Push.

2026-09-19, BluePlay-Performance, zweite Runde (Profil mit Kotlin/JS-
Development-Bundle, Messung mit Produktions-Bundle): Hauptkosten waren
`by lazy`-Felder der Symboltabelle (Kotlin/JS erzeugt pro Zugriff eine
Property-Referenz), wiederholte Typauflösung nicht-generischer und konkret
parametrisierter Typen, `ClassMemberResolver` pro `hasNext()`/`next()`,
leere geerbte `act()`-Aufrufe, Render-Aufrufe in jedem Library-Setter und
lineare Namenssuche beim Feldzugriff. Details in `docs/architecture.md`.

Node/VM-Benchmark (`node scripts/benchmark-blueplay.mjs`, Hilfs-/Runtime-Test,
kein Browser): ohne Schießen Mittel 3,36 → 1,1 ms, mit Dauerschießen
13,08 → 4,5 ms, p95 24,6 → 7,3 ms. Vollständiger Host-Pfad
(`RuntimeHost` + `LocalRuntimeClient` + Structured Clone, Speed 100,
Pfeil+Space): 81 → ca. 200 Frames/s. Langzeit 3000 Schritte Dauerfeuer bei
5 verbleibenden Objekten: 4,1 → 1,0 ms pro Schritt (PERF-02).

Eingebauter Browser (Chromium, Dev-Server, manuell per Skript, kein
Playwright): Space Invaders, Speed 100, Pfeil+Space 5 s: 57 → 85–88
Simulationsschritte/s; Main-Thread pro Worker-Nachricht einschließlich
Svelte-Update ca. 0,5 ms, keine Long Tasks. Bei Speed 50 blieben alte und neue
Version bei ca. 19 Schritten/s (Takt 50 ms); der Unterschied zeigt sich bei
hoher Geschwindigkeit, auf langsameren Geräten und im Langzeitspiel.

`npm run test:regression` vollständig grün, einschließlich 73/73 echten
Chromium-Tests; zusätzlich `browser-smoke`, `test:references`,
`test:generics` (neuer Fall für Typ-/Resolver-Caches, auch gegen das alte
Bundle grün), `test:blueplay-demos`. PERF-01 zweimal einzeln: 321/326
DOM-Frame-Updates in 4 s, p95 15,5/15,2 ms. Typecheck 0 Fehler, 5 bestehende
Svelte-Warnungen. Visuelle Benutzerabnahme offen. Kein Commit und kein Push.

2026-09-19, BluePlay-Performance: Der reproduzierbare Node/VM-Benchmark
`node scripts/benchmark-blueplay.mjs` verwendet das echte Space-Invaders-Projekt
mit ausschließlich für den Test auf 1 Pixel reduzierter Defender-Bewegung.
180 Schritte ohne Schießen: Mittel 10,78 → 3,47 ms; mit Dauerschießen:
53,55 → 12,62 ms, p95 87,79 → 21,68 ms. Zusätzliche Frame-Erzeugung etwa
0,16 ms. Ausgangsmessung mit CPU-Profil, Endmessung ohne Profiler; lokale
Vergleichswerte, kein geräteunabhängiges Leistungsversprechen. Der Benchmark
prüft jeden Defender-Schritt, echte Laser sowie gemeinsame Invader-Bewegung
einschließlich Begrenzung am Weltrand.

Gezielte echte Chromium-Suite (`blueplay.spec.ts`, `generics.spec.ts`): 11/11
grün. PERF-01 testet Speed 95 und vier Sekunden gleichzeitige Pfeil-/Space-
Eingabe, nicht mehr nur 800 ms bei Default-Speed. Zwei Läufe lieferten
193–206 DOM-Frame-Updates/4 s, p95 26,7–28,9 ms und maximal 30,2–33,7 ms.
Das misst Frame-Ankünfte, nicht die tatsächlichen Bildschirm-Present-Zeiten.
Der manuelle Vorlagenwechsel im eingebauten Browser wurde wegen möglichem
Verlust des geladenen Projekts nicht ausgeführt; kein Projekt wurde ersetzt.

`browser-smoke` (Node/VM, kein Browser), `test:generics` einschließlich 49
Boundary-Fällen und neuem Receiver-/Vererbungsfall, `test:blueplay-demos`,
Kotlin- und Svelte-Build sowie Typecheck erfolgreich. Typecheck meldet
0 Fehler/5 bestehende Svelte-Warnungen, Builds weiterhin Cast-/Bundle-Warnungen.
Langzeit-/100-Actor-/Speicher- und Safari-Messungen sowie Benutzerabnahme offen.

Der erste vollständige Regressionslauf bestand 72/73 Chromium-Tests; GUI-14
lief wegen einer Flut einzelner `println`-Snapshots in den Timeout. Der Host
bündelt Streaming-Ausgabe nun auf höchstens etwa eine Meldung pro 16 ms und
leert Resttext bei Eingabe/Abschluss. Gezielte Wiederholung GUI-12/13/15 und
GUI-14: 2/2 grün; Runtime-State-Test einschließlich Reihenfolge, vollständiger
Ausgabe und Eingabeprompt grün. Ein Zwischenlauf während der Host-Nachbesserung
zeigte ein fehlendes World-Fenster bei GUI-54 und wurde abgebrochen. Die
abschließende Wiederholung auf unverändertem Stand ist vollständig grün:
`npm run test:regression`, einschließlich 73/73 echten Chromium-Tests und
aller enthaltenen Helfer-/Runtime-Tests. Auch Resttext vor `Thread.sleep`
wird explizit vor Befehlsabschluss geprüft. Abschließender PERF-01-Lauf:
203 DOM-Frame-Updates/4 s, p95 27,2 ms, Maximum 29,6 ms. Svelte-Build und
`git diff --check` erfolgreich. Kein Commit und kein Push.

2026-09-18: Actor-Treffer und Kollisionen auf sichtbare Bildpixel umgestellt.
PNG-Ressourcen liefern flüchtige Alpha-Masken an die Laufzeit; Klicks wählen
den obersten sichtbaren Actor auch außerhalb seiner Mittelpunktzelle.
`isTouching` und `intersects` berücksichtigen Alpha, Skalierung und Rotation.
Die Actor-Identität wird über Kotlites Vererbungsteile kanonisiert, sodass der
Fall `if (isClicked) world.removeObject(this)` ohne Laufzeit-Fault arbeitet und
die echte `World.getObjects<Actor>().size` nach zwei Selbstentfernungen von 2
auf 0 sinkt.
Der eingebaute Browser bestätigte einen transparenten Klick (`false`), einen
sichtbaren Klick abseits der Mitte (`true`) und anschließendes Entfernen ohne
Fehler. Automatisiert grün: `build:kotlite`, `typecheck`,
`smoke-blueplay-browser` einschließlich Alpha-/Rotationskollision und
Selbstentfernung, `build:svelte` sowie der vollständige
`test:regression`-Lauf mit **66/66 Chromium-Tests**; der zusätzliche GUI-55-Test
für die feste `100x100`-Pixelgröße ist ebenfalls grün. Typecheck meldet 0 Fehler
und die fünf bestehenden Svelte-A11y-Warnungen. Kein Commit und kein Push.

2026-09-18: BluePlay-Fehlerkorrektur abgeschlossen. Das Weltfenster ist nun ein
gemeinsamer BlueJ-artiger Container mit Titelleiste, Canvas und eingebetteten
Buttons; Close schließt den gesamten Container, die Titelleiste verschiebt ihn.
Der Worker-Scheduler hält `Run` dauerhaft aktiv, `Pause` beendet sauber den
nächsten Schritt, Speed kann auch während des Laufs per Drag geändert werden.
Canvas-Klicks verwenden die tatsächlichen skalierten Grenzen und erreichen
`World.isClicked` sowie `Actor.isClicked`. `World.show()` setzt kein implizites
Stop-Signal mehr. Der Welt-Canvas liegt ohne weißen Innenabstand direkt zwischen
Titelleiste und Steuerleiste. Die ungenutzte `initialized`-Demo aus `MyWorld`
wurde aus der geladenen Vorlage entfernt.

Bestanden: `npm run build:kotlite`, `npm run typecheck` (0 Fehler),
`npm run build:svelte`, `npm run test:runtime-state`,
`node scripts/smoke-blueplay-browser.mjs`, `npm run test:ui`,
`npm run test:references`, `npm run test:inspector`,
`npm run test:project-format`, `npm run test:codepad-flow`,
`node scripts/smoke-static-architecture.mjs`,
`node scripts/smoke-svelte-architecture.mjs` sowie echter Chromium mit
**66/66 Tests** inklusive GUI-52, GUI-53, GUI-54 und RT-11. Typecheck/Svelte-Build
melden weiterhin nur die fünf bestehenden Svelte-A11y-Warnungen sowie die
bekannten Bundle-/Formatter-Warnungen. Der Entwicklungsserver läuft auf
`http://127.0.0.1:5173/`. Kein Commit und kein Push.

2026-09-18: World-Body-Layout nachgeschärft. Die unvergrößerte Canvas wird in
beiden Achsen zentriert. Die dynamische Fensterbreite reserviert nur noch den
notwendigen Rahmen statt einer pauschalen seitlichen Zusatzbreite; kleine
Welten behalten ihren grauen Surround und große Welten bleiben unskaliert.
Gezielt grün in echtem Chromium: GUI-54 bis GUI-57; GUI-57 deckt dabei auch
die symmetrischen Abstände und die fehlende unnötige Seitenreserve ab.

2026-09-18: BluePlay-Karten und API-Hilfe nachgeschärft. Die vier
Bibliothekskarten werden wie normale verschiebbare Klassenkarten gerendert und
in die Vererbungsgeometrie sowie die Positionierung neuer Klassen einbezogen.
Die globale Bibliotheksleiste entfällt. Doppelklick und Kontextmenü öffnen nun
die API-Dokumentation der jeweils ausgewählten Datei. Echter Chromium:
GUI-58 und GUI-59 sowie die vollständige BluePlay-Suite mit 9/9 Tests grün.

2026-09-18: BluePlay-Umsetzung abgeschlossen. Die versionierte native
Library (`blueplay` v1) wird über das Projektformat transportiert; alte
Framework-Dateien werden bei markierten Projekten migriert und nicht erneut
als Schülercode kompiliert. Der Worker besitzt den Scheduler, liefert
typisierte World-/Actor-/Text-Frames und die Svelte-Oberfläche rendert die
Welt auf einem Canvas mit Zellkoordinaten. Ressourcen, Kartenpositionen,
Geschwindigkeit, Reset und Input-Strecke sind im Runtime-Vertrag vorbereitet.

Bestanden: `npm run build:kotlite`, `npm run typecheck` (0 Fehler),
`npm run build:svelte`, `npm run test:runtime-state`,
`node scripts/smoke-blueplay-browser.mjs`, `npm run test:project-format` und
`npm run test:codepad-flow`. Die Builds melden nur bestehende Warnungen
(insbesondere Kotlin-/Bundle-Größe und Svelte-A11y). Die native BluePlay-
Session, der Worker-Scheduler und die Client-Gates wurden end-to-end geprüft;
der echte Chromium-Lauf besteht mit 62/62 Tests einschließlich der beiden
aktivierten BluePlay-Vorlagen, der Built-in-Karten und der API-Hilfe. Eine
separate visuelle Abnahme des laufenden Canvas-Spiels sowie der Pointer-/Bild-
Darstellung bleibt als manueller Akzeptanzpunkt offen. Kein Commit und kein
Push.

2026-09-18: Generics-/Inline-Erweiterung abgeschlossen. Kotlin-Bundle frisch
gebaut (`build:kotlite`), anschließend `build:svelte` erfolgreich.
`test:generics` besteht einschließlich 49 zusätzlicher positiver/negativer
Sprachfälle und eines suspendierten nichtlokalen Returns nach `Thread.sleep`.
Abgesichert sind insbesondere lexikalisch verschachtelte und zurückgegebene
reifizierte Closures, Typparameter-Shadowing, Erasure, Inline-Weitergabe,
`noinline`/`crossinline`, Labels, Rekursion und `try`/`catch`/`finally`.
Die Tests fanden außerdem Fehler bei inferierten Funktionsrückgaben,
implizitem `it` in zurückgegebenen Lambdas und Funktionswerten als `Any`;
diese wurden korrigiert und erfolgreich erneut geprüft.

Bestanden: `test:runtime-state`, `test:references`, `smoke-kotlite-browser`,
`test:inspector`, `test:project-format`, `test:codepad-flow`, `test:ui` und
`typecheck` (0 Fehler, 5 bestehende Svelte-Warnungen).
Der vollständige echte Chromium-Lauf (`test:gui`) ergab **60/60 bestanden**.
Der neue Generics-/Inline-Test, alle sieben GUI-47-Fälle und alle drei
Referenztests sind grün. Die GUI-47-Prüfung zählt den erforderlichen
Create-Namensdialog nicht als Parameterdialog; die veraltete Close-Abstands-
Assertion aus GUI-08/GUI-10 wurde durch eine Sichtbarkeitsprüfung im aktuellen
Fenster-Chrome ersetzt. Keine neue visuelle Benutzerabnahme; keine BluePlay-
Implementierung.
Sprachumfang und bewusst nicht erweiterte Compilerfunktionen stehen in
`docs/kotlite-generics.md`.

2026-09-17 (damaliger Zwischenstand, durch RT-08/RT-09 erweitert): Nach der Generics-Korrektur wurde das Kotlin-Browser-Bundle frisch
gebaut; `npm run build` bestand insgesamt. `test:generics` bestand mit den
beiden unabhängigen Reproduktionen, `Box<String>`/`Box<Int>`,
Collection-Varianz, Filter-Unterklassen, Nullbarkeit, Reihenfolge und
Objektidentität. Die positive native Filterfunktion wird ebenfalls als
reifiziert geprüft. Die positiven `session.load()`-Antworten werden im Test vor
`ok()` als JSON dekodiert. Der Test weist direkte und weitergereichte
nicht-reifizierte Typprüfungen ab und bestätigt, dass `noinline`/`crossinline`
nicht still akzeptiert werden.

Zusätzlich bestanden `test:runtime-state`, `test:references`,
`smoke-kotlite-browser`, `test:project-format`, `test:codepad-flow`,
`test:inspector`, `test:ui` und `typecheck` (0 Fehler, 5 bestehende
Svelte-Warnungen). `build:svelte` war ebenfalls erfolgreich. Keine BluePlay-
Implementierung und keine GUI-/Benutzerabnahme in diesem Prüflauf.

2026-09-17: Vollständige `#bluek=...`-Projektlinks werden nach erfolgreichem
Laden wie Kurzlinks aus der URL entfernt. Typecheck: 0 Fehler, 5 bestehende
Svelte-Warnungen. Die betroffenen Chromium-Tests GUI-43 und GUI-50 bestanden
gemeinsam mit 2/2.

2026-09-17: Referenzverwaltung strukturell überarbeitet. Unveränderliche
Analyse-Historie mit expliziten Freigabeereignissen ersetzt das Löschen alter
Quelltextblöcke. Namensbindungen/Herkunft und Handle-Lebensdauer gehören der
Kotlin-Session; Objektbank und Host beziehen sie ausschließlich aus Snapshots.
Globale Lambda-Captures behalten ihren Holder; der passive Referenzgraph
berücksichtigt Felder, Collections, Captures und explizite Host-Referenzen.

Ergebnisse: Kotlin-Browser-Build, `test:references`, `test:runtime-state`,
Kotlite-Bundle-Smoke, UI-/Inspector-/Projektformat-/Codepad-Helfertests,
Typecheck (0 Fehler, 5 bestehende Svelte-A11y-Warnungen) und Svelte-Build grün.
Chromium: 3/3 neue Referenztests grün; zusammen mit `regressions.spec.ts`
50/51 grün. GUI-08/GUI-10 scheitert an einer unveränderten Layout-Assertion,
die Close am unteren Editor-Rand erwartet, obwohl es oben im Fensterkopf liegt.
`browser-smoke` besteht Architektur und Kotlite, scheitert anschließend an
der bereits in HEAD veralteten eingebetteten BluePlay-Vorlage (`World.kt`);
Runtime-State wurde deshalb zusätzlich separat erfolgreich ausgeführt.
Diese beiden nicht referenzbezogenen Testprobleme wurden nicht kaschiert oder
durch Änderungen an Editor/BluePlay behoben.

Zwischenläufe: Ein Kotlin-Build scheiterte zunächst an `toSortedMap` im
Multiplattform-Code (durch sortierte Entries ersetzt). Die neue Lambda-
Regression entdeckte fehlende globale Captures (behoben). Zwei neue Browser-
Tests hatten zunächst einen falschen Inspektor-Selektor; ein weiterer Check
verwendete einen dynamischen `last()`-Locator statt der ursprünglichen History-
Zeile (Tests korrigiert). Cache-/Testserver-Zugriff erforderte Sandbox-Freigabe.
Entwicklungsserver unverändert auf 5173; echte Browsertests separat auf 5194.
Keine neue Benutzerbestätigung oder Safari-Abnahme behauptet.

2026-09-16: `Thread.sleep` fertiggestellt und Kotlite-Bundle neu gebaut.
Fehlversuche bei Überladungen (unter anderem `0 until bis`) durch stabile
Bibliotheksnamen bei erneuter Analyse behoben. Der negative Sleep-Test deckte
eine nicht initialisierte Exception-Klassenvorlage auf; die Runtime verwendet
nun die aktive Klassendefinition. Vollständiger Kotlite-Smoke in Node/VM grün,
inklusive ursprünglichem Timer mit `Thread.sleep(1000)`, `try/catch` und echter
Wartezeit. Echter Chromium-Lauf: 5/5 (RT-04 zweimal, GUI-11, GUI-12/13/15,
GUI-14). Typecheck: 0 Fehler, 5 Warnungen; Runtime-State-Integration und
Svelte-Produktionsbuild grün. `browser-smoke` insgesamt nicht grün: nach den
bestandenen Architektur- und Kotlite-Tests stoppt die BluePlay-Prüfung bei
`The bundled BluePlay template is stale for World.kt.` Dieser Vorlagenabgleich
wurde nicht verändert. Der erste GUI-Start war durch die Sandbox-Portfreigabe
blockiert; die tatsächlichen Browserprüfungen liefen anschließend auf dem
separaten Testport 5194. Lokaler Entwicklungsserver 5173 unverändert.

2026-09-16: Der aktuelle Projektzustand wird in `localStorage` gesichert und
ohne expliziten Projektlink beim Start wiederhergestellt. Typecheck und der
neue Chromium-Test GUI-45 erfolgreich.

2026-09-16: BlueJ-Dateiregel und New-File-Dialog umgesetzt. Kotlite-Bundle,
Runtime-State-Smoke-Test und Svelte-Produktionsbuild erfolgreich. Chromium:
42/43 Tests bestanden; GUI-40 für New File einschließlich Top-Level-Datei war
grün. Ein bestehender GUI-08/GUI-10-Test zum Editor-Abstand schlug auch bei
gezielter Wiederholung fehl (Abstand unter dem Close-Button 474 statt < 50 px),
ohne Bezug zu dieser Änderung; die visuelle Ursache bleibt offen.

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

2026-09-19: Die Vorlagen erscheinen in der Reihenfolge Empty Project, BluePlay
Template, BluePlay Example, BlueK Demo Project und Space Invaders Demo. Beide
Demos werden derzeit in jedem Build ausgeliefert. `test:blueplay-demos` prüft
das Laden, Starten und Schießen der Space-Invaders-Vorlage.

2026-09-15: Lange Codepad-Werte werden mit sichtbarem Typ gekürzt; der vollständige
Wert steht als Hover-Text zur Verfügung. GUI-Suite erfolgreich mit 20/20 Chromium-
Tests; Typecheck und Svelte-Build erfolgreich.

2026-09-15: Projektdateien verwenden den deklarationsbasierten Ladeweg im
Kotlin-Adapter; Codepad bleibt ausführbar. Kotlin-Bundle neu gebaut,
Typecheck (0 Fehler/0 Warnungen), UI-/Inspector-/Projektformat-/Codepad-Helfertests,
Runtime-Integration, `browser-smoke` (Node/VM, kein echter Browser) und
Svelte-Produktionsbuild erfolgreich. Echter Chromium-Prüflauf: 24/24 GUI-Tests
bei 1440 × 1000 bestanden. Zusätzlich kompilieren alle drei JSON-Vorlagen über
den neuen Projekt-Ladeweg.

Erste Prüfläufe scheiterten an der Funktionsaufruf-Position (Klammer statt
Funktionsname, korrigiert) und am Projektwechsel im neuen GUI-Test (Hash-Wechsel
lädt die App nicht neu; anschließend fehlte die Bestätigung des Ersetzens).
Test nutzt jetzt den echten New-Project-Ablauf mit Bestätigung. Gradle- und
Testserver-Starts waren zunächst sandboxbedingt blockiert; mit freigegebenem
Cache-/Prozesszugriff erfolgreich wiederholt. Build-Warnungen zu Kotlin-Cast,
Bundlegröße und Worker-URL bleiben bestehen; keine visuelle Nutzerabnahme behauptet.

Offen bleiben die explizit genannten visuellen Abnahmen, weitere Datentypen,
Viewportgrößen und Browser. Die Liste bedeutet keine vollständige Feature-Parität.
Gezielt grün in echtem Chromium: GUI-54 bis GUI-57; dabei werden auch die
symmetrischen Abstände und die fehlende unnötige Seitenreserve geprüft.

2026-09-20: BlueK ergänzt fehlende Kotlin-Stdlib-Funktionen über ein eigenes
`BlueKStdlibModule` statt über den Interpreter-Fork; der Fork bleibt für
Interpreter-Semantik reserviert. Bewusst native `CustomFunctionDefinition`s und
kein interpretiertes Prelude, weil BluePlay einen Teil davon (Clamping) pro
Frame und Actor aufruft. Kotlite erlaubt `vararg` nur als einzigen Parameter,
daher `minOf(vararg values: Int)` statt Kotlins `minOf(a, vararg other)`:
`minOf()` ohne Argumente scheitert erst zur Laufzeit, mit klarer Meldung.
`String.lastIndex` existierte bereits und liess sich nicht erneut deklarieren.
Neu gebautes Bundle; `browser-smoke`, `test:references`, `test:generics`,
`test:blueplay-demos` und `test:kotlin-surface` erfolgreich. GUI-Suite für
diese Änderung nicht ausgeführt - keine GUI-Änderung, aber auch nicht belegt.

2026-09-20: Fehlende Namen werden über `KotlinSurfaceHints` in BlueK-Wortlaut
umgeschrieben (Punkt 4a). Die Unterscheidung BlueK-Lücke gegen Tippfehler ist
nicht allgemein entscheidbar; der dritte Fall nennt deshalb beide
Möglichkeiten. Beim ersten Versuch schlug die Umschreibung auch bei falschen
Argumenttypen zu und behauptete, eine vorhandene Methode existiere nicht
(Curriculum-Smoke `zeige(5)`); Kotlite verwendet dort denselben Wortlaut.
Deklarierte und registrierte Namen werden jetzt durchgereicht, und der
Smoke-Test sichert beide Richtungen ab. `browser-smoke`, `test:references`,
`test:generics`, `test:blueplay-demos`, `test:codepad-flow`, `test:inspector`,
`test:kotlin-surface` und Typecheck erfolgreich; GUI-Suite nicht ausgeführt.

2026-09-21: GUI-Suite für RT-29 und RT-30 nachgeholt: 77 bestanden, 4 offen.
Davon sind zwei kein Befund dieses Laufs - GUI-35 erwartet Port 5194 fest im
Link und schlug nur fehl, weil der Lauf wegen eines parallel belegten Ports
auf 5291 ausweichen musste; PERF-01 besteht im ruhigen Einzellauf (10/10 in
blueplay.spec). Offen bleiben GUI-61 (BlueJ-Verzeichnisimport) und GUI-22
(Dropzone nennt BlueJ ZIP): der Open/Import-Dialog bietet heute nur JSON
(SvelteApp.svelte, .project-dropzone). Beide bestehen unabhängig von den
Kotlin-Änderungen - die Commits d799407 und f20d1cb fassen frontend/src
nicht an, letzte Änderung dort war 08963a8.
Hinweis: playwright.config.ts nutzt den festen Port 5194 mit
reuseExistingServer:false. Laufen zwei Arbeitskopien parallel, reißen sich
die Läufe gegenseitig den Testserver weg (ERR_CONNECTION_REFUSED, SIGTERM).

Nachtrag zum Merge der Standardgrafiken: Das oben genannte RT-30 bezeichnet
die Meldung fehlender Namen. Die fehlende Grafik hat beim Merge die ID RT-31
bekommen, weil RT-30 zu dem Zeitpunkt bereits vergeben war. Der Lauf oben
zählt 77 bestanden bei 4 offenen; auf dem zusammengeführten Stand sind es 81
bestanden bei 2 offenen: GUI-69 und GUI-70 kommen hinzu, und die beiden
Portartefakte GUI-35 und PERF-01 treten ohne parallelen Lauf nicht auf.
Offen bleiben weiterhin nur GUI-61 und GUI-22.

2026-09-22: GUI-42 an das gewünschte Escape-Verhalten angepasst und den
Vim-Haltefehler reproduziert: vor der Korrektur bestand der Test ohne Vim,
der neue Test mit gehaltenem Escape ohne Repeat scheiterte (Editor blieb offen).
Die Haltezeit wird jetzt ab dem ersten Keydown in der Capture-Phase gemessen,
bevor Vim Escape verarbeitet. Keyup und Fokus-/Fensterwechsel löschen den
Timer; pro Tastendruck wird höchstens ein Editor geschlossen. Die Auswahl des
Escape-Ziels ist für normalen Escape und Vim-Halten gemeinsam; Dialoge behalten
Vorrang. Die Kürzelhilfe nennt die Haltezeit von einer Sekunde.

Nachweis: `npx playwright test --grep 'GUI-42|GUI-68|GUI-66|GUI-17|GUI-18'`
mit 11/11 echten Chromium-Tests erfolgreich; `npm run test:ui` erfolgreich
(Hilfsfunktionstests). Der erste Browserstart war durch Sandbox-EPERM am lokalen
Testport blockiert; der freigegebene Lauf außerhalb der Sandbox funktionierte.
Typecheck: 0 Fehler, 5 Svelte-Warnungen. Keine vollständige GUI-/Runtime-Suite
für diese Änderung ausgeführt. Physisches langes Escape und echter
OS-Fensterwechsel sind noch nicht manuell bzw. durch den Nutzer bestätigt.

2026-09-22 (Nachtrag): Der einsekündige Halte-Mechanismus aus dem obigen
Eintrag hat sich in echter Nutzung als unzuverlässig erwiesen — die
Sicherheitsabbrüche bei `pointerdown`/`focusin` reagierten schon auf normale
Mausbewegung/Fokusereignisse während des Haltens und brachen den Timer
unbemerkt ab. Ersetzt durch `Shift+Escape`, das ohne Timing arbeitet: ein
einfaches Escape gehört bei aktiviertem Vim vollständig Vim (Insert- und
Normal-Modus-Wechsel bleiben sofort wirksam, schließt aber nie das
Editorfenster), erst Shift+Escape schließt es gezielt und sofort. Der ganze
Halte-/Abbruch-Mechanismus (Timer, Capture-Listener, Pointer-/Fokus-/Blur-/
Sichtbarkeits-Abbrüche) wurde entfernt. Nachweis:
`npx playwright test --grep GUI-42` mit 3/3 grün; `npm run typecheck` mit
0 Fehlern.

### RT-25: main-Auswahl bei Start und BluePlay-Reset (2026-09-23)

Der Arbeitsbaum war vor der Änderung sauber auf `beta`. Die Auswahl wird aus
dem Runtime-Manifest abgeleitet und nur für den einzelnen Aufruf verwendet.
Die Prüfung umfasst auch Main.kt als einen von mehreren Kandidaten sowie ein
Projekt ganz ohne Main.kt.

Nachweise:

- `npm run build:kotlite`: erfolgreich, ausgeliefertes Kotlin/JS-Bundle erneuert.
- `npm run test:runtime-state`: erfolgreich, einschließlich expliziter und
  eindeutiger Ziele, Ablehnung mehrdeutiger/ungültiger Ziele ohne Ausführung,
  Session-Erhalt und interaktiver Eingabe während Reset.
- `node scripts/smoke-blueplay-browser.mjs` und `npm run test:blueplay-demos`:
  erfolgreich. Diese Skripte sind Runtime-/VM-Smokes, keine GUI-Abnahme.
- `main-selection.spec.ts`: sechs echte Chromium-Tests erfolgreich; bestehende
  GUI-77 (Buttonname) und GUI-81 (Welt wieder öffnen) ebenfalls erfolgreich.
- `npm run typecheck`: 0 Fehler, 0 Warnungen.
- `npm run build:svelte`: erfolgreich; Hinweise zu Bundle-Größe,
  dynamischem Runtime-Pfad und externem Formatter-Modul bleiben bestehen.

Die ersten Ausführungen wurden durch Sandbox-Zugriff auf den Gradle-Cache bzw.
den lokalen Testport blockiert; freigegebene Wiederholungen funktionierten.
Die ersten neuen GUI-Fixtures fehlten beim Compile-Schritt; anschließend
verwendeten sie einen nicht vorhandenen Status-Selektor. Beide Testfehler wurden
korrigiert und die betroffenen Tests erfolgreich wiederholt. Keine komplette
Regressionssuite ausgeführt. Visuelle Benutzerabnahme des Auswahldialogs offen.

### RT-32: BluePlay-Canvas als eigenes Modul (2026-09-23, Branch `html-export`)

Vorbereitung für den HTML-Export: Zeichnen, Bildauflösung, pixelgenaue
Klickziele, Tastennamen und Sounds des BluePlay-Canvas liegen jetzt in
`frontend/src/bluePlayStage.ts` statt in `SvelteApp.svelte`. Das sichtbare
Verhalten soll unverändert bleiben.

Nachweise:

- `npm run test:blueplay-stage` (neu, Hilfsfunktionstest in Node): Tastennamen,
  Weltstil, Ressourcenauflösung, gemessene Bildgrößen, leere Zeichnung für
  Actors ohne Bild, Klickziel bei skaliertem Canvas, gedrehtem Actor,
  fast transparentem Actor und Klemmen an den Weltrand. Erfolgreich.
  Bild-Alpha-Masken brauchen einen Browser und sind hier nicht abgedeckt.
- Echte Chromium-Tests `blueplay.spec.ts` und `main-selection.spec.ts`:
  22/22 erfolgreich, darunter GUI-53 (Klick auf sichtbare Actor-Pixel),
  GUI-69/GUI-70 (Standardgrafiken und Masken) und PERF-01 (gehaltene Taste).
- `npm run typecheck`: 0 Fehler, 0 Warnungen. `npm run test:ui`, beide
  Architektur-Smokes und `npm run build:svelte`: erfolgreich.

Keine komplette Regressionssuite ausgeführt. Sounds (`playSound`, Beep) sind
nicht automatisiert geprüft; visuelle Abnahme des laufenden Spiels offen.

### RT-33: Exportformat für den HTML-Export (2026-09-23, Branch `html-export`)

`frontend/src/programExport.ts` definiert das eingebettete Programm
(`mainFile`, `blueKUrl`, `project` im `.bluek.json`-Format) und setzt es in die
Player-Vorlage ein. Der JSON-Export verwendet dieselbe Dateinamenbildung
(`exportFileName`); sein Verhalten ist unverändert.

Nachweise:

- `npm run test:program-export` (neu): Validierung von Format, Version,
  `mainFile`, Projektinhalt und BlueK-Adresse (auch `javascript:` abgewiesen),
  Linkziel für öffentliche Instanz, GitHub-Pages-Pfad, localhost und
  Offline-Paket, Dateinamen, beschädigte oder bereits gefüllte Vorlage.
  Ein Quelltext mit `</script><script>alert(1)</script>`, `<!--`, `&`,
  U+2028/U+2029 und Emoji wird in echtem Chromium (Playwright,
  `page.setContent`) geparst: genau zwei Script-Elemente, kein Dialog,
  nachfolgendes Skript läuft, Quelltext kommt unverändert zurück. Erfolgreich.
- Echter Chromium-Test `RT-33 Export Project JSON keeps its file name and
  content` (neu, `regressions.spec.ts`): Projektname mit `:` und `/` ergibt
  `Hunde- Teil 1-2.bluek.json`, Inhalt mit Name und Datei unverändert.
  Erfolgreich, ebenso beide GUI-80-Tests.
- `npm run typecheck`: 0 Fehler, 0 Warnungen.

Machbarkeitstest (Schritt 0, außerhalb des Repos): Eine einzelne HTML-Datei mit
eingebettetem, gzip-komprimiertem Kotlite, Blob-Worker, `LocalRuntimeClient`
und `RuntimeHost` lief per `file://` in Playwright-Chromium und
-WebKit (Compile, `readLine`, `Thread.sleep`, Ausgabe). Firefox:
Playwright-Firefox 1543 startet unter macOS 27 nicht („Could not find profile
folder“); Nutzerbestätigung im installierten Firefox per Screenshot
(Phase `ready`, vollständige Ausgabe). `Blob.stream()` scheitert in WebKit
unter `file://`; ein `data:`-Worker ist in WebKit etwa sechsmal langsamer.

### RT-34: Kotlite-Laden für IDE und Player getrennt (2026-09-23, Branch `html-export`)

`runtimeWorker.ts` enthält den gemeinsamen Worker-Start. Die IDE lädt Kotlite
weiterhin per `fetch` (`localRuntimeWorker.ts`), der Player aus dem
eingebetteten gzip+base64-Bundle (`playerRuntimeWorker.ts`). Die Worker-Fabrik
der IDE liegt jetzt in `localRuntimeWorkerFactory.ts`; `LocalRuntimeClient`
verlangt sie als Konstruktorargument.

Nachweise:

- `npm run test:player-worker` (neu): gzip-Roundtrip mit Umlauten/Emoji und
  Ablehnung ungültiger Daten in Node; der echte Player-Worker, mit dem
  Vite-Plugin gebaut, kompiliert und startet in einer per `file://` geöffneten
  Seite ein Zwei-Dateien-Projekt mit `readLine`, `Thread.sleep` und Ausgabe.
  Keine Netzwerk-Anfragen. Playwright-Chromium und -WebKit erfolgreich
  (Seite 326 KB). Firefox nicht automatisiert (siehe RT-33).
- `npm run build:svelte`: erfolgreich, IDE-Worker weiterhin als eigenes Asset
  (`localRuntimeWorker-*.js`, 13 KB). `smoke-static-architecture` (erweitert:
  Player-Worker nutzt nur das eingebettete Bundle, kein `fetch`),
  `smoke-svelte-architecture`, `npm run test:runtime-state`: erfolgreich.
- `npm run typecheck`: 0 Fehler, 0 Warnungen.
- Komplette GUI-Suite (`npx playwright test`, Chromium): 98 erfolgreich,
  7 fehlgeschlagen: GUI-61, GUI-39, GUI-41, GUI-32, GUI-22, GUI-16, GUI-68.
  Dieselben 7 Tests schlagen auch auf dem unveränderten Stand (alle Änderungen
  per `git stash` entfernt) identisch fehl; sie erwarten ältere
  Toolbar-/Fenster-/Settings-Elemente (u. a. `Files`-Button, vier
  Hauptaktionen) und hängen nicht mit dem Export zusammen. Offen.

### RT-35: Player und Vorlage für den HTML-Export (2026-09-23, Branch `html-export`)

`PlayerApp.svelte` führt ein eingebettetes Programm aus; `scripts/build-player.mjs`
baut daraus die Vorlage `frontend/public/player/bluek-player.html` (ca. 723 KB,
generiert und nicht eingecheckt; `npm run build` und `predev` erzeugen sie).
Die Link-Kodierung (`encodeBlueKLink`/`decodeBlueKLink`) nutzt jetzt wie der
Kotlite-Decoder `byteStream()` statt `Blob.stream()`.

Nachweise:

- `player.spec.ts` EXP-01 bis EXP-07 (neu): 7/7 erfolgreich. Wegen einer
  parallel laufenden zweiten Sitzung auf Port 5194 mit identischer
  Konfiguration auf Port 5195 ausgeführt.
- `npm run test:ui` (Projektlinks), `npm run test:player-worker`,
  `npm run test:offline` (erweitert: Vorlage im Offline-Paket, leer, als
  `text/html` ausgeliefert), `npm run typecheck` (0 Fehler, 0 Warnungen):
  erfolgreich.
- Sichtprüfung per Screenshot (Chromium): Konsolenprogramm mit Eingabe,
  80 Zeilen Ausgabe scrollen im Terminal, Eingabezeile bleibt sichtbar;
  BluePlay-Welt mit Steuerung; Compilefehler-Meldung.

Befund außerhalb des Exports: Ein Actor-Bild aus `Image.fill()` wird nicht
gezeichnet (Platzhalter), weil `drawnImageDataUrl` die Operation `fill` nicht
kennt; betrifft auch die IDE. Der Test verwendet `fillRect`. Inzwischen mit
GUI-86 behoben.

### RT-36: „Export as HTML“ in der IDE (2026-09-23, Branch `html-export`)

Neuer Eintrag im Save/Export-Dialog nach „Export Project JSON“. Der
`mainDialog` kennt die Aktion `export`; er schließt bei neuer Generation, aber
nicht bei laufendem Programm. `htmlExport.ts` lädt die Vorlage einmal von
`<BASE_URL>player/bluek-player.html` und setzt das Programm ein. Hinweise
(fehlendes `main()`, fehlende Vorlage) erscheinen im vorhandenen Hinweisfeld
unten. Projektname-Abfrage und Download teilen sich JSON- und HTML-Export.

Nachweise:

- `html-export.spec.ts` EXP-08 bis EXP-11 (neu): 4/4 erfolgreich, zusammen
  mit `player.spec.ts` (7/7), `main-selection.spec.ts` (6/6), RT-33 und GUI-67
  (Dialogreihenfolge um „Export as HTML“ ergänzt).
- Komplette GUI-Suite auf Port 5195 (zweite Sitzung belegt 5194): 108
  erfolgreich, 8 fehlgeschlagen. 7 davon sind die bekannten, auch auf dem
  unveränderten Stand fehlschlagenden Tests (siehe RT-34). GUI-35 schlug nur
  wegen des Ports fehl: der Test erwartet fest `http://127.0.0.1:5194/load/…`,
  erhalten wurde dieselbe Adresse mit 5195. Kein Regressionsbefund.
- `npm run typecheck` (0 Fehler, 0 Warnungen) und `npm run build:svelte`
  (Vorlage unter `frontend/dist/player/`) erfolgreich.

### Veraltete GUI-Tests nach b4ded3f/1dd2967 (2026-09-23)

Ausgangslage im Worktree auf Branch `claude/vigorous-darwin-73685e` (Stand
1dd2967, sauber): sieben GUI-Tests schlugen reproduzierbar fehl. Einordnung
anhand von Git-Historie und Checkliste:

- GUI-39, GUI-68: beabsichtigt. c8c4f7d (GUI-74) kürzte die Feldnamen auf
  „Font size“ und „Vim mode“; die Tests suchten noch die alten Namen.
- GUI-32: beabsichtigt. c8c4f7d ersetzte `□` durch ein abgerundetes
  SVG-Symbol (GUI-06 prüft es bereits); der Test prüft jetzt Symbol und Namen.
- GUI-16, GUI-41, GUI-22 (Files-Teil): beabsichtigt. fb0666c (GUI-79) entfernte
  Files. GUI-16 ist entfallen und durch einen neuen Test GUI-79 ersetzt.
- GUI-61, GUI-22 (Drop-Feld-Text): beabsichtigt (Nutzerbestätigung). 08963a8
  („Refine editor behavior“) reduzierte den Open/Import-Dialog auf JSON und
  entfernte die Ordnerwahl. Eine zwischenzeitliche Wiederherstellung wurde
  zurückgenommen. Die verwaiste `importProjectDirectory` und die CSS-Regel
  `.project-directory-choice` sind entfernt. Das Ablegen von ZIPs und Ordnern
  auf dem Drop-Feld funktioniert weiterhin. GUI-61 und GUI-60 legen ihre
  BlueJ-ZIP per Drop ab statt über die JSON-Dateiauswahl, GUI-22 prüft den
  JSON-only-Dialog.

Nachweise:

- Vorher: die sieben Tests mit `npx playwright test <datei>:<zeile>` 0/7 grün.
- Nachher: dieselben plus GUI-06/60/74/80 im echten Chromium-Lauf 12/13 grün;
  der neue GUI-79-Test scheiterte zunächst, weil ein nicht leeres Startprojekt
  beim Vorlagenwechsel ein natives `confirm()` auslöst, das Playwright
  ablehnt. Mit leerem Startprojekt (wie GUI-80) 1/1 grün.
- Nach Rücknahme der Wiederherstellung: GUI-60/61/22 3/3 grün,
  `npm run test:gui` 104/104 grün, `npm run typecheck` 0 Fehler, 0 Warnungen.

Offen: visuelle Abnahme von GUI-79; Ablegen eines echten Ordners ist nicht
automatisiert. Die Fehlermeldung beim Ablegen einer anderen Datei nennt
weiterhin ZIP und Projektordner, was dem Drop-Verhalten entspricht. Die IDs
GUI-74 und GUI-80 sind in der Checkliste und in den Testtiteln doppelt
vergeben; nicht umnummeriert, um stabile IDs nicht eigenmächtig zu ändern.

### GUI-86: Image.fill() in Actor-Bildern (2026-09-23)

Branch `claude/hungry-lewin-5b244e`, Ausgangspunkt `1dd2967`. Die Kotlin-Library
(`BluePlayLibrary.kt`) erzeugt für `Image` genau die Operationen `fill`,
`fillRect`, `drawRect`, `fillOval`, `drawOval`, `drawLine`, `drawString` und
`drawImage`; im Actor-Renderer fehlte nur `fill`. Beide Renderer in
`uiParity.ts` verwenden jetzt dieselbe Operationsumsetzung.

Nachweise:

- Reproduktion vor der Korrektur: GUI-86 scheiterte (roter Platzhalter mit „B“,
  zweiter Actor unsichtbar); `test:ui` mit altem `uiParity.ts` scheiterte, weil
  `drawnImageDataUrl(["fill|…"])` `undefined` lieferte.
- Nach der Korrektur: GUI-86 grün; `npm run test:ui` grün; alle Tests aus
  `blueplay.spec.ts`, `blueplay-images.spec.ts` und `main-selection.spec.ts`
  23/23 grün; `npm run typecheck` 0 Fehler/0 Warnungen; `npm run build:svelte`
  erfolgreich; `node scripts/smoke-blueplay-browser.mjs` erfolgreich.
- Vollständiger Chromium-Lauf: 96 bestanden, 9 fehlgeschlagen (GUI-61, GUI-55,
  GUI-39, GUI-41, GUI-32, GUI-22, GUI-35, GUI-16, GUI-68). Gegenprobe mit dem
  unveränderten `uiParity.ts` aus `1dd2967`: dieselben 8 Tests ohne GUI-55
  scheitern auch dort, sie sind also nicht durch diese Änderung verursacht und
  bleiben offen. GUI-55 war im Einzellauf mit altem und neuem Code grün und
  scheiterte nur im Gesamtlauf (vermutlich instabil).
- Port 5194 war durch einen anderen lokalen Prozess belegt; die Läufe nutzten
  eine temporäre, nicht eingecheckte Playwright-Konfiguration auf Port 5294.

### GUI-31: Editor-Tabs standardmäßig öffnen (2026-09-24)

Beim Öffnen der ersten Datei erscheint ein normales Editorfenster. Jede weitere
Datei wird automatisch als Tab in diesem Fenster geöffnet und aktiviert; die
Fenstergeometrie bleibt erhalten. Das bewusste Aufteilen in Einzelfenster bleibt
verfügbar. GUI-31, GUI-33 und GUI-42 decken Standard-Tabs, Aufteilen/Sammeln
und Shift+Escape für den aktiven Tab ab.

Nachweise: betroffene Chromium-Regressionen GUI-28, GUI-31, GUI-33 und GUI-42
6/6 grün; `npm run typecheck` 0 Fehler/0 Warnungen. Der erste Testlauf hatte
5/6 bestanden; der Escape-Test erwartete fälschlich eine Ein-Tab-Leiste, obwohl
der letzte verbleibende Tab korrekt wieder als Einzelfenster dargestellt wird.
Nach Anpassung der Erwartung waren alle 6 Tests grün. Der Standard-Dev-Server
auf Port 5173 war beim Abschluss nicht aktiv.

### RT-38: Ausnahmen aus nativen Funktionen fangen (2026-09-25)

Branch `claude/affectionate-khayyam-3185c6`, Ausgangspunkt `c146fb1`. Ursache:
`TryNode.eval` ließ Kotlin-Ausnahmen des Hosts (etwa die `NumberFormatException`
der binären Stdlib) nur auf `catch (e: Throwable)` passen. Jetzt ordnet
`StandardExceptionValue.classNameOf` die sechs Standardklassen der
gleichnamigen Kotlite-Klasse zu; danach wird wie bei selbst geworfenen
Ausnahmen nach Typ verglichen. Mitgeändert:

- Ganzzahldivision und `%` durch 0 werfen `ArithmeticException: / by zero`
  (vorher ergab `1 / 0` den Wert `0` und `1L / 0L` eine einfache
  `Exception: division by zero`, weil Kotlin/JS so rechnet). Sonst gäbe es in
  BlueK keine `ArithmeticException` aus nativem Code.
- Interpreterfehler (Suspension an der synchronen Grenze, falscher Scope in
  `CallStack.pop`, fehlendes Rücksprungziel) sind `InterpreterStateException`
  und werden von keinem `catch` gefangen, auch nicht von `Throwable`. Sonst
  hätte `catch (e: Exception)` den RT-37-Fehler als `IllegalStateException`
  verschluckt und mit inkonsistentem Aufrufstapel weitergerechnet.
- `printStackTrace()` (`KotliteSession`) nennt die Kotlin-Klasse der Ausnahme.
  Vorher stand dort der Name der Host-Klasse, bei selbst geworfenen Ausnahmen
  etwa `ThrowableValue: x`.

Nachweise:

- Probe gegen das eingecheckte Bundle vor der Änderung (Node, `evaluate`):
  `"x".toInt()` mit `catch (e: NumberFormatException)`,
  `IllegalArgumentException`, `Exception` → Laufzeitfehler
  `NumberFormatException: Invalid number format: 'x'`; mit `Throwable` → `-1`.
  Ebenso ungefangen: `listOf<Int>().first()`, `listOf(1)[5]`,
  `mutableListOf(1).removeAt(3)`, `require(false)`, `check(false)`,
  `mapOf(1 to 2).getValue(3)`, `"12a".toDouble()`.
- Dieselbe Probe gegen das neu gebaute Bundle: alle Fälle von ihrer Klasse, der
  Oberklasse und `Exception` gefangen; `e.message`, `e is NumberFormatException`
  stimmen; `catch (e: IllegalStateException)` fängt die
  `NumberFormatException` weiterhin nicht; `finally` läuft; `1.0 / 0` bleibt
  `Infinity`, `7 / 2` ergibt `3`, `-7 % 3` ergibt `-1`.
- RT-37 über `startEvaluate`: vorher `IllegalStateException: A wrong scope is
  completed`, von `catch (e: Throwable)` gefangen; jetzt
  `InterpreterStateException: …` (bzw. `… Execution suspended at a
  synchronous compatibility boundary` bei `Thread.sleep`), auch innerhalb von
  `try`/`catch (e: Throwable)`.
- `node scripts/smoke-curriculum-kotlin.mjs` gegen das alte Bundle: scheitert
  am ersten neuen Fall; gegen das neue: grün.
- `npm run build:kotlite` erfolgreich. `npm run browser-smoke` grün, nachdem
  `build:player`, `build:offline` und `build:svelte` `frontend/dist` erzeugt
  hatten (der erste Lauf scheiterte in `smoke-static-architecture.mjs`, weil
  im frischen Worktree `frontend/dist` fehlte). `npm run test:runtime-state`
  grün. Zusätzlich grün: `test:generics`, `test:references`,
  `test:kotlin-surface`, `node scripts/check-interactive-core.mjs`,
  `test:blueplay-demos`, `test:player-worker`, `test:codepad-flow`.
- Nicht ausgeführt: `npm run typecheck`, `npm run test:gui`,
  `npm run test:regression`; kein GUI-Test.
- Nebenbefund, nicht behoben und ohne eigene ID: `"abc".substring(5)` liefert
  `""` statt einer `IndexOutOfBoundsException` (JavaScript-Semantik der
  Stdlib). Inzwischen behoben als RT-39.

### RT-37: Suspendierende Lambdas der binären Stdlib (2026-09-25)

Worktree `claude/eloquent-swirles-0ff577` auf `c146fb1` plus die zu diesem
Zeitpunkt nicht eingecheckten Dokumentationsänderungen des Hauptcheckouts.
Ein Lambda, das die binäre `kotlite-stdlib` 1.1.0 aufruft, lief über
`runImmediately`; jede Suspension darin (Checkpoint nach 128 Iterationen,
`readln()`, `Thread.sleep()`) brach die Ausführung ab. Betroffen waren alle 197
Stdlib-Funktionen mit Funktionsparameter (u. a. auch `repeat`, `let`, `run`,
`with`, `also`, `takeIf`, `String.forEach`, `sortedBy`) sowie Schleifen in
`toString()`, wenn `println` es aufrief.

Korrektur (Einzelheiten in `docs/kotlite.md` und `PATCH.md`): Stdlib-Aufrufe
mit Funktionsparameter werden bei einem suspendierten Callback verlassen und
danach mit den gemerkten Callback-Ergebnissen wiederholt; Schülercode läuft
genau einmal. Checkpoints in synchronen Callbacks geben nicht ab.
`MutableList.removeAll { }`/`retainAll { }` sind nicht wiederholbar und wie
`count { }` suspendierbar ersetzt. Wo nicht unterbrochen werden kann
(`toString()` usw.), melden `readln()`/`Thread.sleep()` einen Fehler; die
synchrone Alt-API meldet bei leerem Eingabepuffer jetzt auch für `readln`
„requires asynchronous execution“ statt eine Continuation zurückzulassen.

Nachweise:

- Vorher (eingechecktes Bundle): temporäre Probe in Node mit 21 Fällen, 14
  Laufzeitfehler (`A wrong scope is completed` bzw. `Execution suspended at a
  synchronous compatibility boundary`); 3 weitere Fälle scheitern an
  unabhängigen Analysegrenzen (`add` in `apply`, Destrukturierung, `compareBy`).
- Nachher: dieselbe Probe ohne Laufzeitfehler (die 3 Analysefehler bleiben);
  zusätzliche temporäre Probe mit
  31 Fällen, jeweils mit vorab gepufferter Eingabe (ohne Suspension) und mit
  Eingabe erst auf Anforderung: 31/31 gleiche Ergebnisse und Ausgaben.
- Neue Tests: RT-37-Block in `scripts/smoke-runtime-state.mjs` und in
  `scripts/smoke-kotlite-browser.mjs`; beide scheitern mit dem alten Bundle
  (`A wrong scope is completed`) und sind mit dem neuen grün.
- `npm run build:kotlite` erfolgreich; `npm run browser-smoke` grün (nach
  `npm run build:player` und `npm run build:svelte`, weil der Worktree kein
  `frontend/dist` hatte); `npm run test:generics`, `test:references`,
  `test:kotlin-surface`, `test:blueplay-demos`, `test:player-worker`,
  `test:codepad-flow` und `node scripts/check-interactive-core.mjs` grün.
- `node scripts/benchmark-blueplay.mjs` mit altem und neuem Bundle je zweimal:
  Tick-Mittel ohne Schießen 0,98/0,95 ms → 0,95/0,98 ms, mit Schießen
  3,09/3,05 ms → 3,15/3,16 ms (im Rauschen). Lambda-lastige Mikromessung
  (`(1..200000).forEach`, `map`/`filter` über 100 000 Elemente) 3–8 % langsamer.
- `npm run test:gui` (`npx playwright test`): 120/123 grün. GUI-83, GUI-18 und
  GUI-67 scheitern auch mit dem alten Bundle (Gegenprobe nur dieser drei Tests)
  und sind nicht durch RT-37 verursacht: GUI-67 erwartet noch „Export as HTML“
  ohne „(Beta)“ (EXP-08), GUI-83 scheitert, weil das Terminal den Klick auf den
  Editor-Kopf abfängt, GUI-18 findet nach Doppelklick auf die Objekte keine
  Inspektoren. Sie bleiben offen.

Zusammenspiel mit RT-38 (parallel im Worktree
`claude/affectionate-khayyam-3185c6`, dort nicht committet; bei diesen
Nachweisen nicht enthalten): Beide ändern `Interpreter.runImmediately`; beim
Zusammenführen wirft der verbleibende Rückfall „Execution suspended at a
synchronous compatibility boundary“ die `InterpreterStateException` aus RT-38.
Das Bundle muss danach neu gebaut werden. Der RT-38-Fall „interpreter failure
inside catch (e: Throwable)“ in `smoke-curriculum-kotlin.mjs` löst den
Interpreterfehler über `(1..200).toList().forEach { for (…) { } }` aus; mit
RT-37 läuft dieser Code fehlerfrei, der Fall muss daher ersetzt werden. Die
Fehlermeldungen für `readln()`/`Thread.sleep()` in `toString()` usw. sind
gewöhnliche `IllegalStateException`s, die vor jeder Suspension geworfen werden;
mit RT-38 sollten sie daher per `catch` fangbar sein. RT-37 und RT-38 wurden
nicht gemeinsam gebaut oder getestet. (Inzwischen zusammengeführt, siehe
„Zusammenführung RT-37, RT-38 und RT-39“.)

Offen: kein Browser-/GUI-Test mit Eingabe in einem Stdlib-Lambda; Schleifen in
synchronen Callbacks geben nicht an den Worker ab (lange Rechnungen dort
blockieren Ausgabe-Streaming bis zum Ende). Kein Commit und kein Push.

### RT-39: `String.substring` prüft die Grenzen (2026-09-25)

Worktree `claude/affectionate-khayyam-3185c6` auf `c146fb1` mit den dort nicht
committeten RT-38-Änderungen; die RT-37-Änderungen des Hauptcheckouts sind
nicht enthalten. Die binäre Stdlib registriert
`String.substring(startIndex: Int, endIndex: Int = length)` und ruft das
`substring` von Kotlin/JS auf. Das verhält sich wie in JavaScript: Ungültige
Indizes werden auf den gültigen Bereich begrenzt, vertauschte Grenzen
getauscht. `KotliteSession` ersetzt die Funktion wie `count { }` per
`patchFunction` durch eine Fassung mit Kotlins Prüfung (`startIndex < 0`,
`startIndex > endIndex`, `endIndex > length`). Sie wirft
`IndexOutOfBoundsException("begin …, end …, length …")`, die über RT-38 fangbar
ist. Andere String-Funktionen mit Indizes werfen bereits (`"abc"[5]`,
`take(-1)`, `drop(-1)`, `repeat(-1)`, `padStart(-1)`, `removeRange(1, 10)`,
`"".first()`) oder sind in BlueK nicht verfügbar (`subSequence`, `slice`,
`substring(IntRange)`).

Nachweise:

- Vorher (Bundle mit RT-38): `"abc".substring(5)` → `""`,
  `substring(1, 10)` → `"bc"`, `substring(2, 1)` → `"b"`, `substring(-1)` →
  `"abc"`, `substring(-1, 2)` → `"ab"`.
- Nachher: diese Aufrufe werfen `IndexOutOfBoundsException: begin 5, end 3,
  length 3` usw.; gültige Aufrufe unverändert (`substring(3)` → `""`,
  `substring(0)`, `substring(1, 1)`, `"".substring(0)`, benannte Argumente),
  ebenso `substringBefore`.
- Neuer Block in `scripts/smoke-curriculum-kotlin.mjs`: scheitert mit dem
  Bundle vor der Korrektur, grün mit dem neuen.
- `npm run build:kotlite` erfolgreich. `npm run browser-smoke` (nach
  `build:player`, `build:offline`, `build:svelte`) und
  `npm run test:runtime-state` grün, ebenso `test:generics`,
  `test:references`, `test:kotlin-surface`,
  `node scripts/check-interactive-core.mjs`, `test:blueplay-demos`,
  `test:blueplay-stage`, `test:player-worker`, `test:codepad-flow`.
- BluePlay-Library und Beispiele benutzen `substring` in Zeichenschleifen
  (`drawString`, `drawImage`, `drawingJson`), immer im gültigen Bereich.
  `node scripts/benchmark-blueplay.mjs` je zweimal mit dem Bundle vor und nach
  der Korrektur: Tick-Mittel ohne Schießen 0,93/0,96 ms → 0,97/0,96 ms, mit
  Schießen 3,11/3,10 ms → 3,12/3,10 ms (im Rauschen).
  `npx playwright test tests/gui/blueplay-images.spec.ts tests/gui/blueplay.spec.ts`:
  17/17 grün.
- Nicht ausgeführt: `npm run typecheck` und der vollständige
  `npm run test:gui`.

Zusammenführen mit RT-37: Beide Stände ändern `KotliteSession.kt` an derselben
Stelle (Patches neben `count { }`); das Bundle muss danach neu gebaut werden.
(Inzwischen zusammengeführt, siehe „Zusammenführung RT-37, RT-38 und RT-39“.)
Kein Commit und kein Push.

### GUI-18, GUI-67, GUI-83: rote GUI-Tests auf c146fb1 (2026-09-25)

Worktree `claude/bold-galileo-64c9d3`, Ausgangspunkt `c146fb1`. Drei
Chromium-Tests in `regressions.spec.ts` scheiterten reproduzierbar, auch mit
dem eingecheckten Kotlite-Bundle; der Interpreter ist nicht beteiligt.

- GUI-67: veraltete Testerwartung. 67671c2 führte „Export as HTML (Beta)“ ein
  (EXP-08, `html-export.spec.ts` prüft den Zusatz bereits); GUI-67 erwartete
  noch „Export as HTML“. Nur die Erwartung ist angepasst.
- GUI-83: fehlerhafter Testaufbau, kein Fehler in Platzierung oder
  Z-Stapel. Terminal und Editor öffnen beide zentriert mit 780 × 520 px; das
  danach geöffnete Terminal verdeckt die Editor-Titelleiste vollständig, sodass
  der Klick auf `.editor-header` nicht ankommen kann. Gegenprobe: Auf dem
  einführenden Commit 1de37a1 (Export per `git archive`) scheitert GUI-83
  identisch; 5e61ef0 ist also nicht die Ursache. Der Test war seit der
  Einführung nie grün (Checkliste: „nicht ausgeführt“). GUI-30 behandelt die
  Überdeckung bereits durch Verschieben des Terminals. GUI-83 öffnet jetzt erst
  das Terminal, dann per Doppelklick den Editor, prüft die Ausgangslage (Editor
  aktiv, Terminal nicht) und danach wie bisher Aktivierung und Z-Index 30 des
  Terminals nach Programmausgabe.
- GUI-18: echte Regression durch c146fb1. `inspectObject` öffnete den Inspektor
  nur noch bei `kind === "inspect"`; primitive Werte antworten auf `inspect`
  aber mit `kind: "scalar"` (`KotliteSession.inspect` → `result("value", …)`).
  Doppelklick auf `5` oder `"Hallo"` auf der Objektbank öffnete daher nichts.
  `inspectObject` akzeptiert wieder jede Antwort außer `error` (wie vor
  c146fb1); Generationswechsel (`null`) öffnet weiterhin nichts. Der Pfeilpfad
  `inspectFieldReference` bleibt auf Objekte beschränkt.

Nachweise:

- Vorher: `npx playwright test -g "GUI-83|GUI-18 primitive|GUI-67"` 0/3 grün
  (GUI-83 Timeout, weil `.terminal-modal` den Klick abfängt; GUI-18 0 statt 2
  `.inspect-window`; GUI-67 „Export as HTML (Beta)“ statt „Export as HTML“).
- Nachher: derselbe Aufruf 3/3 grün; `npm run typecheck` 0 Fehler/0 Warnungen;
  `npm run test:ui` grün; `node scripts/smoke-svelte-architecture.mjs` grün.
- `npm run test:gui` komplett: 123/123 grün (2,9 min).
- Nicht ausgeführt: `node scripts/smoke-static-architecture.mjs` bricht im
  Worktree ohne Produktionsbuild ab (`frontend/dist/kotlite/…` fehlt); kein
  `npm run build:svelte` in diesem Lauf. `node_modules` ist im Worktree ein
  Symlink auf den Hauptcheckout.

Offen: visuelle Abnahme der primitiven Inspektoren (GUI-18) durch den Nutzer.
Kein Push.

### Zusammenführung RT-37, RT-38 und RT-39 (2026-09-25)

Worktree `claude/affectionate-khayyam-3185c6` auf `c146fb1`: der RT-38/RT-39-Stand
plus die nicht committeten RT-37-Codeänderungen des Hauptcheckouts von diesem
Tag. Die Korrektur für GUI-18, GUI-67 und GUI-83 (Worktree
`claude/bold-galileo-64c9d3`) ist nicht enthalten. Konflikte gab es nur an
zwei Stellen: In `KotliteSession.kt` stehen jetzt die RT-37-Patches für
`removeAll`/`retainAll` und der `substring`-Patch aus RT-39 nebeneinander. In
`Interpreter.runImmediately` gilt die RT-37-Fassung; ihr verbleibender
Fehlerfall für nicht wiederholbare Callbacks wirft die
`InterpreterStateException` aus RT-38.

Verhalten des kombinierten Stands:

- Ausnahmen aus Lambdas, die suspendiert und danach wiederholt werden,
  behalten ihre Klasse: `try { listOf("1", "x").map { Thread.sleep(1);
  it.toInt() } } catch (e: NumberFormatException)` fängt, ebenso eine im Lambda
  geworfene `IllegalArgumentException`, `ArithmeticException` aus `10 / 0` und
  die `substring`-Ausnahme aus RT-39.
- RT-37 meldet `readln()`/`Thread.sleep()`, wo nicht pausiert werden kann
  („… cannot pause inside toString() …“, in der synchronen Alt-API „…
  requires asynchronous execution“), per `check` vor jeder Suspension. Das ist
  eine gewöhnliche `IllegalStateException`; `catch (e: IllegalStateException)`
  und `catch (e: Exception)` fangen sie. Ohne `catch` bleibt es ein
  Laufzeitfehler. (Inzwischen geändert, siehe „„cannot pause“ nicht mehr
  fangbar“.)
- Aus Schülercode ist keine `InterpreterStateException` mehr erreichbar:
  `(1..200).toList().forEach { for (…) { } }` in `try`/`catch (e: Throwable)`
  läuft jetzt fehlerfrei durch. Die Umgehung von `catch` bleibt als
  Absicherung und ist nicht getestet. (Inzwischen wieder erreichbar und
  getestet, siehe „„cannot pause“ nicht mehr fangbar“.) `AbandonedNativeCall` läuft nur durch
  nativen Bibliothekscode und erreicht kein `try`.

Test: Der RT-38-Fall „interpreter failure inside catch (e: Throwable)“ in
`smoke-curriculum-kotlin.mjs` ist durch einen Block über die asynchrone API
ersetzt. Er prüft drei Ausnahmen aus suspendierten `map`-Lambdas
(`NumberFormatException`, `ArithmeticException`, `IndexOutOfBoundsException`
aus `substring`) und die gefangene Meldung aus einem `toString()` mit
`Thread.sleep`.

Nachweise:

- `npm run build:kotlite` erfolgreich.
- `node scripts/smoke-curriculum-kotlin.mjs`: grün mit dem kombinierten
  Bundle. Mit dem RT-37-Bundle des Hauptcheckouts scheitert er an den
  RT-38-Fällen, mit dem RT-38/39-Bundle am neuen Block
  (`InterpreterStateException: A wrong scope is completed`).
- Zusätzliche Probe über die asynchrone API: `IllegalArgumentException` aus
  einem suspendierten Lambda gefangen; ungefangen bleiben
  `NumberFormatException: Invalid number format: 'x'` bzw.
  `IllegalStateException: Thread.sleep() cannot pause …` die Meldung; eine
  `for`-Schleife mit `Thread.sleep` und `try`/`catch` um `toInt()` ergibt
  `104`.
- Nach `build:player`, `build:offline` und `build:svelte` grün:
  `npm run browser-smoke`, `test:runtime-state`, `test:generics`,
  `test:references`, `test:kotlin-surface`,
  `node scripts/check-interactive-core.mjs`, `test:blueplay-demos`,
  `test:blueplay-stage`, `test:player-worker`, `test:codepad-flow`,
  `test:ui`, `test:inspector`, `test:project-format`, `test:program-export`,
  `test:offline`; `npm run typecheck` 0 Fehler/0 Warnungen. Damit liefen alle
  Bestandteile von `npm run test:regression` einzeln.
- `npx playwright test`: 120/123 grün. GUI-83, GUI-18 und GUI-67 scheitern
  auch mit dem Bundle aus `c146fb1` (Gegenprobe nur dieser drei); ihre
  Korrektur steht im Eintrag „GUI-18, GUI-67, GUI-83“ und ist hier nicht
  enthalten.
- `node scripts/benchmark-blueplay.mjs` je zweimal, RT-37-Bundle gegen das
  kombinierte: Tick-Mittel ohne Schießen 0,95/0,96 ms → 0,97/0,96 ms, mit
  Schießen 3,13/3,20 ms → 3,18/3,13 ms (im Rauschen).

Kein Commit und kein Push.

### RT-37/RT-38: „cannot pause“ nicht mehr fangbar (2026-09-25)

Nutzerentscheidung. `readln()` und `Thread.sleep()` können in `toString()`,
`equals()`, `hashCode()`, `compareTo()`, in nicht wiederholbaren
Bibliotheks-Callbacks und in der synchronen Alt-API nicht warten; BlueK meldet
das vor jeder Suspension. Die Meldung war bisher eine `IllegalStateException`,
sodass ein umgebendes `catch (e: Exception)` sie verschluckte und das Warten
stillschweigend entfiel. Sie ist eine Grenze von BlueK, keine Ausnahme des
Programms (echtes Kotlin würde hier nicht werfen). `KotliteSession.checkCanPause`
wirft deshalb jetzt `InterpreterStateException`. Die geht an jedem `catch`
vorbei, `finally` läuft weiterhin. Angezeigt wird jetzt
`InterpreterStateException: Thread.sleep() cannot pause inside toString() …`;
die Meldung der synchronen Alt-API lautet einheitlich
`Thread.sleep() requires asynchronous execution (startEvaluate).` bzw.
`readln() requires …` (vorher ohne Klammern).

Worktree `claude/affectionate-khayyam-3185c6`; Code-Ausgangsstand gleich dem
Hauptcheckout nach der Zusammenführung von RT-37, RT-38 und RT-39.

Nachweise:

- `smoke-curriculum-kotlin.mjs`:
  `try { println(Z()) } catch (e: Throwable) { println("gefangen") } finally { println("finally") }`
  mit `Thread.sleep` in `Z.toString()` endet mit
  `InterpreterStateException: Thread.sleep() cannot pause inside toString() …`;
  ausgegeben wird nur `finally`. Mit dem Bundle vor der Änderung scheitert der
  Fall (der Fehler wurde gefangen), mit dem neuen ist er grün.
- Probe: `readln()` in `toString()` mit `catch (e: IllegalStateException)` und
  `Thread.sleep` in `toString()` mit `catch (e: Exception)` werden nicht
  gefangen. `Thread.sleep` in einem `forEach`-Lambda innerhalb von `try` wartet
  weiterhin. In der synchronen Alt-API meldet
  `try { Thread.sleep(1) } catch (e: Throwable) { … }` den Fehler.
- `npm run build:kotlite` erfolgreich. Nach `build:player`, `build:offline` und
  `build:svelte` grün: `npm run browser-smoke`, `test:runtime-state`,
  `test:generics`, `test:references`, `test:kotlin-surface`,
  `node scripts/check-interactive-core.mjs`, `test:blueplay-demos`,
  `test:blueplay-stage`, `test:player-worker`, `test:codepad-flow`,
  `test:ui`, `test:inspector`, `test:project-format`, `test:program-export`,
  `test:offline`; `npm run typecheck` 0 Fehler/0 Warnungen.
- `npx playwright test`: 120/123 grün; es scheitern nur GUI-83, GUI-18 und
  GUI-67 (unabhängig, siehe „GUI-18, GUI-67, GUI-83“).

Kein Commit und kein Push.

### Gesamtstand RT-37/38/39 mit GUI-18/67/83 (2026-09-25)

Prüfung des Hauptcheckouts (`beta` auf `7d13adb` plus die nicht committeten
Änderungen für RT-37, RT-38, RT-39 und „cannot pause“), Datei für Datei
gespiegelt im Worktree `claude/eloquent-swirles-0ff577`. Die bisherigen
Einträge prüften die Zusammenführung ohne die GUI-Korrektur aus `7d13adb`.

Nachweise:

- Bundle: `npm run build:kotlite` aus diesem Quellstand erzeugt denselben
  Programmcode wie das Bundle im Hauptcheckout. Beide unterscheiden sich nur in
  der Reihenfolge der 14 Kotlin/JS-`Math`-Polyfills am Dateianfang (Bytes
  1663–4412; gleiche Größe, gleiche Zeichen, Rest byteidentisch). Zwei Builds
  im selben Worktree waren byteidentisch; die Reihenfolge hängt also an der
  Build-Umgebung. Alle Tests liefen mit dem Bundle des Hauptcheckouts.
- Nach `build:player` und `build:svelte` grün: `npm run typecheck`,
  `browser-smoke`, `test:runtime-state`, `test:generics`, `test:references`,
  `test:kotlin-surface`, `node scripts/check-interactive-core.mjs`,
  `test:blueplay-demos`, `test:blueplay-stage`, `test:player-worker`,
  `test:codepad-flow`, `test:ui`, `test:inspector`, `test:project-format`,
  `test:program-export`, `test:offline`. Damit liefen alle Bestandteile von
  `npm run test:regression` einzeln.
- `npx playwright test`: 123/123 grün.
- Temporäre RT-37-Probe (31 Fälle, Eingabe vorab gepuffert gegen erst auf
  Anforderung): 31/31 gleiche Ergebnisse und Ausgaben. `readln()`/
  `Thread.sleep()` in `toString()` (auch über String-Template und innerhalb von
  `forEach`) und im `withDefault`-Lambda enden mit
  `InterpreterStateException: … cannot pause …`.

Offen wie bisher: kein GUI-Test mit Eingabe in einem Stdlib-Lambda; Schleifen
in synchronen Callbacks geben nicht an den Worker ab. Kein Commit und kein Push.

2026-09-26: `.` auf nullable Empfänger (`alle.add(x)` bei `MutableList<T>?`)
meldete „`add` is unknown for MutableList<T>: … Check the spelling" statt der
kotlinc-Meldung „Only safe (?.) or non-null asserted (!!.) calls are allowed on
a nullable receiver of type '…?'". Der Analyzer meldet jetzt Letztere
(`SemanticAnalyzer.NavigationNode.visit`, Eintrag in `PATCH.md`), Funktions- wie
Property-Zugriff und Zuweisung; `?.`, `!!.`, Smart Cast und `isNullOrEmpty()`
laufen weiter. `build:kotlite` neu gebaut; `test:kotlin-surface` (mit neuen
Fällen), `test:references`, `test:generics`, `test:blueplay-demos`,
`smoke-kotlite-browser`, `smoke-curriculum-kotlin` und `smoke-runtime-state`
erfolgreich. `browser-smoke` als Ganzes nicht gelaufen (braucht `frontend/dist`),
GUI-Suite nicht ausgeführt. Anzeige im Editor im Browser geprüft (Dev-Server
des Worktrees, Klasse `Hund` aus dem Nutzer-Screenshot): Zeile 6 rot markiert,
Meldung „Line 6: Only safe (?.) or non-null asserted (!!.) calls are allowed on
a nullable receiver of type 'MutableList<Mensch>?'.“; mit `alle?.add(value)`
keine Meldung. Der Klassen-Property-Fall (`var alle: MutableList<T>?` in einer Klasse)
ist als Test ergänzt; das Ergebnis stimmt im Wortlaut mit play.kotlinlang.org
(Kotlin 2.4.20, Screenshot des Nutzers) überein.

Nachtrag: `toString()`, `equals()` und `hashCode()` auf nullable Empfängern
(`Any?`-Erweiterungen in `BlueKStdlibModule`) ergänzt; eigene Überschreibungen
werden dabei aufgerufen. Nicht neu und offen: `other is T && other.x` (Smart
Cast nach `&&`) wird von Kotlite nicht erkannt, `equals`-Überschreibungen
brauchen dort `(other as T).x`.

### GUI-90: Objektfelder im Inspektor bearbeiten (2026-09-26)

Ausgangspunkt `6c797d5`. Ursache: `beginFieldEdit` belegte das Eingabefeld mit
dem passiven Anzeigetext des Felds vor. Für Objekte ist das
`ClassInstance.convertToString(isCallCustomFunction = false)`, also `Hund()` –
zufällig gültiges Kotlin. Enter führte damit `hund1.freund = Hund()` aus und
erzeugte unbemerkt ein neues Objekt (bei Konstruktoren mit Parametern gab es
nur einen Compilefehler). Collections lieferten `[…] (size n)`, was beim
Bestätigen einen Fehler ergab.

Änderung (Varianten A und D aus der Besprechung):

- `KotliteSession.inspect` markiert Collection- und Map-Felder zusätzlich zu
  `reference` mit `summary`; `InspectedField` im Laufzeitvertrag trägt das
  optionale Feld. Bundle neu gebaut.
- Objekt- und Collection-Felder beginnen leer (Platzhalter „expression“);
  einfache Werte bleiben vorbelegt. Enter auf einem leeren Feld bricht ohne `set` ab.
- Solange ein Feld bearbeitet wird, fügt ein Klick auf ein Objekt der
  Objektbank dessen Namen an der Cursorposition ein. `mousedown` wird dabei
  verhindert, damit der Fokus im Feld bleibt; der zweite Klick eines
  Doppelklicks fügt nichts ein, und der Doppelklick öffnet keinen Inspektor.
  Bank-Objekte zeigen währenddessen den Kopier-Cursor und beim Überfahren
  einen gestrichelten Rahmen.

Nachweise:

- Vorher: GUI-90 auf `6c797d5` (temporärer Worktree, neuer Test) rot –
  `Value of freund` enthielt `"Hund()"` statt `""`.
- Nachher: `npx playwright test tests/gui/regressions.spec.ts
  tests/gui/references.spec.ts` 80/80 grün (1,3 min), darin GUI-90, GUI-03/04,
  GUI-48, GUI-88 und GUI-89.
- `npm run typecheck` 0 Fehler/0 Warnungen; `npm run build:kotlite`
  erfolgreich; `npm run test:references`, `npm run test:runtime-state`,
  `npm run test:ui`, `node scripts/smoke-kotlite-browser.mjs`,
  `node scripts/smoke-curriculum-kotlin.mjs` und
  `node scripts/smoke-svelte-architecture.mjs` grün.
- Chromium-Screenshots der Zustände „leer“ und „nach Klick auf `luna`“
  geprüft: Der Platzhalter passt in die Wertspalte. Eine zunächst eingebaute
  Hinweiszeile unter dem Feld wurde auf Wunsch des Nutzers wieder entfernt.
- Nicht ausgeführt: vollständiges `npm run test:gui` (übrige Specs sind von
  der Änderung nicht berührt).

Offen: visuelle Abnahme durch den Nutzer. Kein Commit.

### RT-42, RT-43: Endlose Rekursion und sich selbst aufrufende Accessoren (2026-09-26)

Ausgangspunkt `6c797d5` mit GUI-90. Gemeldet: Im Inspektor `Mensch()` in das
Feld `herrchen` eines Hundes eingegeben, Ergebnis „NullPointerException:
Kotlite evaluation failed.“ und angehaltene Laufzeit. Der Setter des Nutzers
enthielt `herrchen = value` statt `field = value` und rief sich damit endlos
selbst auf. Nachgestellt gegen die Session (Node): Jede Endlosrekursion, auch
`fun f(n: Int): Int = f(n + 1)`, endete so, ebenso mit `catch (e: Throwable)`.
Ursache: `RangeError` des JavaScript-Stacks, dann `NullPointerException` aus
`fullClassName` (`this::class.simpleName!!`) beim Aufbereiten. Außerdem
reichte der Stack nur für 117 verschachtelte Aufrufe (Chromium-Worker, Node
175), sodass auch korrekte Rekursion ab dieser Tiefe abstürzte.

Änderung: Aufruftiefe mit Grenze 1000 und `StackOverflowError` (neue Klassen
`Error`, `StackOverflowError`), Fortsetzung auf frischem Stack alle 32 Aufrufe
über eine Microtask, Zuordnung des Browser-Überlaufs zu `StackOverflowError`,
`SymbolTable`-Suchen als Schleifen, Compile-Warnung für Accessoren, die ihre
eigene Property benutzen (Diagnose `severity: "warning"`; nur Fehler lassen den
Compile scheitern). Einzelheiten in `docs/kotlite.md` und `PATCH.md`.

Messungen (Chromium-Worker, neue Sitzung): Vor der Änderung maximale Tiefe 117;
mit Fortsetzung, aber rekursiver Namenssuche 1022; mit Schleifen-Suche ist nur
noch die Zeit begrenzend: Tiefe 1000 0,3 s, 2000 0,7 s, 4000 2,7 s, 10000 14 s
(quadratisch, weil jede Namenssuche durch die Scopes aller Aufrufer läuft).
Deshalb liegt die Grenze bei 1000. Der Setter-Fall des Nutzers bricht in Node
nach 0,9 s ab (bei Grenze 2000: 2,4 s).

Nachweise:

- `node scripts/smoke-kotlite-browser.mjs` grün, mit den neuen RT-42/RT-43-Fällen.
- Chromium-Test „RT-42 RT-43 a setter that calls itself is a compile warning
  and a StackOverflowError instead of a crash“ grün.
- `npx playwright test` komplett: 125/125 grün (4,1 min), nach `npm run
  build:player` und `npm run build:offline`.
- `npm run typecheck` 0 Fehler/0 Warnungen; `npm run build:kotlite`
  erfolgreich; grün: `test:ui`, `test:runtime-state`, `test:references`,
  `test:kotlin-surface`, `test:inspector`, `test:blueplay-stage`,
  `test:project-format`, `test:program-export`, `test:player-worker`,
  `test:codepad-flow`, `test:generics`, `test:blueplay-demos`, `test:offline`,
  `smoke-svelte-architecture`, `smoke-blueplay-browser`,
  `smoke-curriculum-kotlin`.
- Chromium-Screenshots: gelbe Warnung im Editor von `Hund.kt` Zeile 5 und
  `StackOverflowError` im Inspektor geprüft.
- Nicht ausgeführt: `smoke-static-architecture` (braucht den
  Produktionsbuild), Safari/Firefox (Stack-Größe und Laufzeit ungemessen).

Die IDs RT-40/RT-41 sind frei gelassen: Parallele Arbeitsstände
(Smart Casts, gegenseitige Klassenverweise) verwenden sie voraussichtlich.
Offen: visuelle Abnahme der Warnung durch den Nutzer. Kein Commit.

### RT-44: Safe Call von `toString()`/`equals()`/`hashCode()` mehrdeutig (2026-09-26)

Ausgangspunkt `936652c` (`beta`). Gemeldet: `node scripts/smoke-blueplay-browser.mjs`
scheitert beim Laden von `examples/blueplay/*` mit „Ambiguous function call for
`toString`. 2 candidates match: - Int.toString() - Any?.toString()“
(`World.kt` Zeile 35: `current.image?.transparency?.toString() ?: "255"`).
Nachgestellt gegen das eingecheckte Bundle (Node): `n?.toString()`,
`n?.equals(5)`, `n?.hashCode()` bei `Int?`, dieselben bei `String?`, `Double?`,
`Char?`, `Boolean?`, `List<Int>?` und eigenen Klassen scheiterten so; `n.toString()`
ohne Safe Call lief. Mit dem Bundle aus `6c797d5` (vor 34c8c91) liefen alle
außer `s?.equals("a")` bei `String?`, das schon dort zwischen
`String.equals(Any?)` und `String?.equals(String?, Boolean)` mehrdeutig war.

Ursache: Für `?.` auf einem nullable Empfänger sucht
`SemanticAnalyzer.FunctionCallNode.visit` die Kandidaten für `T` und für `T?`
und vereinigte beide Ergebnisse. Jede Suche behält nur den spezifischsten
Kandidaten, die Vereinigung verglich aber nichts; seit den `Any?`-Erweiterungen
aus 34c8c91 fand die `T?`-Suche immer einen zweiten. Der Fehler fiel dort nicht
auf, weil `smoke-blueplay-browser` nicht lief (Eintrag „2026-09-26: `.` auf
nullable Empfänger …“ unter „Gesamtstand RT-37/38/39 mit GUI-18/67/83“:
`browser-smoke` nicht als Ganzes); die GUI-Suite enthält keinen Safe Call
dieser Art.

Änderung: Der Aufruf nimmt das Ergebnis der ersten Suche mit Treffer, also `T`
(jeder Kandidat von `T?` passt auch auf `T`), und `T?` nur als Rückfall, wie
schon `NavigationNode.visitMember` bei Properties (`PATCH.md`). Aufrufe, die
vorher eindeutig waren, lösen gleich auf; nur frühere Mehrdeutigkeiten ändern
sich. Die `Any?`-Erweiterungen in `BlueKStdlibModule` bleiben für `.` auf
nullable Empfängern (`nn1.toString()` usw.) unverändert.

Nachweise:

- Zuerst geschrieben und rot gegen das Bundle aus `936652c`: 11 neue Fälle in
  `scripts/smoke-kotlin-surface.mjs` (`?.toString()`, `?.equals(...)`,
  `?.hashCode()` auf `Int?`, `String?`, eigener Klasse mit und ohne
  Überschreibung, `null`-Empfänger, `?.toString() ?: "255"`), alle mit
  „Ambiguous function call“; ebenso `smoke-blueplay-browser`.
- `npm run build:kotlite` erfolgreich; danach grün: `test:kotlin-surface`
  (70 supported, 13 gaps, 23 messages), `browser-smoke` komplett
  (`smoke-static-architecture` nach `npm run build:svelte`,
  `smoke-svelte-architecture`, `smoke-kotlite-browser`,
  `smoke-blueplay-browser`, `smoke-curriculum-kotlin`, `test:runtime-state`),
  `test:references`, `test:generics` (beide Skripte), `test:blueplay-demos`.
- `npx playwright test` komplett: 125/125 grün (5,2 min), nach `npm run
  build:player` und `npm run build:offline`.
- Zusätzliche Proben (Node, neues Bundle): `a?.toString()` bei `Any?`,
  `s?.isNullOrEmpty()`, eigene Erweiterung auf `String?` und generisches
  `T?.orElse` über `?.`, `l?.add(2)`, `m?.get("a")`, `l?.sorted()?.first()`,
  `s.equals("a")` bei `String?` unverändert.
- Nicht ausgeführt: `npm run typecheck` und die übrigen TypeScript-Modultests
  (keine TypeScript-Änderung); kein eigener GUI-Test für RT-44.

Unverändert offen (vorher wie nachher): `n?.toString(2)` (Basis) gibt es nicht;
`fun T.f()` und `fun T?.f()` zugleich zu deklarieren ist ein
`DuplicateIdentifierException`. Kein Commit und kein Push.

### RT-40: Klassen, die einander verwenden (2026-09-26)

Worktree `claude/serene-hellman-e848cd` auf `6c797d5`. Reproduktion über
`KotliteSession.startLoadProject` mit `Hund.kt` (`var herrchen: Mensch?`,
`var frauchen: Mensch?`, `val alle = mutableListOf<Mensch>()`) und fünf
Varianten von `Mensch.kt`: Mit dem eingecheckten Bundle scheiterten alle zehn
Kombinationen aus Variante und Dateireihenfolge. Upstream analysiert
Deklarationen strikt nacheinander; das Umordnen in `ReplAnalyzer` nach
Fehlermeldungen konnte einen Zyklus nicht auflösen.

Änderung (`vendor/kotlite-interpreter`, Eintrag in `PATCH.md`):

- `SemanticAnalyzer.declareClassesAhead` legt vor jeder Analyse für jede
  Klasse des Skripts die `ClassDefinition` samt Oberklassen, Nullable- und
  Companion-Definition und Klassen-Scopes an, ohne Symbolnummern zu
  verbrauchen. Die normale Klassenanalyse vervollständigt dieselben Objekte;
  sie läuft an der Stelle der Klasse oder früher bei Bedarf
  (`ClassDefinition.pendingAnalysis`, ausgelöst durch Member-Zugriffe), immer
  nach den Oberklassen. Zyklen in der Vererbung melden jetzt „There is a cycle
  in the inheritance hierarchy of …“ (vorher „Super class … not found“ bzw.
  „Interface … cannot be found“).
- Laufzeit: `ClassDefinition.deferProperties` löst Property-Typen erst bei
  der ersten Verwendung auf. `ReplAnalyzer` analysiert in
  Quelltextreihenfolge ohne Wiederholungen und liefert die Klassen zuerst
  (Oberklassen vor Unterklassen); ein Enum mit Nicht-Literal-Argumenten
  bleibt an seiner Stelle.

Beim Testen gefunden und vor Abschluss behoben (beides Folgen des ersten
Entwurfs, nie eingecheckt): Ein unqualifizierter Aufruf in einem
Konstruktor-Default (`Ablage()`) fand die noch unvollständige eigene Klasse
(„memberFunctionsForSA not initialized“), und ein Enum mit `EINS(basis)`
wurde vor `val basis` ausgewertet. Beide Fälle stehen jetzt im RT-40-Block.

Nachweise:

- `smoke-curriculum-kotlin.mjs`, RT-40-Block: fünf Varianten in beiden
  Dateireihenfolgen und als ein Quelltext, Assoziation Tier/Hund/Mensch mit
  Interface `Halter` und Aufrufen in beide Richtungen in beiden Reihenfolgen,
  zwei gegenseitige Klassen im Codepad mit erhaltenen früheren Bindungen,
  Konstruktor-Defaults, Enums vor ihrer Datei, fehlende Klasse, zyklische
  Klassen und Interfaces. Mit dem alten Bundle rot (`Cannot resolve type
  Hund?`), mit dem neuen grün.
- GUI-Test „RT-40 classes that reference each other compile and link their
  objects“: mit dem alten Bundle rot (beide Karten bleiben uncompiliert,
  Editor zeigt `Line 1: SemanticException: Cannot resolve type Hund?`), mit
  dem neuen grün.
- Nach `npm run build:kotlite`, `build:player`, `build:offline` und
  `build:svelte` grün: `smoke-static-architecture`, `smoke-svelte-architecture`,
  `smoke-kotlite-browser`, `smoke-blueplay-browser`, `smoke-curriculum-kotlin`,
  `test:runtime-state`, `test:references`, `test:generics`,
  `test:kotlin-surface`, `test:blueplay-demos`, `check-interactive-core`,
  `test:ui`, `test:inspector`, `test:blueplay-stage`, `test:project-format`,
  `test:program-export`, `test:player-worker`, `test:codepad-flow`,
  `test:offline`; `npm run typecheck` 0 Fehler/0 Warnungen.
- `npx playwright test`: 124/124 grün mit dem endgültigen Bundle.
- `benchmark-blueplay.mjs`: Schritt im Mittel 1,08/3,19 ms (neu) gegen
  1,06/3,28 ms (alt), im Rauschen. Laden der Space-Invaders-Vorlage
  alphabetisch 167 ms statt 573 ms (keine Wiederholungsanalysen mehr), in
  Dateireihenfolge unverändert rund 165 ms.
- Proben, in altem und neuem Bundle gleich (vorbestehende Grenzen, jetzt im
  README): Aufruf einer Top-Level-Funktion oder -Property aus einer später
  stehenden Datei (auch aus einer Klasse) scheitert; `fun a() = b(); fun b() = 1`
  scheitert mit „Cannot infer return type“; `mutableListOf()` ohne
  Typargument als Konstruktor-Default scheitert mit „Cannot infer type: T“.

Auf `beta` übertragen (Stand `de90ddb` mit RT-42/RT-43, den Meldungen für
nullable Empfänger und RT-44): Kotlin-Quellen ohne Konflikt zusammengeführt,
Doku-Konflikte von Hand. Dabei gefunden: `beta` führt mit `accessorUnderAnalysis`
neuen Analysezustand ein; die Analyse bei Bedarf sichert ihn jetzt mit, sonst
meldete eine Klasse, die aus dem Setter einer anderen heraus analysiert wird,
eine falsche RT-43-Warnung für deren Property. Neuer Fall im RT-40-Block
(Setter von `A` ruft `B`, `B` schreibt sein eigenes `name`), ohne Sicherung
rot, mit grün.

Nachweise auf `beta`:

- `npm run build:kotlite`, `build:player`, `build:offline`, `build:svelte`
  erfolgreich; grün: `smoke-static-architecture`, `smoke-svelte-architecture`,
  `smoke-kotlite-browser` (mit RT-42/RT-43), `smoke-blueplay-browser`,
  `smoke-curriculum-kotlin`, `test:runtime-state`, `test:references`, `test:generics`,
  `test:kotlin-surface`, `test:blueplay-demos`, `check-interactive-core`,
  `test:ui`, `test:inspector`, `test:blueplay-stage`, `test:project-format`,
  `test:program-export`, `test:player-worker`, `test:codepad-flow`,
  `test:offline`; `npm run typecheck` 0 Fehler/0 Warnungen.
- `npx playwright test`: 126/126 grün. Ein Lauf davor hatte GUI-56 rot
  (Weltfenster nach 5 s nicht sichtbar), während eine parallele Sitzung ihre
  Tests startete; GUI-56 danach einzeln 5/5 grün und der vollständige
  Wiederholungslauf 126/126.
- Verschachtelung der Analyse bei Bedarf (temporärer Chromium-Test, nicht
  eingecheckt): Kette `K00 … Kn`, in der jede Klasse die Methode der nächsten
  aufruft, in Dateireihenfolge: 10, 30, 35, 40, 45 und 50 Klassen
  compilieren, 60 nicht (`StackOverflowError: Too many nested calls …` beim
  Compile). In Node gehen 100 Klassen in rund 130 ms; das Bundle vor RT-40
  brauchte dafür durch die Wiederholungsanalysen 11,7 s (60 Klassen: 4,2 s).
  Als Grenze in `docs/kotlite.md` und `PATCH.md` dokumentiert.
- Beim ersten Übertragen auf `936652c` war `smoke-blueplay-browser` rot, auch
  ohne diese Änderung (`?.toString()` auf nullable Werten mehrdeutig, siehe
  RT-44). Mit RT-44 (`de90ddb`) behoben; auf dem jetzigen Stand grün.

Nicht im echten Browser manuell abgenommen (nur Playwright/Chromium). Nicht
gepusht.

### RT-45: Top-Level-Funktionen und -Properties in beliebiger Reihenfolge (2026-09-26)

Entwickelt im Worktree `claude/vigorous-fermi-df7fbc` auf `6c797d5` mit dem
damals noch uncommitteten RT-40-Stand aus `claude/serene-hellman-e848cd`
(alle zwölf Dateien byte-gleich geprüft), danach auf `beta` (`3c2651a`, mit
RT-40 bis RT-44) übertragen, siehe unten. iCloud legte nach dem Übernehmen
für jede Datei eine Kopie „Name 2.ext“ mit dem `HEAD`-Inhalt an; die Kopien
waren byte-gleich mit `HEAD` und wurden entfernt (`ReplAnalyzer 2.kt` hätte
den Gradle-Build gebrochen). ID: Die Arbeit lief zunächst als RT-44; auf
`beta` ist RT-44 schon für Safe Calls vergeben, daher RT-45. RT-41 ist frei
gelassen.

Reproduktion mit dem RT-40-Bundle über `KotliteSession.startLoadProject`:
`Main.kt` `fun main() { println(hilfe()) }` mit `Util.kt`
`fun hilfe(): Int = 1` → „No matching function or constructor `hilfe`“;
`class Hund { fun f() = hilfe() }` ebenso; `class Hund { fun f() = maximum + 1 }`
mit `val maximum = 3` → „`maximum` is unknown“. In umgekehrter
Dateireihenfolge funktionierten alle drei.

Änderung (`vendor/kotlite-interpreter`, Eintrag in `PATCH.md`):

- `SemanticAnalyzer` analysiert Top-Level-Deklarationen weiter in
  Quelltextreihenfolge, bei einem Namensnachschlag aber vorher alle noch nicht
  analysierten Top-Level-Funktionen und -Properties dieses Namens
  (`analyzeTopLevelAhead`), mit gesichertem und wiederhergestelltem Zustand
  (`analyzeAtTopLevel`, jetzt auch von der Klassenanalyse bei Bedarf aus
  RT-40 genutzt). Auslöser: Funktionssuchen auf Skriptebene
  (`SemanticAnalyzerSymbolTable.beforeFunctionLookup`) und nicht verdeckte
  Variablenzugriffe. Es wird nichts vorab deklariert und keine Symbolnummer
  vorab verbraucht.
- Quelltexteinheiten: `ReplAnalyzer.analyze(…, unitStarts)`;
  `KotliteSession` merkt sich den Beginn jeder angehängten Quelle
  (`sourceUnitStarts`: Projekt, BluePlay-Bibliothek, Codepad-Eingabe,
  Objektbank-Bindung). Nur Deklarationen der eigenen Einheit werden vorzeitig
  analysiert; spätere Eingaben ändern Auflösung und Symbolnummern früherer
  Einheiten nicht.
- Auswertung: Klassen, dann Top-Level-Funktionen, dann der Rest in
  Quelltextreihenfolge; Initialisierer behalten ihre Reihenfolge. Direktes
  Lesen einer später initialisierten Property in einem Initialisierer oder
  einer Codepad-Anweisung ist ein Compilefehler; ein Initialisierer, der den
  eigenen Wert braucht, meldet „`a` is used before it is initialized …“ statt
  „unknown“; zur Laufzeit meldet der Interpreter ein Lesen oder Schreiben vor
  der Initialisierung als `InterpreterStateException`
  (`VariableReferenceNode.isTopLevelProperty`).

Nachweise bei der Entwicklung (auf `6c797d5` mit RT-40):

- `smoke-curriculum-kotlin.mjs`, RT-45-Block (zuerst geschrieben, mit dem
  RT-40-Bundle rot: „RT-45 function from main (Main.kt, Util.kt):
  SemanticException: No matching function or constructor `hilfe`“, mit dem
  neuen grün): die drei Reproduktionen in beiden Dateireihenfolgen; ein
  Projekt mit allen weiteren Formen in beiden Reihenfolgen (inferierter
  Rückgabetyp, Erweiterungs- und Operatorfunktion, Property mit
  Funktionstyp, Überladungen nach dem Aufruf mit Ergebnis `IntAny`,
  gegenseitige Rekursion über zwei Dateien, Klassen-Initialisierer,
  `stand += 1`/`stand++` aus einer Klasse, Funktion im Initialisierer);
  Codepad mit Vorwärtsverweis in einer Eingabe, späterer Überladung
  `fun hilfe(x: Int)` und danach funktionierenden alten Aufrufen und
  Bindungen; Compile- und Laufzeitfehler der Initialisierungsreihenfolge
  (auch nicht von `catch (e: Throwable)` gefangen); unbekannte Funktion und
  Inferenzzyklus bleiben Fehler; BluePlay-Bibliothek als eigene Einheit.
- Gegenprobe für die Bibliothekseinheit: ein Bundle ohne diese Grenze
  (sonst gleich) lässt `Image.fill()` die Projektfunktion
  `mutableListOf(text: String)` aufrufen (`drawingJson()` enthält
  „Projekt“), der Test scheitert dort („'true' !== 'false'“). Ein erster
  Gegenversuch mit `bluekImageWidth` belegte nichts (gleiche Signaturen
  werden dedupliziert) und wurde ersetzt; ein weiterer war ungültig, weil
  Gradle `compileKotlinJs` als UP-TO-DATE übersprang (Bundle byte-gleich).
  Danach mit dem endgültigen Quellstand neu gebaut. Der Kotlin/JS-Build ist
  nicht byte-reproduzierbar (Reihenfolge der Polyfills `Math.expm1`/`log1p`).
- Randfälle als Probe (nicht alle im Smoke): Lokale Variablen und Parameter
  verdecken spätere Top-Level-Properties; doppelte spätere Deklarationen
  melden „already declared“ an der zweiten Stelle; ein Enum mit
  `EINS(basis)` vor `val basis` ergibt zur Laufzeit „`basis` is used before
  it is initialized“ (vorher „`basis` is unknown“); unverändert zu vorher:
  `class Hund { fun f() = g(); fun g() = "member" }` scheitert mit „Cannot
  infer return type of function g“ (Member-Grenze aus RT-40).
- Nach `npm run build:kotlite` grün: `smoke-curriculum-kotlin`,
  `smoke-kotlite-browser`, `test:runtime-state`, `test:references`,
  `test:generics`, `test:blueplay-demos`, `test:kotlin-surface`,
  `smoke-blueplay-browser`, `check-interactive-core`,
  `smoke-svelte-architecture`, `test:codepad-flow`, `test:ui`,
  `test:inspector`, `test:blueplay-stage`, `test:project-format`,
  `test:program-export`, nach `build:player` auch `test:player-worker`;
  `npm run typecheck` 0 Fehler/0 Warnungen.
- GUI-Test „RT-45 top-level functions and properties of a later file can be
  used“: mit dem RT-40-Bundle rot (Compile zeigt `Line 2:
  SemanticException: No matching function or constructor hilfe`), mit dem
  neuen grün.
- `npx playwright test`: 125/125 grün mit dem endgültigen Bundle (3,2 min).
- Laufzeit (Node, Median aus 11, bei laufenden Nebenprozessen verrauscht):
  Laden der Space-Invaders-Vorlage in Datei- und alphabetischer Reihenfolge
  alt 194–301 ms, neu 174–242 ms; `benchmark-blueplay.mjs` Schritt im Mittel
  alt 1,64–2,02/5,55–5,79 ms, neu 1,76–1,93/5,65–6,31 ms. Kein messbarer
  Unterschied.

Auf `beta` übertragen (`3c2651a`, mit RT-40 bis RT-44) per Cherry-Pick in
einem eigenen Worktree außerhalb von iCloud. Konflikte in `SemanticAnalyzer.kt`,
`KotliteSession.kt` und der Doku von Hand gelöst: `beta` bringt mit RT-43
`accessorUnderAnalysis` als weiteren Analysezustand; `analyzeAtTopLevel`
sichert ihn jetzt mit (wie es die Klassenanalyse auf `beta` bereits tat), und
die Accessor-Warnungen beim Projektladen bleiben erhalten.

Nachweise auf `beta`:

- `npm run build:kotlite`, `build:player`, `build:offline`, `build:svelte`
  erfolgreich; grün: `smoke-curriculum-kotlin` (RT-40- und RT-45-Block),
  `smoke-kotlite-browser`, `test:runtime-state`, `test:references`,
  `test:generics`, `test:blueplay-demos`, `test:kotlin-surface`,
  `smoke-blueplay-browser`, `check-interactive-core`,
  `smoke-svelte-architecture`, `smoke-static-architecture`,
  `test:codepad-flow`, `test:ui`, `test:inspector`, `test:blueplay-stage`,
  `test:project-format`, `test:program-export`, `test:player-worker`,
  `test:offline`; `npm run typecheck` 0 Fehler/0 Warnungen.
- `npx playwright test`: 127/127 grün (3,0 min).
- Verschachtelung der Analyse bei Bedarf (temporärer Chromium-Test, nicht
  eingecheckt): Kette `f0 … fn` in je eigener Datei, jede Funktion ruft die
  nächste, später stehende auf: 25, 30 und 35 Funktionen compilieren, 40, 45,
  50, 75, 100 und 150 nicht (`StackOverflowError: Too many nested calls …`
  beim Compile). In Node gehen 100, bei 200 läuft der Stack über. In
  `docs/kotlite.md` und `PATCH.md` als Grenze dokumentiert.

Nicht im echten Browser manuell abgenommen (nur Playwright/Chromium). Nicht
gepusht.
### RT-46: Smart Casts nach `is` (2026-09-26)

Worktree `claude/wizardly-cartwright-efd2a3`, zuerst auf `6c797d5`, dann auf `beta` (`2a2e292`) umgesetzt. Auf `beta` war die ID RT-40 schon vergeben (Klassen in beliebiger Reihenfolge); dieser Eintrag heißt deshalb RT-46 (in den ersten Prüfläufen unten noch „RT-40“ genannt).
Auslöser: `class Q(val n: Int) { override fun equals(other: Any?): Boolean = other is Q && other.n == n }`
scheiterte mit „`n` is unknown for Any“. Die Vorab-Untersuchung gegen das
eingecheckte Bundle ergab, dass kein Muster ohne explizites `as` ging
(`if`, `&&`, `!is` mit `return`, `when`, `while`, Argument einer Funktion,
`Any?` als `Int`/`String`); nur Null-Prüfungen wurden gecastet, und zwar nach
Variablennamen statt nach Deklaration, ohne Wirkung im `else`, in `while` oder
nach `continue`, und ihre Wirkung endete erst mit der Funktion (ein
`if (c) { if (x == null) return }` schaltete `x` für den Rest der Funktion
frei). Die Laufzeit blieb unverändert: `NavigationNode.eval` liest Member vom
tatsächlichen Wert, ein Smart Cast ist nur Analyse. Änderung und Grenzen
stehen in `vendor/kotlite-interpreter/PATCH.md`.

Die im Auftrag genannte Zeile „other is T && other.x“ (Nachtrag 2026-09-26)
stand in dieser Datei weder im Commit `6c797d5` noch in den nicht
committeten Änderungen des Hauptcheckouts; sie ist hiermit als RT-46 neu
angelegt (falls der andere Zweig sie einführt, beim Zusammenführen
zusammenlegen).

Nachweise (alle tatsächlich ausgeführt, mit dem aus diesem Stand gebauten
Bundle, `npm run build:kotlite` erfolgreich):

- `node scripts/smoke-curriculum-kotlin.mjs`: grün, mit neuem RT-40-Block
  (48 akzeptierte Ausdrücke mit Laufzeitergebnis, 14 Gegenfälle). Gegen das
  eingecheckte Bundle scheitert der Block an der ersten Form
  (`` `bellen` is unknown for Tier ``).
- Grün: `test:kotlin-surface`, `test:references`, `test:generics`
  (beide Skripte), `test:blueplay-demos`, `smoke-kotlite-browser.mjs` (dort
  auch die vorhandenen Null-Smart-Cast-Fälle), `smoke-blueplay-browser.mjs`,
  `smoke-runtime-state.mjs`, `check-interactive-core.mjs`,
  `npm run typecheck` (0 Fehler, 0 Warnungen).
- Nicht ausgeführt: `smoke-static-architecture.mjs` (und damit
  `npm run browser-smoke` als Ganzes) braucht `frontend/dist` aus
  `vite build`, das hier nicht gebaut wurde; `test:ui`, `test:inspector`,
  `test:project-format`, `test:program-export`, `test:player-worker`,
  `test:codepad-flow`, `test:offline` sind nicht einzeln gelaufen (keine
  Berührung mit dem geänderten Code).
- Eingebauter Browser, Dev-Server aus diesem Worktree auf Port 5199: Klasse
  `Punkt` mit dem `equals` oben kompiliert; im Codepad `Punkt(1) == Punkt(1)`
  → `true`, `Punkt(1) == Punkt(2)` → `false`,
  `val a: Any = "abc"; if (a is String) a.length else -1` → `3`;
  `if (a is String || a.length > 1) 1 else 2` bleibt mit
  „`length` is unknown for Any“ abgelehnt.
- `npx playwright test` (123 Tests) mit angepasster, nicht eingecheckter
  Konfiguration auf Port 5197, weil 5194 eine parallele Sitzung belegte:
  122/123 grün. GUI-35 scheitert nur, weil der Test die URL
  `http://127.0.0.1:5194/…` fest erwartet (erhalten: `…:5197/load/green-lamp-river`);
  das ist ein Port-Artefakt, kein Befund, aber auf Port 5194 nicht erneut
  bestätigt.

Beobachtete, nicht zu RT-40 gehörende Lücken (schon im eingecheckten Bundle):
`for (x in liste)` über eine Liste mit `null`-Element scheitert zur Laufzeit
(`Return value's type Nothing? cannot be casted to String in function next`);
`val y = x as? B` liefert einen Typ ohne Member von `B`; eine Klasse mit
Konstruktor-`val` des eigenen Typs (`class K(val n: K?)`) meldet „Unknown
type K“; Top-Level-Funktionen dürfen nicht vor ihrer Deklaration aufgerufen
werden.

Nach dem Umsetzen auf `beta` (`2a2e292`, u. a. Analyse bei Bedarf in
`analyzeAtTopLevel`, das seine Smart-Cast-Zustände jetzt über `smartCasts`
sichert): Bundle neu gebaut; erneut grün `test:kotlin-surface` (70
unterstützt, 13 bekannte Lücken), `test:references`, `test:generics`,
`test:blueplay-demos`, `smoke-kotlite-browser.mjs`,
`smoke-curriculum-kotlin.mjs`, `smoke-runtime-state.mjs`,
`smoke-blueplay-browser.mjs`, `check-interactive-core.mjs`. Der
Playwright-Lauf und der Typecheck gelten für den Stand vor dem Umsetzen und
sind auf `beta` nicht wiederholt.

Kein Push. Beim Zusammenführen mit
`claude/kotlin-compiler-error-message-4625f4` (ändert
`NavigationNode.visit` und das Bundle): Bundle nicht von Hand mergen, sondern
`npm run build:kotlite` neu ausführen.


### BluePlay-Referenz-API und Anzeige (30.09.–01.10.2026)

Maßstab ist `tomkarp/BluePlay`, Commit `c8ace580f0506571fc34f287280a3e04eba7c876`.
Die unveränderten Framework-/Schülerdateien und API-Dokumentation liegen in
`tests/fixtures/blueplay-reference/`. Audit-Ausgangsstand und Einzelbefunde
stehen in [blueplay-api-audit.md](blueplay-api-audit.md).

Tatsächlich ausgeführt:

- `build:kotlite` erfolgreich; daraus API-Manifest erzeugt. `build:player`,
  `build:offline` und `build:svelte` erfolgreich; ausgelieferte Offline- und
  Player-Dateien neu gebaut. Vorhandene Kotlin-Cast- und Bundlegrößenwarnungen.
- Konformitätstest grün: vollständige Originalsignaturen und UI-Metadaten,
  14 gültige / 28 ungültige Aufrufe, benannte Argumente, originale Schülerdateien,
  Objektlebensdauer, Kopie/Skalierung/Transparenz einschließlich Pixelmasken.
- `smoke-kotlite-browser` einschließlich neuer sekundärer Konstruktoren grün;
  `smoke-curriculum-kotlin` nach Korrektur alter Tests für inzwischen entfernte
  Engine-Felder grün. Die erste Constructor-Implementierung brach RT-40
  (vorzeitige Memberanalyse bei Default-Argumenten); korrigiert und erneut grün.
- Grün: `test:ui`, `test:references`, beide Generics-Smokes,
  `test:kotlin-surface` (70 unterstützt, 13 bekannte Lücken, 23 Meldungen),
  `test:blueplay-stage`, `test:blueplay-demos`, `test:inspector`,
  `test:project-format`, `test:program-export`, `test:player-worker`
  (Chromium/WebKit), `test:codepad-flow`, beide Architektur-Smokes.
  `test:program-export` zunächst durch macOS-Sandbox am Browserstart gehindert,
  außerhalb der Sandbox tatsächlich grün. Kein Produktfehler.
- Vollständiger Chromium-Lauf vor dem letzten Steuerungstest: 129/129 grün.
  Abschließender Lauf mit 130 Tests: 129 grün, neuer RT-47-Steuerungstest rot,
  weil der Test bereits vor dem ersten Run-Schritt das Codepad abfragte.
  Test wartet nun auf einen beobachtbaren Abschlussframe; gezielte Wiederholung
  1/1 grün. Die übrigen 129 Tests sind im abschließenden Lauf grün.
- GUI-91: alle vier Hilfen, Desktop/schmale Ansicht, Light/Dark Mode,
  korrekte Signaturen, keine Links/Beispiele, keine horizontale Überbreite.
  GUI-86/RT-47 prüfen tatsächlich Canvas-Pixel für Zeichnungen, geladene Bilder,
  verschachtelte Kopien, Skalierung, Transparenz und den originalen Platzhalter.
  Screenshots der API-Hilfe durch den Agent visuell geprüft.
- `test:runtime-state` erneut grün mit tatsächlichem Host/Client und Bundle;
  zusätzlicher RT-47-Test unterscheidet manuellen Act und automatischen Run
  nach suspendierender Eingabe, damit `step()` den ursprünglichen Modus behält.
  Dabei gefundener Fehler: eine Stop-Absicht aus Reset-main blieb liegen und
  überlagerte Run. Absichten bei Reset-Abschluss/explicit Run verbraucht,
  automatischen Modus am aktiven Host-Aufruf erhalten; erneut grün.
  Typecheck: 0 Fehler / 0 Svelte-Warnungen. Offline-Smoke erneut grün.
- Nach dieser letzten Scheduler-Korrektur: alle 37 betroffenen Browsertests
  (BluePlay inklusive Canvas und API-Hilfe, Main-Auswahl/Reset, HTML-Export,
  Player inklusive WebKit) erneut grün. Die restlichen GUI-Tests waren im
  vorherigen vollständigen Lauf grün; sie wurden danach nicht wiederholt.

Keine JVM-/BlueJ-Ausführung und keine Benutzerabnahme. Schriftmetriken und
Antialiasing sind plattformabhängig; Textkollisionen bleiben geometrisch
angenähert. Keine Commits oder Pushes. Dev-Server auf `127.0.0.1:5173` gestartet
und erreichbar gelassen.

#### RT-47 / GUI-91: Actor ohne Welt (01.10.2026)

Die Referenz verwendet `val world: World` mit einem werfenden Getter, keinen
nullable Rückgabewert. Das bestehende Verhalten bleibt erhalten; die Hilfe
erklärt jetzt die weltlose Konstruktion und `IllegalStateException` beim
Getterzugriff. `docs/blueplay.md` beschreibt dieselbe Voraussetzung.

Tatsächlich ausgeführt:

- `smoke-blueplay-api.mjs` grün, erweitert um Konstruktion/Bild/Bewegung ohne
  Welt, Laufzeitfehler bei `world` und allen vier weltabhängigen Methoden,
  `fatal: true` und Verweigerung weiterer Ausführung nach unbehandeltem Fehler.
  Nach `removeObject` wirft der Getter erneut; `catch (IllegalStateException)`
  behandelt die Ausnahme regulär. Dies sind Runtime-Tests gegen das echte
  Interpreter-Bundle, keine Browserprüfungen des Programmabbruchs.
- Chromium GUI-91 erneut 1/1 grün: alle vier Hilfen einschließlich aktualisiertem
  Actor-Text, Desktop/schmale Ansicht und Dark Mode. Typecheck 0 Fehler /
  0 Warnungen. Keine neue Benutzerabnahme oder JVM-Ausführung.


### RT-49 / GUI-92: Einheitliche Property-Inspektion (01.10.2026)

Für die Inspektion wurde automatische Auswertung aller Properties mit
`try/catch` je Property festgelegt. Werte und Fehler bleiben in der Runtime; der
separate UI-Gettercache entfällt. Dieser Prüflauf verwendete noch
`Actor.world: World?`; die spätere Rückkehr zum werfenden Getter mit Typ
`World` ist unten separat geprüft. Die geltende Entwurfsentscheidung steht
in den vorhandenen Architektur-/BluePlay-Notizen.

Zwischenbuilds scheiterten zunächst an der falschen Verwendung der
`CustomFunctionDefinition`-API und anschließend an einer vorhandenen
Parsergrenze (`private` direkt nach einem Getter). Die Definition wurde
korrigiert und der private Helper vor dem Getter angeordnet. Kotlin-Build
und Generierung des API-Manifests anschließend erfolgreich; bestehende
Cast-/Bundlegrößenwarnungen.

Tatsächlich ausgeführt:

- `test:runtime-state` mit tatsächlichem Host, Client und Interpreter-Bundle
  grün: private Getter, Fehler vom Typ `IllegalStateException`, weitere
  Properties nach dem Fehler, `null`, Collections, Objekt-Handles ohne
  zusätzliches Schüler-`toString()`, suspendierender Getter und genau einmal
  ausgeführte Seiteneffekte. Fehler bleiben in der Property-Zeile, Phase
  bleibt `ready`; normaler `get` auf dieselbe Property ist fatal. Eine
  `InterpreterStateException` aus `Thread.sleep` in `toString` bleibt auch
  bei Inspektion fatal (RT-37/RT-38).
- `test:inspector` grün: alle Properties werden über denselben Befehl
  abgefragt, reine Projektion des Runtime-Snapshots, kein UI-Gettercache,
  parallele Aktualisierungen, Generation und Schließen.
- `test:blueplay-api` und native BluePlay-Browser-Smoke grün: nullable
  `world`, Exceptions bei weltabhängigen Zugriffen, neue Metadaten/Hilfe,
  ursprüngliche Schülerdateien weiterhin unverändert ausführbar, Bilder,
  Lebensdauer und Simulationssteuerung.
- Typecheck 0 Fehler / 0 Svelte-Warnungen; beide Architektur-Smokes grün.
- Erster Chromium-Lauf: 102/105 grün. GUI-89 fand ein tatsächliches
  Compile-Flackern durch synchrone Inspektionszugriffe; Client setzt dafür
  keine optimistische Running-Phase, Host meldet Started erst bei tatsächlich
  ausstehender Ausführung. Der neue Actor-Test erwartete fälschlich einen
  Compile-Klick im leeren Library-Projekt; nutzt nun das bestehende
  Compile-on-demand des Codepads. GUI-48 verlor während eines parallelen
  Bundle-Rebuilds seinen Testzustand (Snapshot zeigte das vorherige
  Hund-Projekt). Gezielte Wiederholung aller vier Fälle 4/4 grün.
- Stabiler Chromium-Lauf ohne parallele Bundle-Änderungen: alle 105 Tests
  der Dateien `references`, `regressions`, `blueplay` und `blueplay-images`
  grün (2,2 min). Darunter beide neuen GUI-92-Fälle: String-Getterfehler ohne
  zusätzliche Anführungszeichen, weitere Werte/null, Refresh nach Änderung,
  Programmfehler bei direktem Zugriff, weltloser Actor und anschließendes
  Hinzufügen zur Welt samt Referenznavigation.
- Nach letzter Layoutanpassung für lesbare, umgebrochene Fehlermeldungen:
  alle neun betroffenen Inspektor-Browsertests erneut grün; beide GUI-92-
  Screenshots in Light/Dark Mode durch den Agent visuell geprüft. Keine
  Benutzerabnahme. Die übrigen 96 Tests wurden nach dieser reinen
  Fehlerzeilen-Layoutanpassung nicht wiederholt.

`build:player`, `build:offline` und `build:svelte` erfolgreich; bestehende
Vite-/Bundlegrößenwarnungen. Anschließend `test:offline`, `test:player-worker`
(Chromium und WebKit, `file://`) und `test:references` tatsächlich grün.
Dev-Server auf `http://127.0.0.1:5173/` abschließend mit HTTP 200 erreichbar.
Kein Commit/Push.


#### GUI-92: Zurückhaltende Fehleranzeige (01.10.2026)

Getterfehler verwenden wieder die normale einzeilige Wertspalte mit Ellipse,
ohne eigene Fehlerfarbe oder zusätzliche Zeile. Der vollständige Text steht
im nativen Hover-Titel; Klick oder Enter/Leertaste öffnet eine Meldung, die
mit Close/Escape geschlossen wird. Die Auswertung der Properties bleibt
unverändert. Die Entwurfsentscheidung steht knapp im vorhandenen Abschnitt
„Inspektor“ von `docs/architecture.md`; ein separates Dokument entfällt.

- Chromium: alle neun betroffenen Tests aus `references`/`regressions`
  tatsächlich grün (23,5 s). Beide GUI-92-Fälle prüfen die normale
  Wertspalte, Ellipse, fehlende zusätzliche Fehlerfarbe, vollständigen
  Hover-Titel, Klickmeldung und unveränderte Runtime-Funktion. Enter,
  Leertaste und Escape sind ebenfalls geprüft. Der native Browser-Tooltip
  wurde über Hover und Titel geprüft; sein eigenes Popup wurde nicht
  fotografiert.
- Die aktuellen Screenshots in Light/Dark Mode wurden durch den Agent
  visuell geprüft; keine Benutzerabnahme. Die übrigen GUI-Tests aus dem
  vorherigen Gesamtlauf wurden nach dieser Anzeigeänderung nicht wiederholt.
- Typecheck: 0 Fehler / 0 Svelte-Warnungen. Svelte-Architektur-Smoke grün.
- `build:player`, `build:offline`, `build:svelte` erfolgreich mit den
  bestehenden Vite-/Bundlegrößenwarnungen; anschließender Offline-Smoke
  tatsächlich grün. Dev-Server auf `http://127.0.0.1:5173/` mit HTTP 200
  erreichbar.

### RT-50: Diagnose für nullable `for`-Subjekte (01.10.2026)

Kotlite meldet den benötigten nicht-nullable Wert für `iterator()` am
Ausdruck nach `in`; bei Aufrufen/Safe Calls beginnt die Position am
Empfänger. BlueK zeigt die Meldung ohne technischen Exception-Präfix.

- Neuer Bundle-Test gegen den vorherigen Interpreter zunächst tatsächlich
  rot: allgemeine Nullable-Meldung bei `for`, Spalte 5 statt 19.
- Zwischenlauf: Chromium 2/3 grün, neuer Fall zunächst wegen
  `SemanticException:`-Präfix rot; Durchreichen der fertigen Meldung in
  `KotlinSurfaceHints` ergänzt. Im Bundle-Test wurde das hier nicht
  unterstützte `emptyList` im Testcode durch `listOf<T>()` ersetzt.
- Eine ergänzende Ausführungsprobe für einen nullable Iterator-Empfänger
  mit tatsächlichem `null` fand die bestehende Grenze „Function iterator
  for receiver Nothing? not found“, auch mit dem Bundle aus HEAD bestätigt.
  Der relevante Konformitätstest prüft deshalb die erfolgreiche Analyse
  dieser Erweiterung; ihre Ausführung auf null wurde hier nicht geändert.
- Abschließend `smoke-kotlite-browser` tatsächlich grün: Fehler für
  List/Range/String/Safe Call, Datei/Zeile/Spalte, Elvis/`!!`/Smart Casts,
  erfolgreiche Analyse eines nullable Iterator-Empfängers sowie unveränderte
  Meldungen für gewöhnliche unsafe Calls und Fehler im Schleifensubjekt.
- Chromium: RT-50, GUI-64 und GUI-65 tatsächlich 3/3 grün (8,2 s).
  Der neue Fall prüft den Krokodil-Ausdruck, die Markierung von `world`
  und die erfolgreiche Korrektur mit Elvis. Kein gesonderter Screenshot
  oder manuelle visuelle Abnahme.
- Kotlin-Build inklusive API-Generierung, Player-/Offline-/Svelte-Builds
  erfolgreich; bekannte Cast-/Bundlegrößenwarnungen. Typecheck 0 Fehler /
  0 Svelte-Warnungen, beide Architektur-Smokes, BluePlay-Konformitätstest
  und abschließender Offline-Smoke tatsächlich grün.

### RT-49 / GUI-92: `world` wieder als `World` (01.10.2026)

Die öffentliche Property entspricht wieder der BlueJ-Signatur: `world: World`.
Ohne Welt wirft der Getter `IllegalStateException`; der Inspektor fängt sie
wie andere Getterfehler ab und bleibt bereit. Der normale unbehandelte
Programmzugriff bleibt fatal. API-Hilfe, Beispiele und bestehende Notizen
sind angepasst; die unnötigen `world!!` in Space Invaders entfallen.

- Kotlin-Build und API-Generierung erfolgreich. BluePlay-Konformitätstest,
  native BluePlay-Smoke und Space-Invaders-Smoke tatsächlich grün. Geprüft:
  exakter Typ `World`, direkte Weltaufrufe ohne Nullable-Behandlung,
  Getterfehler vor `addObject` und nach `removeObject`, catchbare/fatale
  Zugriffe sowie normale Weltrückgabe nach Hinzufügen.
- Der ursprüngliche Krokodil-Rumpf mit `world.getObjects<Ente>()` und
  `world.showText(...)` wurde mit der eingebauten Library erfolgreich
  analysiert. Die erste direkte Probe hatte die native BluePlay-Konfiguration
  vergessen und scheiterte an `bluekImageWidth`; mit derselben Konfiguration
  wie im RuntimeHost grün. Kein Act-/Bild-Lauf dieses Krokodil-Projekts.
- Erster Chromium-Lauf 4/6 grün: der neue schnelle Entfernen-/Hinzufügen-
  Ablauf fand verlorene Inspektor-Aktualisierungen; `InspectorModel` merkt
  weitere Anforderungen nun nur als Wiederholungsbedarf und führt danach
  einen frischen Durchlauf aus, ohne eigenen Wertecache. Helper-Test
  prüft dies sowie weiterhin Abbruch bei Reset/Schließen.
- Der RT-50-Test wurde unabhängig von der Actor-API auf eine explizit
  nullable Testproperty umgestellt: ein Safe Call auf dem jetzt nicht-nullable
  `Actor.world` ergibt in Kotlite keine nullable Sammlung mehr.
- Folgelauf 10/11 grün: alle Inspektor-/Editorfälle grün; GUI-91 scheiterte
  beim Start der Testvorlage (keine Welt und keine Codepad-Historie).
  Gezielte Wiederholung GUI-91 grün (4 s). Anschließend aktuelle Signatur-
  und Welt-Getter-Klicktests GUI-91/GUI-92 nochmals tatsächlich 3/3 grün
  (13,2 s). Insgesamt sind alle elf betroffenen Fälle durch grüne Läufe
  abgedeckt; kein vollständiger GUI-Gesamtlauf.
- `test:inspector`, `test:runtime-state`, Svelte-Architektur-Smoke grün;
  Typecheck 0 Fehler / 0 Svelte-Warnungen. Aktueller Actor-Screenshot visuell
  durch den Agent geprüft; normale gekürzte Wertfelder, keine Benutzerabnahme.
- Player-/Offline-/Svelte-Builds erfolgreich mit bekannten Bundlewarnungen.
  Abschließender Offline-Smoke tatsächlich grün; Dev-Server auf
  `http://127.0.0.1:5173/` mit HTTP 200 erreichbar. Kein Commit/Push.


### GUI-93: Objektmenüs über Inspektorfenstern (01.10.2026)

Das gemeinsame Objekt-/Klassen-Kontextmenü liegt mit seinen Untermenüs
auf Ebene 40 über normalen Fenstern (20/30). Modale Aktionsdialoge bleiben
auf Ebene 100. Keine Änderung an Runtime oder Fensteraktivierung.

- Neuer Chromium-Test zunächst tatsächlich rot: Im Überlappungsbereich
  trifft `elementFromPoint` den Inspektor statt der Methodenschaltfläche.
- Nach CSS-Korrektur GUI-93/49/82/85/87 tatsächlich 5/5 grün (10,1 s).
  GUI-93 prüft echte geometrische Überlappung, den vordersten DOM-Treffer,
  Klick auf die direkte Methode samt Parameterdialog und die geerbte
  Methode samt Programmausgabe. Kein bloßer Z-Index-Vergleich.
- Typecheck: 0 Fehler / 0 Svelte-Warnungen; Svelte-Architektur-Smoke grün.
  Player-/Offline-/Svelte-Builds erfolgreich mit den bestehenden Warnungen.
  Kein separater Screenshot-Abnahmelauf und keine Benutzerabnahme;
  übrige GUI-Tests nicht wiederholt.

### Abschlussprüfung vor Commit und Push (01.10.2026)

- `npm run browser-smoke` tatsächlich grün: beide Architektur-Smokes,
  Kotlite-Bundle, BluePlay-API-Konformität, native BluePlay-Runtime,
  Curriculum-Kotlin und Runtime-State einschließlich Projektvalidierung.
- `npm run test:generics` tatsächlich grün: Generics-Smoke, 49 Grenzfälle
  und suspendierter Inline-Return.
- `git diff --check` ohne Befund. Die oben protokollierten gezielten
  Chromium-Läufe gelten weiterhin; kein neuer vollständiger GUI-Gesamtlauf.

### GUI-94: Maximierter Zustand nach BluePlay-Reset (01.10.2026)

`performReset` setzt die Fenster-Maximierung nicht mehr zurück. Die neu
erzeugte Welt erscheint mit dem bisherigen maximierten oder normalen
Fensterzustand; Position und bewusste Größenumschaltung bleiben UI-Zustand.

- Erster Teststart durch Sandbox-Portbindung (`EPERM`, 5194) verhindert;
  mit erlaubtem lokalem Testserver konnte Chromium den Fehler reproduzieren.
- Neuer GUI-94-Test vor der Korrektur tatsächlich rot: Nach Reset fehlt
  die Schaltfläche „Restore BluePlay world“.
- Nach Korrektur GUI-94, GUI-57 und beide RT-25-BluePlay-Reset-Tests
  tatsächlich 4/4 grün (9,5 s). GUI-94 bestätigt anhand der Canvas-Breite
  den tatsächlichen Weltwechsel und prüft die Fenstergrenzen nach Reset
  sowohl maximiert als auch nach Wiederherstellen der normalen Größe.
- Typecheck 0 Fehler / 0 Svelte-Warnungen, Svelte-Architektur-Smoke und
  `git diff --check` grün. Kein vollständiger GUI-Gesamtlauf und keine
  gesonderte visuelle Benutzerabnahme.

### ARCH-07: Aufteilung der Svelte-Oberfläche (01.10.2026)

Der vorangehende Reset-Fix ist vor dem Umbau als `94e778f` committed.
`SvelteApp.svelte` ist von 4379 auf 2360 Zeilen reduziert; 22 Komponenten
übernehmen Fenster, Dialoge und Hauptbedienelemente. Editor-Actions,
Fenster-/Diagramm-Geometrie, Menüableitung und Browser-Datei-/Linkaktionen
sind fachliche TypeScript-Module. Gemeinsamer UI-Zustand und der einzige
Runtime-Client bleiben beim Koordinator; Komponenten haben typisierte
Props/Callbacks und erhalten keine eigene Laufzeitablage.

- Erster gezielter Chromium-Lauf nach Fenster-/Dialogextraktion tatsächlich
  13/13 grün: GUI-57/94/91/92/80/83/93/33/90/87/66.
- Erster `test:regression`-Lauf erreichte den Offline-Test, der zu Recht
  eine noch enthaltene Share-Aktion im Offline-JavaScript fand. Die
  Build-Bedingung steht jetzt direkt in `ProjectTransferDialogs`; der
  wiederholte Offline-Build/-Server-Smoke tatsächlich grün.
- Erster GUI-Gesamtlauf tatsächlich 135/135 grün (3,4 min). Der nächste
  Sammellauf war 134/135 grün: GUI-94 las vor dem ersten Animation Frame
  ein noch nicht gesetztes Canvas-Attribut (`null`); Playwright meldete
  deshalb einen TypeError, während das Weltfenster maximiert blieb.
  GUI-94 wartet jetzt auf die gezeichnete Ausgangswelt; gezielte dreifache
  Wiederholung tatsächlich 3/3 grün (9,8 s), keine pauschalen Sleeps/Retry-Regeln.
- Abschließender `npm run test:regression` am endgültigen Stand vollständig
  grün: Typecheck, UI-/Fenster-Helfer, Runtime-State, Referenzen,
  Kotlin-Surface, Inspektor, BluePlay-API/Stage, Projektformat, Programmexport,
  Player-Worker (Chromium und WebKit über `file://`), Codepad, Offline-Build
  und sämtliche 135/135 GUI-Tests (3,5 min). GUI-94 auch im Gesamtlauf grün.
- `browser-smoke`, `test:generics` (49 Grenzfälle und suspendierter
  Inline-Return), `test:blueplay-demos`, `check-interactive-core` und
  `test:share-server` tatsächlich grün. Beide Architektur-Smokes am
  endgültigen Stand erneut grün; Typecheck 0 Fehler / 0 Svelte-Warnungen.
- Player- und Svelte-Produktionsbuild erfolgreich; bestehende Vite-Warnungen
  zu Bundlegröße, statischer Worker-URL und Formatter-Externalisierung.
- Visuell durch Agent anhand Screenshots geprüft: maximierter Welt-Reset,
  Editor/Inspektor/Methodenmenü und API-Hilfe im Dark Mode. Erste freie
  Browser-Proben starteten vor dem Vorlagenladen bzw. verwendeten noch nicht
  adoptierte Objekte oder verdeckte Karten; die Bedienfolge wurde korrigiert.
  Keine separate Benutzerabnahme und keine neue visuelle Gestaltung.

### ARCH-08: Zustandsbesitz und Fachabläufe der Svelte-Oberfläche (01.10.2026)

`SvelteApp.svelte` ist von 2360 auf 651 Zeilen reduziert. Sie verbindet die
Darstellung mit sieben reaktiven UI-Controllern und koordiniert globale
Tastenkürzel/Escape. Projekt, Editor, Ausführung, Objekte, BluePlay und Terminal
besitzen jeweils ihre Zustände; Fokus, Einstellungen und Meldungen gehören
`WorkspaceUi`. Der einzige Runtime-Client lebt in `ExecutionWorkspace`.
Metadaten, Objektbank und Inspektorwerte bleiben von der Laufzeit abgeleitet.
Fremde Zustände werden über Aktionen wie `resetInspectors`, `clearWorld`,
`removeFile` oder `sourceEdited` angesprochen. Props/Callbacks und CSS der
Darstellung bleiben erhalten.

- Erster gezielter Chromium-Lauf: 23/25 grün. Beide RT-07-Fälle mit
  Konstruktor-Dialog waren tatsächlich rot: `kotlinCallArguments` gab ein
  reaktives Entwurfsarray zurück, das `Worker.postMessage` nicht klonen konnte.
  Konstruktor- und Methodenaufrufe übernehmen jetzt gewöhnliche Array-Kopien.
  Nach Korrektur Referenz-/Inspektor-, main-Auswahl- und HTML-Export-Tests
  tatsächlich 17/17 grün (41,6 s).
- Neuer `test:workspace` führt die echten, für den Client kompilierten
  Svelte-Rune-Module aus: leere und gefüllte Konstruktorargumente,
  Methodenargumente werden mittels `structuredClone` geprüft;
  unabhängige App-Instanzen und veraltete Aufrufergebnisse sind abgesichert.
  Erster Testaufbau scheiterte am TypeScript-Parser des Modulcompilers;
  TypeScript wird jetzt wie im Frontend vor der Rune-Kompilierung entfernt.
  Tatsächlicher Controller-Test danach grün.
- Typecheck tatsächlich 0 Fehler / 0 Svelte-Warnungen. Architektur-Smokes
  grün; `browser-smoke`, `test:generics` einschließlich 49 Grenzfällen und
  suspendiertem Inline-Return sowie `test:blueplay-demos` tatsächlich grün.
- Svelte-Produktionsbuild erfolgreich mit bestehenden Vite-Warnungen zu
  Bundlegröße, statischer Worker-URL und Formatter-Externalisierung.
- Erster vollständiger Sammellauf am Controller-Stand: Laufzeit-/Helfer-,
  Player- und Offline-Tests grün, GUI 133/135. GUI-78 fand ein tatsächlich
  fehlendes „+“ in der Kommentar-Tastenkombinations-Beschriftung; korrigiert.
  GUI-89 verpasste die nur 250 ms laufenden Getter zwischen Browser-Prüfungen.
  Seine Test-Getter bleiben nun 1200 ms ausgesetzt, damit Aktivitätsanzeige
  und Pfeilklick innerhalb einer tatsächlich laufenden Auswertung prüfbar sind;
  keine pauschalen Test-Sleeps oder Retry-Einstellungen.
- Erste fünffache Wiederholung GUI-89/78: 9/10 grün. Die erste Inspektion
  wurde durch Svelte-HMR ersetzt; eine veraltete Inspektor-Anfrage meldete
  eine unhandled rejection. `executeInspectorCommand` verwirft jetzt einen
  Generationswechsel als Abbruch (`null`), lässt echte Fehler der aktuellen
  Generation aber weiterhin durch. Beide Fälle sind im Controller-Test
  tatsächlich grün. Danach GUI-89/78 fünffach: 10/10 grün (21,7 s).
- Agent-Sichtprüfung am lokalen Server: Dark-Mode-Editor, Inspektor mit
  gekürzter Getter-Exception und direktes/geerbtes Methodenmenü im Screenshot
  geprüft; Menü liegt über den Fenstern. Die erste freie Probe suchte das
  Fehlerfeld fälschlich als `output`, die zweite positionierte den Inspektor
  über dem anzuklickenden Objekt. Korrigierte Bedienfolge tatsächlich grün,
  ohne Page-Errors. Keine Benutzerabnahme und keine neue visuelle Gestaltung.
- Abschließender `npm run test:regression` vollständig grün: Typecheck,
  UI-/Fenster-/Controller-Helfer, Runtime-State, Referenzen, Kotlin-Surface,
  Inspektor, BluePlay-API/Stage, Projekt-/Exportformat, Player-Worker
  (Chromium/WebKit über `file://`), Codepad, Offline-Paket und 135/135 echte
  GUI-Tests (3,5 min). GUI-89 und GUI-78 auch im Gesamtlauf grün.
- Abschließend ausschließlich Runtime-Fähigkeitstypen weiter eingeschränkt:
  Objekte erhalten `getSnapshot`/`execute`/`subscribe`, BluePlay
  `sendKey`/`sendClick`/`simulation`, Terminal `sendInput`/`sendEof`.
  Typecheck, Controller- und Architektur-Smoke erneut grün; Produktionsbuild
  erneut erfolgreich. SHA-256-Vergleich aller Produktionsassets mit dem zuvor
  getesteten Build byte-identisch, daher kein weiterer GUI-Gesamtlauf nötig.
- `git diff --check` ohne Befund. Der vor dem Umbau angeforderte
  Sicherungscommit ist `94e778f`.


### GUI-62: Vollständige IDE als lokale HTML-Datei (2026-10-01)

Das Offline-Paket enthält jetzt `BlueK.html` und `LIESMICH.txt`, ohne Server
oder Startskripte. Der Build nutzt dieselbe Svelte-App, `LocalRuntimeClient`,
`RuntimeHost` und das vorhandene gzip+base64-Kotlite des Player-Workers.
Der Formatter erhält eingebettete WASM-Bytes; Vorlagen sind frische Kopien
eingebetteter JSON-Daten. HTML-Programmexport nutzt die eingebettete
Player-Vorlage. Volle Projektlinks aus lokalen Dateien zeigen auf bluek.de;
das Bereinigen eines Projekt-Hashes bewahrt den lokalen Dateipfad.

Tatsächliche Prüfungen:

- `typecheck`: grün, 0 Fehler und 0 Svelte-Warnungen.
- `test:offline`: HTML-/ZIP-Struktur grün, danach 4/4 echte Browsertests
  über `file://` mit blockiertem HTTP-Netzwerk. Chromium: Kotlin-Compile,
  main, Codepad, Terminaleingabe, Reset, Autosave/Reload, JSON-Import/-Export,
  alle vier Vorlagen, BluePlay-Canvas/Act, Standardbildzugriff,
  eingebetteter Formatter und exportierter HTML-Player. WebKit: IDE- und
  BluePlay-Worker starten und liefern Welt plus Terminalausgabe.
- Betroffene bestehende GUI-Fälle: 22/22 im ersten Lauf grün (EXP-01–11,
  GUI-01, GUI-26, GUI-45, GUI-63, GUI-67). Nach der abschließenden Anpassung
  des Vorlagenladens 22/23 grün, einschließlich GUI-72; EXP-11 scheiterte
  ausschließlich beim Trace-Aufräumen, weil der gleichzeitig laufende
  Offline-Test dasselbe Artefaktverzeichnis bereinigte. Offline-Tests haben
  nun ein eigenes `test-results-offline/`; EXP-11 einzeln wiederholt: 1/1
  tatsächlich grün. Kein vollständiger GUI-/Regressions-Sammellauf.
- Runtime-State, Projektformat, Exportformat, Player-Worker (Chromium/WebKit),
  Codepad-Flow, echte Svelte-Controller und beide Architektur-Smokes grün.
- Player-, Offline- und Svelte-Produktionsbuilds erfolgreich. Vorhandene
  Asset-/Node-Externalisierungs-/Bundlegrößenwarnungen sowie `import.meta`
  in ungenutzten Formatter-Ladepfaden beim IIFE-Build; Formatter mit direkt
  übergebenen Bytes im echten Chromium erfolgreich geprüft.
- Erste Browserstarts innerhalb der Sandbox waren blockiert (Chromium
  Mach-Port-Zugriff, WebKit-Prozessabbruch); außerhalb der Sandbox liefen
  sie. Neue Tests hatten zunächst falsche UI-Selektoren und einen nicht
  vorhandenen Bildnamen; korrigiert. Der WebKit-Lauf fand außerdem einen
  echten Offline-Workerfehler: unmittelbares `URL.revokeObjectURL` nach dem
  Worker-Konstruktor verhinderte den Start. Die unveränderliche Quell-URL
  bleibt nun wie beim Player für die Dokumentlebensdauer bestehen.
- `git diff --check` ohne Befund. Keine Kotlin-Änderung, deshalb kein neuer
  Interpreter-Build erforderlich.
- Benutzerbestätigung, manuelles Doppelklicken unter Windows/Linux, Firefox
  und umfassende visuelle Abnahme stehen aus.

### PERF-03 bis PERF-05, RT-51: BluePlay mit vielen Actors (2026-10-02)

Ausgangspunkt: Space Invaders wurde schon mit wenigen Dutzend Schüssen
spürbar langsamer. Profile (Node, Entwicklungsbundle) zeigten drei
Kostenblöcke: Listen-Scans und interpretierte `filter`-Lambdas in den
Kollisionsabfragen, Scopes, Hash-Tabellen und Typobjekte je Aufruf im
Interpreter sowie vollständige Snapshots je Schritt. Umgesetzt: native
BluePlay-Engine (`BluePlayEngine.kt`, `BluePlayDrawing.kt`) mit Klassengruppen,
Geometrie- und Sichtbarkeitsraster; Interpreter-Änderungen in `PATCH.md`
(„Call and lookup costs“, Checkpoint-Hook, Erreichbarkeit); `frame`-Ereignisse,
genaues Warten im Scheduler (`simulationTimer.ts`) und Zusammenfassung der
Terminalausgabe je Animation-Frame. Messwerte stehen bei PERF-01, PERF-04 und
PERF-05 sowie in `docs/blueplay.md`.

Tatsächliche Prüfungen mit dem neu gebauten Bundle (`npm run build:kotlite`):

- Erster vollständiger `npm run test:regression`: alle Node- und
  Offline-Suiten grün, Chromium 138/139. GUI-14 scheiterte mit Timeout beim
  Reset-Klick: Die schnellere Schleife lieferte so viele Einzelausgaben, dass
  das Terminal (`{#key}`-Neuaufbau bis 1 MB je Meldung) den Hauptthread
  blockierte. Korrektur: IDE und Player fassen Ausgaben je Animation-Frame
  zusammen (`combineTerminalOutput`, Gleichheit in `test:ui` geprüft).
  Danach GUI-12 bis GUI-15 einzeln grün, `player.spec.ts` 7/7.
- RT-51: Probe gegen das Bundle aus 92e89a2 rot (siehe Checkliste), neuer
  Block in `smoke-blueplay-browser.mjs` mit dem neuen Bundle grün.
- `browser-smoke` (Architektur, Kotlite, BluePlay-API, BluePlay-Browser mit
  Sichtbarkeitsraster, Weltreihenfolge und RT-51, Curriculum, Runtime-State
  mit PERF-03), `test:references`, `test:blueplay-demos`, `test:generics` und
  `test:kotlin-surface` (70 unterstützt, 13 bekannte Lücken) grün.
- Abschließender vollständiger `npm run test:regression`: Typecheck 0 Fehler,
  0 Warnungen; alle Node-Suiten grün; `test:offline` 4/4 echte Browsertests
  (die IDE läuft weiter als einzelne HTML-Datei per `file://`); Chromium
  139/139 grün, PERF-01 dabei 323 Frames, p95 15,2 ms, max. 17,6 ms.
- `git diff --check` ohne Befund.
- Nicht automatisiert: Durchsatzgrenzen (PERF-04, zeitbasiert), Firefox,
  echtes Safari und die visuelle Benutzerabnahme bei vielen Actors.

### RT-52: Inhaltsgleichheit von Pair, List, Set und Map (2026-10-02)

Beim Prüfen bekannter Lücken gegen das Bundle aus f379d8e fiel auf, dass
`Pair(1, "a")` als `Pair()` erschien und `Pair`, `List`, `Set` und `Map` nur nach
Identität verglichen wurden (`listOf(1, 2) == listOf(1, 2)` war `false`,
`setOf(1 to 2, 1 to 2).size` 2). `listOf(x).toString()` ignorierte das eigene
`toString()` der Elemente. Korrektur in `DelegatedValue` und `AnyClass`
(`PATCH.md`), passive Pair-Anzeige im Inspektor in `KotliteSession`.

Tatsächliche Prüfungen mit dem neu gebauten Bundle (`npm run build:kotlite`):

- Erster Korrekturversuch: `Pair(1, 2) == null` endete in einem
  `StackOverflowError`, weil `Any.equals` für Bibliothekswerte wieder über
  `ClassInstance` zurückverzweigte. Behoben; der Fall steht im RT-52-Block.
- `smoke-curriculum-kotlin.mjs` mit dem Bundle aus f379d8e: RT-52 scheitert
  beim ersten Fall (`Pair(1, "a")`); mit dem neuen Bundle alle 41 Fälle grün.
- `browser-smoke`, `test:references`, `test:kotlin-surface` (70 unterstützt,
  13 bekannte Lücken), `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün (darunter `test:runtime-state` mit den neuen
  Pair-Feldern), `test:offline` 4/4, Chromium 140/140 grün, darunter das
  erweiterte GUI-90; PERF-01 dabei 324 Frames, p95 15,2 ms, max. 19,5 ms.
- `git diff --check` ohne Befund.
- Nebenbei gefunden (schon mit f379d8e): Eine Klasse mit
  `override fun equals(other: Any?) = super.equals(other)` ist nicht einmal sich
  selbst gleich (`hs == hs` ergibt `false`). Behoben als RT-53.
- Nicht geprüft: Firefox, echtes Safari, visuelle Benutzerabnahme der
  Inspektoranzeige.

### RT-53: `super.equals()`, `super.hashCode()` und `super.toString()` bis `Any` (2026-10-02)

Beim Prüfen von RT-52 gefunden: `super` ist in Kotlite ein Teilobjekt. Bei
Klassen ohne eigene Oberklasse löst `super.toString()` & Co. auf BlueKs
`Any?`-Erweiterung auf, mit dem `Any`-Teil als Empfänger; mit Oberklasse kommt
die `Any`-Methode an. Ein Debug-Bundle (`jsBrowserDevelopmentWebpack` mit
vorübergehender Ausgabe, danach entfernt) zeigte beide Wege. Korrektur:
`ClassInstance.wholeInstance()`, die `Any`-Semantik gebündelt in
`AnyClass.anyEquals`/`anyHashCode`/`anyToString`, genutzt von den
`Any`-Methoden und den `Any?`-Erweiterungen in `BlueKStdlibModule`.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-53-Block in `smoke-curriculum-kotlin.mjs` (10 Fälle) gegen das Bundle aus
  f379d8e (Testkopie ohne RT-52-Block): scheitert beim ersten Fall mit
  `false false false false`; mit dem neuen Bundle grün, RT-52 weiterhin grün.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 140/140 grün; PERF-01
  dabei 324 Frames, p95 15 ms, max. 18,3 ms.
- `git diff --check` ohne Befund.
- Nebenbei gefunden: eigene Exceptions zeigen mit `toString()` `MyEx()`
  statt `MyEx: x`; `super.toString()` in einer Unterklasse von `Exception`
  bricht mit `memberFunctionsForSA not initialized for type Exception` ab.
  Behoben als RT-54.

### RT-54: Exceptions als Objekte (2026-10-02)

Beim Prüfen bekannter Lücken gefunden (Bundle aus f379d8e): Exception-Objekte
hingen an der statischen, nie angebundenen Klassendefinition (Absturz von
`toString()`, Typfehler bei `cause`), `throw` reichte eine Kopie mit Klasse und
Meldung an `catch` weiter (eigene Felder fehlten), und `message` setzte außerhalb
von `catch` einen `ThrowableValue` voraus. Korrektur in `ThrowableValue`,
`ClassInstance` (`throwablePart`, Textform `MyEx: x`), `ThrowNode`/`TryNode`
sowie `printStackTrace`, Inspektor-Fehlertext und Fehlermeldung in
`KotliteSession` (`PATCH.md`).

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-54-Block in `smoke-curriculum-kotlin.mjs` gegen das Bundle aus f379d8e
  (Testkopie ohne RT-52/RT-53): scheitert beim ersten Fall mit
  `memberFunctionsForSA not initialized for type IllegalStateException`; mit dem
  neuen Bundle grün, ebenso RT-38 (Fangen nativer Ausnahmen nach Klasse,
  `printStackTrace`, ungefangene Meldungen), RT-52 und RT-53.
- `browser-smoke` (darunter `test:runtime-state` mit Getter-Fehlertext
  `IllegalStateException: missing world`), `test:generics` und
  `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 140/140 grün; PERF-01
  dabei 324 Frames, p95 15,2 ms, max. 26,9 ms.
- `git diff --check` ohne Befund.
- Offen: `stackTraceToString()` eigener Exceptions ist leer;
  `null!!` meldet `NullPointerException: null`.

### RT-55 und RT-56: `break`/`continue` in `for`, `when` ohne `else` (2026-10-02)

RT-56 auf Wunsch des Nutzers; RT-55 dabei gefunden (`continue` in einem
`when`-Zweig einer `for`-Schleife). Ein Rückgriff auf die eingecheckten Bundles
von dfb7fe0 bis c65f27d zeigte RT-55 in allen Ständen, also auch auf `main`.
Korrektur in `ForNode.eval` (RT-55) sowie `WhenNode.visit`/`eval` mit
`isExhaustive` und `requireWhenValue` (RT-56), siehe `PATCH.md`; README
„Aktuelle Grenzen“ angepasst.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-55- und RT-56-Block in `smoke-curriculum-kotlin.mjs` einzeln gegen das
  Bundle aus c65f27d (Testkopien nur mit dem jeweiligen Block): RT-55 scheitert
  beim ersten Fall (`NormalContinueException: Continue`), RT-56 beim Laden des
  Projekts („Currently, `when` expression must be used with an `else`
  branch“); mit dem neuen Bundle beide grün, ebenso alle übrigen Blöcke.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 140/140 grün; PERF-01
  dabei 322 Frames, p95 15,1 ms, max. 18,9 ms.
- `git diff --check` ohne Befund.
- Nicht geprüft: GUI-Ablauf mit `break`/`continue` (nur Runtime-Test);
  `when` ohne `else` in anderen Wertpositionen (z. B. als Operand).

### RT-57: Überschreibungen ohne Rückgabetyp (2026-10-02)

Auf Wunsch des Nutzers. Korrektur in `ClassDefinition.attachToSemanticAnalyzer`
(vorläufiger Rückgabetyp der überschriebenen Funktion) und
`FunctionDeclarationNode.visit` (Prüfung des Ausdruckskörpers dagegen), siehe
`PATCH.md`; README „Aktuelle Grenzen“ angepasst.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-57-Block in `smoke-curriculum-kotlin.mjs` gegen das Bundle aus 011b5c2
  (Testkopie nur mit diesem Block): scheitert beim Laden mit „Cannot infer
  return type of function equals“; mit dem neuen Bundle grün, ebenso alle
  übrigen Blöcke.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 140/140 grün; PERF-01
  dabei 322 Frames, p95 15,2 ms, max. 26,8 ms.
- `git diff --check` ohne Befund.
- Dabei bestätigt, nicht geändert (schon mit c65f27d): Eine Überschreibung mit
  spezielleren Rückgabetyp (`override fun f(): String` für `open fun f(): Any`)
  meldet „Return type of function `f` `String` is not the same as the
  overridden one `Any`“; im README dokumentiert.

### RT-58: `map.entries` und Map-Einträge (2026-10-02)

Auf Wunsch des Nutzers. `entries` in `BlueKStdlibModule` (mit Kopien der
Einträge), Textform und Inhaltsvergleich von Map-Einträgen in `DelegatedValue`,
passive Inspektoranzeige in `KotliteSession`; `map.forEach { k, v -> }` als
Lücke in `docs/kotlin-surface.md` und im Oberflächentest.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-58-Block in `smoke-curriculum-kotlin.mjs` gegen das Bundle aus 6b0669e
  (Testkopie nur mit diesem Block): scheitert beim ersten Fall (`MapEntry()`);
  `smoke-kotlin-surface.mjs` gegen dasselbe Bundle: die fünf
  `entries`-Ausdrücke fehlen. Mit dem neuen Bundle beide grün (75 unterstützt,
  14 bekannte Lücken, 23 Meldungen).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 140/140 grün; PERF-01
  dabei 325 Frames, p95 15,1 ms, max. 19 ms.
- `git diff --check` ohne Befund.
- Verworfen: eine zweiparametrige `forEach`-Überladung (Kotlite meldet beim
  Laden „The function `Map/forEach` has been declared repeatedly“).

### RT-59: kleine Stdlib-Ergänzungen (2026-10-03)

Ohne Rückmeldung des Nutzers, im vereinbarten Rahmen (kleine Lücken mit klarer
Kotlin-Vorgabe). Native Funktionen in `BlueKStdlibModule`; in
`KotlinSurfaceHints` entfallen die Hinweise auf fehlende Double-/Char-Grenzen,
und der Hinweis zu `chunked`/`windowed` gilt nur noch für `String`.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- `smoke-kotlin-surface.mjs` gegen das Bundle aus 1cd9a81: alle 20 neuen
  Ausdrücke fehlen; mit dem neuen Bundle grün (95 unterstützt, 12 bekannte
  Lücken, 22 Meldungen).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 140/140 grün; PERF-01
  dabei 324 Frames, p95 15 ms, max. 19,1 ms.
- `git diff --check` ohne Befund.
- Dabei gefunden, nicht geändert: Zahlliterale mit Exponent (`1.0e10`) kann
  Kotlite nicht parsen.

### RT-60: Double-Ausgabe wie auf der JVM (2026-10-03)

Ohne Rückmeldung des Nutzers, im vereinbarten Rahmen. Korrektur in
`DoubleValue.kotlinJvmText` (`PATCH.md`).

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-60-Block in `smoke-curriculum-kotlin.mjs` gegen das Bundle aus 4b29b27
  (Testkopie nur mit diesem Block): scheitert beim ersten Exponentenfall
  (`12345678.0` statt `1.2345678E7`); mit dem neuen Bundle grün, ebenso alle
  übrigen Blöcke.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 140/140 grün; PERF-01
  dabei 318 Frames, p95 15,2 ms, max. 27,6 ms.
- `git diff --check` ohne Befund.
- Bestätigte Abweichungen: `Double.MIN_VALUE` ergibt `5.0E-324`, das Literal
  `-0.0` ergibt `0.0`.

### RT-61: `null!!` ohne Meldung (2026-10-03)

Ohne Rückmeldung des Nutzers, Rest aus RT-54. Standardmeldung von
`NullPointerExceptionValue` ist `null` (`PATCH.md`). Die RT-54-Notiz zu leeren
Stacktraces ist korrigiert (nur auf oberster Ebene im Codepad leer).

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-61-Block in `smoke-curriculum-kotlin.mjs` gegen das Bundle aus 9a020fa
  (Testkopie nur mit diesem Block): scheitert beim ersten Fall
  (`false NullPointerException: null`); mit dem neuen Bundle grün, ebenso alle
  übrigen Blöcke.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 140/140 grün; PERF-01
  dabei 320 Frames, p95 15,4 ms, max. 19,4 ms.
- `git diff --check` ohne Befund.

### RT-62: Triple, StringBuilder/buildString, Random (2026-10-03)

Ohne Rückmeldung des Nutzers, im vereinbarten Rahmen. Klassen und Funktionen in
`BlueKStdlibModule` (die `StringBuilder`-Funktionen als Klassenmethoden, siehe
RT-62-Zeile), Ausgabe und Vergleich von `Triple` sowie Ausgabe von
`StringBuilder` in `DelegatedValue`, passive Inspektoranzeige in
`KotliteSession`. Die gefundene Lücke mit dem impliziten Empfänger steht im
README.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- `smoke-kotlin-surface.mjs` gegen das Bundle aus 4594330: die 15 neuen
  Ausdrücke fehlen; der RT-62-Eingabefall in `smoke-kotlite-browser.mjs`
  scheitert („buildString input: input was not requested“). Mit dem neuen
  Bundle beide grün (110 unterstützt, 12 bekannte Lücken, 22 Meldungen).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Erster vollständiger `npm run test:regression`: Typecheck 0 Fehler/0
  Warnungen, alle Node-Suiten grün, `test:offline` 4/4, Chromium 139/140.
  GUI-92 („detached Actor …“) scheiterte beim ersten Codepad-Schritt mit
  Timeout (kein Eintrag nach 5 s). Der Rechner war stark ausgelastet
  (Load ≈ 19–27, `fileproviderd`/iCloud bei 100 % CPU; der Lauf dauerte
  10,7 statt etwa 3,6 Minuten). `references.spec.ts` einzeln: 7/7 grün;
  vollständiger `npm run test:gui` erneut: 140/140 grün (GUI-92 21,9 s; PERF-01
  323 Frames, p95 15,4 ms, max. 21,2 ms). Kein Zusammenhang mit der Änderung
  erkennbar; GUI-92 ist unter Last zeitkritisch.
- `git diff --check` ohne Befund.

### RT-63: Erweiterungen über den impliziten Empfänger (2026-10-03)

Auf Wunsch des Nutzers. `FunctionCallNode.visit` versucht einen sonst nicht
auflösbaren unqualifizierten Aufruf als `this.f(...)`
(`visitThroughImplicitReceiver`, Ausführung über `resolvedInvoke`);
`copyReceiverIntoCurrentScope` deklariert auch Erweiterungs-Properties von
Obertypen ohne Typparameter im Typ. README „Aktuelle Grenzen“ und `PATCH.md`
nennen die Abweichungen.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-63-Block in `smoke-curriculum-kotlin.mjs` gegen das Bundle aus 2a8429b
  (Testkopie nur mit diesem Block): scheitert beim Laden des Testprojekts
  („`gruss` is unknown“); mit dem neuen Bundle grün, ebenso alle übrigen
  Blöcke.
- Zwischenstand: Der erste Ansatz für Obertyp-Properties brach schon das Laden
  der Stdlib ab („Unknown type T“); behoben, bevor Tests liefen.
- `browser-smoke`, `test:generics` (49 Grenzfälle) und `test:blueplay-demos`
  grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün (Oberfläche 110 unterstützt, 12 Lücken), `test:offline`
  4/4, Chromium 140/140 grün; PERF-01 dabei 320 Frames, p95 15,2 ms, max. 27,1 ms.
- `git diff --check` ohne Befund.

### RT-64: `data class` (2026-10-03)

Auf Wunsch des Nutzers. `ClassModifier.data` und Erzeugung der Funktionen im
Parser (`Parser.dataClassMembers`), Kennzeichnung `isGenerated`, Filter im
Manifest von `KotliteSession`; README „Aktuelle Grenzen“ angepasst.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-64-Block in `smoke-curriculum-kotlin.mjs` gegen das Bundle aus 7e19b32
  (Testkopie nur mit diesem Block): scheitert beim Laden („A BlueK project
  file may contain one class …“); mit dem neuen Bundle grün, ebenso alle
  übrigen Blöcke.
- Chromium-Test RT-64 mit dem Bundle aus 7e19b32 (vorübergehend eingesetzt,
  danach das neue wiederhergestellt, Prüfsumme gleich): scheitert beim ersten
  Codepad-Schritt; mit dem neuen Bundle grün. Ein erster Testentwurf prüfte
  die Objekt-Ausgabe über `.codepad-result-value`, die es für Objekte nicht
  gibt; korrigiert auf ein String-Template.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 141/141 grün (mit RT-64);
  PERF-01 dabei 319 Frames, p95 15,2 ms, max. 18,9 ms.
- `git diff --check` ohne Befund.

### RT-65: Destrukturierung (2026-10-03)

Auf Wunsch des Nutzers. Umschreiben im Parser (`destructuringDeclaration`,
`destructuringComponents`, `componentDeclarations`,
`DestructuringDeclarationNode`), `componentN` und `withIndex` in
`BlueKStdlibModule`, `IndexedValue` in `DelegatedValue`, Kotlins Meldung bei
fehlendem `componentN` in `KotlinSurfaceHints`; README, `kotlin-surface.md`
und `PATCH.md` angepasst.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- RT-65-Block in `smoke-curriculum-kotlin.mjs` gegen das Bundle aus 62d4016
  (Testkopie nur mit diesem Block): scheitert beim Laden („Expected token
  Operator `)`“); `smoke-kotlin-surface.mjs` gegen dasselbe Bundle: die neuen
  `componentN`-/`withIndex`-Ausdrücke fehlen. Mit dem neuen Bundle beide grün
  (116 unterstützt, 11 bekannte Lücken, 22 Meldungen).
- Zwischenstand: Der Build scheiterte zunächst an vier `when`-Ausdrücken über
  das versiegelte `ASTNode`; dort steht jetzt ein Zweig mit internem Fehler.
- Zusätzlich geprüft: Destrukturierung auf oberster Ebene einer Projektdatei
  und mit einer eigenen `component1()` ohne `operator` (wie im README).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 141/141 grün; PERF-01
  dabei 324 Frames, p95 15,1 ms, max. 26,8 ms.
- `git diff --check` ohne Befund.

### RT-66: Formatierung und `vararg` in Erweiterungen (2026-10-03)

Nach „mache erst mal weiter“ des Nutzers. Neuer Formatierer `KotlinFormat`
(`kotlite-browser`), `String.format` und `String.Companion.format` in
`BlueKStdlibModule`, Hinweis auf fehlende Formatierung in `KotlinSurfaceHints`
entfernt; `isVararg` bleibt beim Kopieren von Funktionsknoten erhalten
(`PATCH.md`). Dezimalpunkt statt Sprache des Rechners ist in
`docs/kotlin-surface.md` dokumentiert.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- Zwischenstand: `"%s %s".format("a", 1)` fand zunächst keine passende
  Funktion; Ursache war der Verlust von `vararg` beim Registrieren von
  Erweiterungen, auch für eigene Erweiterungen in Schülercode.
- `smoke-kotlin-surface.mjs` gegen das Bundle aus 2c81dd6: die 12 neuen
  Ausdrücke fehlen; RT-66-Block in `smoke-curriculum-kotlin.mjs` gegen dasselbe
  Bundle scheitert beim ersten Fall. Mit dem neuen Bundle beide grün
  (128 unterstützt, 9 bekannte Lücken, 21 Meldungen).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 141/141 grün; PERF-01
  dabei 325 Frames, p95 15,1 ms, max. 19,1 ms.
- `git diff --check` ohne Befund.

### RT-67: `object`, `companion object` und `const val` (2026-10-03)

Nach „dann weiter“ des Nutzers. Parser, Analyzer und Interpreter im Vendor
(`PATCH.md`), Manifest (`kind: "object"`, `companionMethods`) und
Parser-Meldungspositionen in `KotliteSession`, Titel des Aufrufdialogs in
`CallDialogs.svelte`. Die Oberfläche kannte Objekte und Companion-Methoden
schon; erst jetzt liefert die Laufzeit sie.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- Zwischenstände: Ein Default-Argument mit Companion-Konstante
  (`class Konto(val stand: Int = START)`) analysierte das Companion, bevor die
  Konstruktor-Properties bekannt waren; sie werden dafür jetzt vorab
  eingetragen. Ruft das Companion eine Methode ohne Rückgabetyp auf, während
  die Klasse noch analysiert wird (`init { anzahl++ }`), gilt die bekannte
  Grenze aus RT-40 (Rückgabetyp nötig); dokumentiert in README und
  `docs/kotlite.md`.
- Nebenbefunde: `Box.von(5)` auf dem Companion einer generischen Klasse
  scheiterte schon mit dem Bundle aus 891dd9a („Number of type arguments“,
  auch `fun Box.Companion.f()`); ein Klassenname allein (`Katze`) brachte die
  Laufzeit dort zum Absturz. Beides behoben.
- `smoke-curriculum-kotlin.mjs` gegen das Bundle aus 891dd9a: alle früheren
  Blöcke grün, der RT-67-Block scheitert beim Laden des Projekts. Mit dem
  neuen Bundle grün.
- Browser-Test RT-67 einzeln grün (Objektmethoden zweimal über das
  Klassenmenü, Companion-Methode mit Argument, Dialogtitel `Hund.neu()`).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 142/142 grün; PERF-01
  dabei 320 Frames, p95 15,2 ms, max. 17,3 ms.
- `git diff --check` ohne Befund.

### RT-68: Methoden ohne Rückgabetyp vor ihrer Deklaration (2026-10-03)

Nach „dann los“ des Nutzers. Analyse bei Bedarf über
`FunctionDeclarationNode.returnTypeInference` (`PATCH.md`); README „Aktuelle
Grenzen“ und `docs/kotlite.md` angepasst.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- Vorher (Bundle aus 7aa917b): `fun a() = b(); fun b() = 1` in einer Klasse,
  `val start = doppelt(1)` vor `fun doppelt(…)`, einander aufrufende Objekte
  und ein Companion, das während `init` `fun geheim() = wert + 1` aufruft,
  scheiterten mit „Cannot infer return type …“. `smoke-curriculum-kotlin.mjs`
  gegen dieses Bundle scheitert am RT-67-Block (jetzt ohne `: Int` an
  `geheim`); mit dem neuen Bundle grün, einschließlich RT-68-Block.
- Beim Prüfen gefunden, getrennt als RT-69: Ein Methodenaufruf im Lambda einer
  Bibliotheksfunktion (`listOf(1).map { it + groesse() }`) scheitert zur
  Laufzeit schon mit dem Bundle aus 891dd9a.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 142/142 grün; PERF-01
  dabei 322 Frames, p95 15,0 ms, max. 19,6 ms.
- `git diff --check` ohne Befund.

### RT-69: Methodenaufrufe ohne `this.` in Lambdas (2026-10-03)

Beim Prüfen von RT-68 gefunden. Der Analyzer gibt einem Aufruf über den
impliziten Empfänger den Eigentümer `this/<Klasse>` (`PATCH.md`).

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- Vorher (Bundle aus 891dd9a und 1724af8): `listOf(1, 2, 3).map { it +
  groesse() }` in einer Methode scheiterte zur Laufzeit mit „Function
  `groesse` not found on implicit receiver“, mit und ohne Rückgabetyp an
  `groesse`. Der RT-69-Block in `smoke-curriculum-kotlin.mjs` scheitert mit
  dem Bundle aus 1724af8 am ersten Fall; mit dem neuen Bundle grün.
- Daneben gefunden, offen: `K(4).f()` für `val f: () -> Int` meldet „`f` is
  unknown for K“; `val g = K(4).f; g()` funktioniert.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 142/142 grün; PERF-01
  dabei 322 Frames, p95 15,0 ms, max. 17,7 ms.
- `git diff --check` ohne Befund.

### RT-70: Zeilenumbruch nach `=` nach dem Formatieren (2026-10-04)

Vom Nutzer gemeldet: Die Klasse `Karte` compilierte, nach „Format Kotlin
file“ meldete BlueK „Line 27: Unexpected token Token(type=NewLine …)“ bei
`val symbol =` mit dem `when` in der nächsten Zeile. Ursache und Änderung in
`PATCH.md`.

Tatsächliche Prüfungen mit dem neu gebauten Bundle:

- Die formatierte Klasse des Nutzers lädt und läuft (`Karte("Herz",
  "Dame").berechneWert()` = 10, `druckeKarte()`, beide Fehlermeldungen); mit
  dem Bundle aus a09d104 dieselbe Meldung wie im Screenshot.
- Browser-Test RT-70 einzeln grün; mit dem Bundle aus a09d104 rot mit der
  Meldung „Line 23: Unexpected token … NewLine“ im Editor.
- RT-70-Block in `smoke-curriculum-kotlin.mjs` grün, mit dem Bundle aus
  a09d104 rot beim Laden.
- Vollständiger `npm run test:regression` (lief beim Commit a881b27 noch, der
  auf Wunsch des Nutzers ohne Warten gepusht wurde): Typecheck 0 Fehler/0
  Warnungen, alle Node-Suiten grün, `test:offline` 4/4, Chromium 143/143
  grün; PERF-01 dabei 323 Frames, p95 15,2 ms, max. 19,5 ms. Während des
  Laufs war kurz `main` ausgecheckt (Merge), ohne Auswirkung auf das
  Ergebnis.
- `git diff --check` ohne Befund.

### GUI-96: Ergebnisfenster vor offenem Editor (2026-10-04)

Vom Nutzer auf bluek.de gemeldet. Ergebnis-, Compilerfehler- und
Share-Link-Dialog bekommen `topmost-modal`.

- Browser-Test GUI-96 grün; ohne `topmost-modal` am Ergebnisfenster rot.
- Vollständiger `npm run test:regression` nach dem Push von 0af139d:
  Typecheck 0 Fehler/0 Warnungen, alle Node-Suiten grün, `test:offline` 4/4,
  Chromium 144/144 grün; PERF-01 dabei 321 Frames, p95 15,1 ms, max. 16,8 ms.

### RT-71 und GUI-97/EXP-12: Stacktraces wie Kotlin, ANSI-Farben im Terminal (2026-10-04)

RT-71 nach „weiter mit den Stacktraces“, GUI-97/EXP-12 auf Wunsch des Nutzers
(Spielkarte mit roten Herzen). Ein erster RT-71-Regressionslauf wurde
abgebrochen, weil während des Laufs Frontend-Dateien geändert wurden (GUI-47
dadurch rot); der folgende Lauf deckt beide Punkte ab.

Tatsächliche Prüfungen:

- RT-71: `smoke-curriculum-kotlin.mjs` grün; mit dem Bundle aus c65c68d rot an
  der angepassten RT-38-Erwartung (`at toInt(Kotlin library)` fehlt).
- GUI-97: Browser-Test grün; mit der alten Terminaldarstellung rot (rohe
  ESC-Zeichen). EXP-12 grün; ein Entwurf mit eigener CSS-Datei brach
  `npm run build:player`, daher Inline-Stile mit CSS-Variablen.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 146/146 grün; PERF-01
  dabei 323 Frames, p95 15,0 ms, max. 16,5 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-73 bis RT-77 (2026-10-04)

Eigenständig abgearbeitet, während der Nutzer abwesend war: `error()` (RT-73),
Zahlliterale (RT-74), Properties mit Funktionstyp aufrufen (RT-75),
speziellere Rückgabetypen beim Überschreiben (RT-76) und der Codepad-Absturz
bei überschriebenen Properties (RT-77, beim Prüfen von RT-76 gefunden). Je
ein Commit, ein gemeinsamer Regressionslauf und ein Push.

- Jeder Punkt: neuer Testblock grün, mit dem Bundle des vorigen Commits rot
  (Einzelheiten in den Zeilen RT-73 bis RT-77).
- Zwischenstand RT-75: eine Vorab-Analyse des Empfängers brach RT-65 und einen
  Generics-Grenztest sowie zwei Meldungen in `smoke-kotlin-surface.mjs`;
  behoben, bevor committet wurde.
- `browser-smoke`, `test:generics`, `test:blueplay-demos`, `test:references`
  und `test:inspector` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 146/146 grün; PERF-01
  dabei 324 Frames, p95 15,1 ms, max. 19,1 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-78 und RT-79 (2026-10-04)

Eigenständig während der Abwesenheit des Nutzers: Enums (RT-78, beim
Sondieren gefunden) und Interfaces mit Default-Methoden und Properties sowie
abstrakte Properties (RT-79, offener Punkt der README).

- Je ein Testblock in `smoke-curriculum-kotlin.mjs`, grün; mit dem Bundle des
  vorigen Commits rot beim Laden des Projekts.
- `browser-smoke`, `test:generics`, `test:blueplay-demos`, `test:references`
  und `test:inspector` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 146/146 grün; PERF-01
  dabei 320 Frames, p95 15,3 ms, max. 19,8 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-80 und RT-81 (2026-10-04)

Eigenständig während der Abwesenheit des Nutzers: `protected`/`internal`
(RT-80) und `lateinit var` (RT-81), beide offene Punkte der README.

- Je ein Testblock in `smoke-curriculum-kotlin.mjs`, grün; mit dem Bundle des
  vorigen Commits rot beim Laden. `smoke-kotlite-browser.mjs` erwartete die
  Ablehnung von `protected` und prüft jetzt den Zugriffsfehler.
- `browser-smoke`, `test:generics`, `test:blueplay-demos`, `test:references`
  und `test:inspector` grün; Typecheck nach der Änderung in
  `objectMenuMethods.ts` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 146/146 grün; PERF-01
  dabei 321 Frames, p95 15,2 ms, max. 19,5 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### GUI-98: große Schrift im Terminal (kitty OSC 66) (2026-10-04)

Auf Wunsch des Nutzers nach kurzer Recherche (DEC-Zeilen doppelter Höhe
gegenüber kitty-Protokoll; Entscheidung des Nutzers: nur OSC 66).

- `smoke-ui-behavior.mjs`: neue Parser-Fälle grün; mit dem Parser aus fc46946
  rot (die Karte fehlt in der Ausgabe).
- Browser-Test GUI-98 grün, mit dem alten Parser rot; GUI-97, EXP-12 und der
  neue Player-Test EXP-12 (Größe) grün. Der Player-Test war zunächst rot, weil
  die lokale Player-Vorlage veraltet war; nach `npm run build:player` grün.
- Manuell im Dev-Server geprüft: Block 7 Zeilen hoch (115,5 px bei 16,5 px
  Zeilenhöhe), Folgetext an der erwarteten Zeile.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 148/148 grün; PERF-01
  dabei 323 Frames, p95 15,1 ms, max. 26,1 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### GUI-99: Terminal-Anfasser unter dem Objektinspektor (2026-10-04)

Vom Nutzer gemeldet. Der Anfasser hatte einen festen Z-Index 35 über allen
Fenstern außer Sonderfällen; jetzt liegt er im Stapel des Terminalfensters.

- Browser-Test GUI-99 grün; mit dem vorigen Stand rot (an der Stelle des
  Anfassers lag nicht der Inspektor). GUI-37, GUI-73 und GUI-06 grün; GUI-73
  vergleicht jetzt die Ebene des Terminals mit dem Weltfenster.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 149/149 grün; PERF-01
  dabei 323 Frames, p95 15,1 ms, max. 16,8 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-82: Weiterarbeiten nach einer Exception (2026-10-04)

Vom Nutzer gemeldet, das Codepad ausdrücklich eingeschlossen. Vorher sperrte
jede Laufzeit-Exception die Sitzung (`faulted`); eine Exception aus `main()`
erschien dabei nirgends, nur „Execution stopped“ (im Dev-Server mit dem alten
Bundle geprüft). Jetzt sperren nur noch Interpreterfehler.

- Sonde gegen die Session: nach `IllegalArgumentException` in `wert()`,
  `NumberFormatException`, `error()` und `StackOverflowError` (Rekursion)
  bleiben Objekt, Codepad und Variablen benutzbar; mit dem Bundle aus 426a0e3
  danach „Runtime failed. Reset or compile …“.
- Browser-Test RT-82 grün; mit altem Bundle und alter Oberfläche rot (Dialog
  „Exception“ fehlt). BluePlay-Fall in `smoke-runtime-state.mjs` grün; mit
  altem Bundle und `runtimeHost.ts` rot (Simulation `faulted`).
- Der künstliche Aufruf von `act()` und BluePlays `main` trägt jetzt die
  Bibliotheksposition; vorher erschien `at <top-level>(Panne.kt:3)` im
  Stacktrace.
- Erster vollständiger Lauf: EXP-03 rot, weil der Player die Exception aus
  `main()` jetzt auch ins Terminal schreibt; Erwartung angepasst (gewollt,
  gleiches Verhalten wie das IDE-Terminal).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression` nach der Anpassung: Typecheck
  0 Fehler/0 Warnungen, alle Node-Suiten grün, `test:offline` 4/4, Chromium
  150/150 grün; PERF-01 dabei 323 Frames, p95 15,1 ms, max. 17,4 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-83: sekundäre Konstruktoren mit `: this(…)` (2026-10-04)

Auf Wunsch des Nutzers („weiter mit den sekundären Konstruktoren“).

- Sonde: 17 Fälle wie in Kotlin (Reihenfolge init/Rumpf, Ketten, Standard-
  und benannte Argumente, generisch, `data`, Unterklasse, abstrakt) sowie die
  Fehlerfälle. Dabei gefunden: `Punkt(1, 2)` war mehrdeutig zwischen
  Primärkonstruktor und einem sekundären mit Standardwerten; die
  Überladungsauflösung bevorzugt jetzt wie Kotlin den Kandidaten ohne
  Standardwerte (gilt auch für Funktionen).
- Testblock RT-83 grün; mit dem Bundle aus 80ca0d6 rot („Secondary constructor
  delegation (this/super) is not supported“). Browser-Test RT-83 grün, mit
  altem Bundle rot.
- `browser-smoke`, `test:generics`, `test:blueplay-demos`, `test:references`
  und `test:inspector` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 151/151 grün; PERF-01
  dabei 322 Frames, p95 15,1 ms, max. 19,4 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-84 und GUI-100: vergleichbare Enums, Aufrufdialog wie BlueJ (2026-10-04)

RT-84 als nächster offener Punkt der README; GUI-100 auf Wunsch des Nutzers
dazwischen.

- RT-84: Testblock in `smoke-curriculum-kotlin.mjs` grün; mit dem Bundle aus
  067f8dd rot (Enum mit Interface abgelehnt). Dabei: Kotlite verbot Enums
  jedes Interface; jetzt nur noch Oberklassen, wie Kotlin.
- GUI-100: Browser-Test grün; mit dem alten `CallDialogs.svelte` rot. Im
  Dev-Server angesehen: Konstruktordialog hell und dunkel, Wechsel des
  Konstruktors, Methodendialog mit optionalem Parameter. Dabei gefunden und
  behoben: Labels im dunklen Design kaum lesbar, Konstruktorauswahl neben dem
  Label gequetscht.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 152/152 grün; PERF-01
  dabei 327 Frames, p95 15,2 ms, max. 17,4 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-85: Schleifen mit Label (2026-10-04)

Offener Punkt der README.

- Sonde: acht Fälle wie in Kotlin, darunter `continue@aussen` in `do … while`
  (die Bedingung wird ausgewertet) und `break@innen` in einer inneren
  Schleife; `return@forEach` unverändert.
- Testblock RT-85 grün; mit dem Bundle aus 91bc49c rot („Unexpected token“).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 152/152 grün; PERF-01
  dabei 319 Frames, p95 15,2 ms, max. 51,5 ms (einzelner Ausreißer, Test
  grün).
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-86: sealed-Klassen (2026-10-04)

Offener Punkt der README.

- Sonde: Formen mit `is`-Zweigen und `object`, verschachteltes sealed
  Interface, nullbares Subjekt, `when` als Anweisung ohne alle Zweige, fehlende
  Unterklasse als Fehler. Dabei: Kotlite lehnte Modifier an Interfaces außer
  `abstract`/`open` ab; `sealed interface` ist jetzt erlaubt.
- Testblock RT-86 grün; mit dem Bundle aus 77cf4b6 rot.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 152/152 grün; PERF-01
  dabei 324 Frames, p95 15,2 ms, max. 26,6 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-87 und RT-88: Bit-Operationen, `.5`, lateinit überall (2026-10-04)

Offene Punkte der README; nach RT-86 eigenständig weitergeführt.

- RT-87: Fälle in `smoke-kotlin-surface.mjs` grün; mit dem Bundle aus c9a3996
  rot (`.5` Parsefehler, `and` unbekannt). Rangfolge der Infix-Aufrufe mit
  Kotlin verglichen (`1 + 2 shl 1`, `6 and 3 or 8`, `bits and 1 == 1`).
- RT-88: Testblock grün; mit dem Bundle aus c9a3996 rot. Dabei: Lesen einer
  deklarierten, aber nicht zugewiesenen Variable meldete „The variable
  `x/16` has not been declared“; jetzt `UninitializedPropertyAccessException`.
- Arrays bleiben bewusst offen (docs/kotlin-surface.md: der Lehrgang arbeitet
  mit Listen).
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression`: Typecheck 0 Fehler/0 Warnungen,
  alle Node-Suiten grün, `test:offline` 4/4, Chromium 152/152 grün; PERF-01
  dabei 322 Frames, p95 15,1 ms, max. 18,3 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### RT-89 und RT-90: Funktionsreferenzen, `this` in Lambdas (2026-10-04)

RT-89 als offener Punkt der README; RT-90 dabei gefunden.

- RT-89: Sonde mit 16 Fällen; Testblock grün, mit dem Bundle aus c4bccad rot.
  Erweiterungs-Properties mit Getter zurückgestellt: sie bräuchten einen
  Eingriff in die Vorab-Analyse von Top-Level-Deklarationen über Dateien.
- RT-90: `this.f(it)` in Lambdas an `map`/`filter`/`forEach` scheiterte schon
  vorher (mit dem alten Bundle nachgestellt). Ursache: Lambda-Argumente
  entstanden erst im Gültigkeitsbereich des Empfängers. Testblock grün, mit
  dem Bundle aus c4bccad rot.
- Erster vollständiger Lauf rot in `smoke-blueplay-browser.mjs`:
  `actors.joinToString(",") { it.label }` übergab das Lambda an `prefix`.
  Vorab ausgewertete Argumente waren nach Argumentposition nummeriert und
  wurden nach der Zuordnung noch einmal nach Parameterposition eingesetzt;
  behoben und als Fall in RT-90 aufgenommen.
- `smoke-kotlite-browser.mjs` schlug während der Arbeit zweimal fehl (einmal
  schon vor der Änderung an der Laufzeit, beide Male an einem RT-42-Fall zu
  tiefer Rekursion); danach in sieben Läufen grün, die RT-42-Fälle einzeln in
  60 Wiederholungen stabil. Ursache nicht gefunden; beobachten.
- `browser-smoke`, `test:generics` und `test:blueplay-demos` grün.
- Vollständiger `npm run test:regression` nach der Korrektur: Typecheck
  0 Fehler/0 Warnungen, alle Node-Suiten grün, `test:offline` 4/4, Chromium
  152/152 grün; PERF-01 dabei 323 Frames, p95 15,2 ms, max. 19,4 ms.
- `git diff --check` ohne Befund; keine `* 2.*`-Dateien.

### PERF-06: Messtest für den Interpreter, Lambdas ohne Exception (2026-10-05)

Auf Wunsch des Benutzers: Kotlite soll durch Sprachänderungen nicht
nennenswert langsamer werden; außerdem der wackelnde RT-42-Fall.

- Neuer Messtest `npm run test:performance` (PERF-06), Teil von
  `test:regression`. Vergleich der Bundles vor RT-83 (80ca0d6), vor RT-89
  (c4bccad) und aus e247b7b: Rekursion, Schleifen, Objekte, Listen-Lambdas,
  Zeichenketten und Compile im Rahmen der Messstreuung gleich.
- Dabei gefunden: Seit RT-90 suchte jedes Lambda ohne Empfänger sein `this`
  mit `runCatching`; auf oberster Ebene gibt es keins, also entstand bei jedem
  Lambda eine Exception. 20 000 Lambdas auf oberster Ebene: 1002 ms statt
  409–520 ms (c4bccad). Jetzt `SymbolTable.findPropertyHolder` ohne
  Exception: 479–498 ms, gleichauf mit c4bccad; Lambdas in Methoden
  unverändert. Messfall „lambda creation 10000“: 260 ms, mit dem Bundle aus
  e247b7b 422–429 ms und damit rot (Grenzwert 380 ms).
- RT-42: Die Fehlersuche fand nur einen tatsächlich protokollierten Ausfall
  (2026-10-04, direkt nach einem Zwischenstand von RT-90); seine Meldung ging
  durch gekürzte Ausgabe verloren. Nicht reproduzierbar: 64 Läufe der ganzen
  Suite mit 16 gleichzeitigen Prozessen, `forEach`-Rekursion bei 857
  verschiedenen Stack-Tiefen, mit `--stack-size` 300–2000, `--no-opt` und
  dauernd fälligen Zeitscheiben-Checkpoints, alle grün. Wahrscheinliche
  Ursache war dasselbe `runCatching`: es fängt auch einen Stack-Überlauf des
  Browsers, und der `forEach`-Fall von RT-42 erzeugt bei jeder
  Rekursionsstufe ein solches Lambda. Nicht bewiesen; weiter beobachten.
- `smoke-kotlite-browser`, `smoke-curriculum-kotlin` (RT-90),
  `smoke-blueplay-browser` (`joinToString`) und `test:kotlin-surface` mit dem
  neuen Bundle grün.
- Vollständiger Lauf (`build:player`, `build:offline`, `browser-smoke`,
  `test:generics`, `test:blueplay-demos`, `test:regression`) grün: Typecheck
  0 Fehler/0 Warnungen, alle Node-Suiten grün, PERF-06 175–328 ms je Fall,
  `test:offline` 4/4, Chromium 152/152; PERF-01 323 Frames, p95 15,1 ms,
  max. 26,2 ms.

### RT-91 und RT-92: verschachtelte und innere Klassen (2026-10-05)

Auf Wunsch des Benutzers: innere Klassen wie in Java; verschachtelte Klassen
gehören dazu.

- Sonden: 26 Fälle verschachtelt, 15 innere; Testblöcke grün, mit dem Bundle
  aus d9650cc rot („Nested classes are not supported“), ebenso der
  Chromium-Test (Klassenkarten-Zählung).
- Zwischenfehler: `inner` als Modifikator für alle Deklarationen brach einen
  Lambda-Parameter namens `inner` in `smoke-generics-boundaries`; jetzt wie
  `data` nur vor `class`, als Fall in RT-92.
- Nebenbei gefunden, nicht behoben: generische Klassen mit einem Property, das
  `T` in einem generischen Aufruf benutzt (`val daten = mutableListOf<T>()`)
  oder eine Konstruktor-Property `List<T>` haben, scheitern beim Erzeugen
  („Cannot resolve type T“), in allen Bundles seit dem ersten Commit;
  `sumOf { … }` mit `Double`-Ergebnis meldet „cannot be converted to Int“.
- `npm run build:kotlite` hing 20 Minuten an iCloud-Kopien („27_model 2.knm“)
  im ignorierten Build-Verzeichnis; die 195 Kopien dort gelöscht.
- PERF-06 nach dem Umbau des Parsers unverändert (Compile Space Invaders
  150 ms).
- Vollständiger Lauf (`build:player`, `build:offline`, `browser-smoke`,
  `test:generics`, `test:blueplay-demos`, `test:regression`) grün: Typecheck
  0 Fehler/0 Warnungen, alle Node-Suiten grün, PERF-06 149–343 ms je Fall,
  `test:offline` 4/4, Chromium 153/153; PERF-01 326 Frames, p95 15,1 ms,
  max. 21,8 ms.

### RT-93: generische Klassen, `emptyList()` (2026-10-05)

Bei RT-92 gefunden (generische äußere Klasse): Schon ein `Stapel<T>` mit
`mutableListOf<T>()` scheiterte, in allen Bundles seit dem ersten Commit
(Stichproben über die Bundle-Historie bis dfb7fe0).

- Drei Fehler: Initialisierer ohne Typargumente, Typprüfung ohne
  verschachtelte Typargumente, doppelte Ersetzung des Rückgabetyps (betraf
  nur Typparameter namens `T`, mit `X` oder `E` ging es). Dazu fehlte
  `emptyList()`/`emptySet()` ganz.
- Sonden: 30 Fälle; Testblock grün, mit dem Bundle aus 531391f rot
  (`emptyList` unbekannt; die übrigen Fehler mit d9650cc einzeln
  nachgestellt).
- Betroffene Suiten (`smoke-kotlite-browser`, `smoke-blueplay-*`,
  `smoke-curriculum-kotlin`, `smoke-kotlin-surface`, `smoke-generics*`,
  `smoke-space-invaders`) grün; PERF-06 unverändert (Compile 157 ms).
- Vollständiger Lauf grün: Typecheck 0 Fehler/0 Warnungen, alle
  Node-Suiten grün, `test:offline` 4/4, Chromium 153/153. PERF-06 diesmal
  knapp unter den Grenzen (Lambda 374 von 380 ms, Zeichenketten 300 von
  330 ms), bei gleichzeitiger anderer Arbeit am Rechner; einzeln vorher
  263/197 ms.

### RT-94/RT-95: Standardbibliothek für Zeichenketten, Vergleicher und Sammlungen (2026-10-05)

Anlass: Der Nutzer vermisste `"…".ifBlank { }`. Eine Prüfung mit über 500
Ausdrücken üblichen Schul- und KI-Kotlins (Strings, Zahlen, Listen, Maps,
Vergleicher) ergab die in RT-94/RT-95 genannten Lücken.

- `associateBy` war in allen Bundles mehrdeutig, weil Kotlite 1.1.0 zusätzlich
  ein falsch benanntes `Iterable<K>.associateBy(valueSelector)` deklariert.
  BlueK registriert diese Überladung nicht mehr (`KotliteSession`).
- Typvariablen, die nur im Rückgabetyp stehen (`compareBy`, `reverseOrder`),
  kommen jetzt vor den Lambda-Argumenten aus dem erwarteten Typ der
  Deklaration (PATCH.md). Im Argument eines anderen Aufrufs weiter nicht;
  als bekannte Lücke im Surface-Test und in der README.
- `smoke-kotlin-surface`: 219 unterstützte Ausdrücke, 8 Lücken, 21 Meldungen;
  mit dem Bundle aus 1b47dff 63 Fehlschläge.
- PERF-06 jetzt mit bis zu drei Versuchen je Fall.
- Vollständiger Lauf grün: Typecheck 0 Fehler/0 Warnungen, alle Node-Suiten
  grün, PERF-06 184–329 ms je Fall (Compile 152 ms), `test:offline` 4/4,
  Chromium 153/153; PERF-01 322 Frames, p95 15,5 ms, max. 19,6 ms.

### RT-96: Arrays (2026-10-05)

Anlass: KI-generierter Code des Nutzers mit `val fertig = booleanArrayOf(false, false)`
(„`booleanArrayOf` is unknown“).

- Umsetzung als Bibliotheksklassen (`BlueKArrays.kt`): `Array<T>` und die
  primitiven Arrays erben von Kotlites `List` und halten ihre Elemente in
  einer Liste fester Größe mit Identitätsvergleich. So gelten alle
  Listenfunktionen ohne eigene Definition; neu sind nur Konstruktion, `set`,
  Änderungen an Ort und Stelle und die `content…`-Funktionen.
- Gefundener Vendor-Fehler: Erweiterungsfunktionen auf Klassen, deren
  Oberklasse ein festes Typargument hat (`IntArray : List<Int>`), brachen
  den Sitzungsstart mit NullPointerException ab (PATCH.md).
- `String(charArray)` wieder entfernt: Die Funktion `String` verdeckte
  `String.format(…)` (im Surface-Test aufgefallen).
- Sonden: 95 Ausdrücke; Surface-Test (245 unterstützt, 6 Lücken, 20
  Meldungen) und Browsertest RT-96 grün, mit dem Bundle aus 41edf7a rot.
- Vollständiger Lauf grün: Typecheck 0 Fehler/0 Warnungen, alle Node-Suiten
  grün, PERF-06 157–346 ms je Fall, `test:offline` 4/4, Chromium 154/154;
  PERF-01 322 Frames, p95 15,2 ms, max. 23,5 ms.

### RT-97: Konformitätsversuch mit offiziellen Kotlin-Tests (2026-10-05)

Anlass: Vorschlag des Nutzers nach minikotlins Abdeckungsseite. Vereinbart war
ein Versuch mit Abbruchkriterium: nur Unterrichtsbereiche, nur falsche
Ergebnisse und Abstürze auswerten, abbrechen, wenn sich nur Exotisches findet.

- Umfang: 39 Bereiche aus `compiler/testData/codegen/box` (Stand e5b61f33),
  2.933 Tests, davon 2.453 im Umfang (ohne JVM/JS, mehrere Dateien,
  Sprach-Flags, Reflection, Koroutinen). Erster Lauf: 734 bestanden,
  14 falsche Ergebnisse, 122 Abstürze zur Laufzeit, Rest Compile-Lücken.
- Kriterium nicht erfüllt, also lohnend: Funde in normalem Unterrichts-Kotlin
  (`zaehler[i]++` stürzte ab, Würfelstatistik zählte 609 von 600 Würfen,
  `spieler[0].punkte += 1` stürzte ab, `public` und `RuntimeException` fehlten).
- Nach der Korrektur 815 bestanden, keiner schlechter; die bestandenen sind
  die Baseline von `npm run test:conformance` (Prüflauf grün, etwa 5 Minuten).
- Offene Abweichungen: Companion-`init`, Interface-Raute (README), dazu
  Randfälle (Identität von Zahlen und Konstanten, `break` in
  Schleifenbedingungen, Auswertungsreihenfolge bei `x += if (…) { x += 1 … }`).
  Häufigste Compile-Lücken: Objekt-Ausdrücke, Enum-Einträge mit Rumpf,
  `Char`-Ranges mit `downTo`/`step`, `Short`/`Byte`/`UInt`, `val x get() = …`
  ohne Typ.
- Vollständiger Lauf grün: Typecheck 0 Fehler/0 Warnungen, alle Node-Suiten
  grün, PERF-06 164–348 ms je Fall, `test:offline` 4/4, Chromium 154/154;
  PERF-01 322 Frames, p95 15,3 ms, max. 17,7 ms.

### RT-98/RT-99: Smart Casts (2026-10-06)

Anlass: Blackjack-Projekt des Nutzers (`if (eingabe.isNullOrEmpty()) standard
else eingabe` abgelehnt), danach auf seinen Wunsch systematische Prüfung.

- Sonden: 60 Fälle, die Kotlin annimmt (vorher 36 grün, jetzt 54), und 24, die
  Kotlin ablehnt (alle abgelehnt, vorher wie nachher). Offen: `this is T` in
  Erweiterungen, `this.eigenschaft`, `is` auf `T`, Safe-Call-Bedingungen,
  `Byte?` mit `!= null` (älterer Analysefehler).
- Nebenfund mit Laufzeitabsturz: `for` über eine Liste mit `null`-Elementen.
- Die Konformitäts-Baseline fing eine eigene Regression ab (`+=` auf einer
  Variablen mit Smart Cast, `strings/kt894.kt`); behoben, danach 819 bestanden.
- Vollständiger Lauf grün: Typecheck 0 Fehler/0 Warnungen, alle Node-Suiten
  grün, PERF-06 162–363 ms je Fall, `test:offline` 4/4, Chromium 154/154;
  PERF-01 319 Frames, p95 15,3 ms, max. 17,4 ms.

### RT-100: Typargumente aus dem äußeren Aufruf (2026-10-06)

Anlass: Auf Wunsch des Nutzers die zwei verbliebenen häufigen Lücken aus
KI-Code (`sortedWith(compareBy({ … }, { … }))`, `getOrPut(k) { mutableListOf() }`).

- Sonden: 16 Kernfälle (vorher 2 grün, jetzt 16), 22 weitere Ableitungsfälle
  (vorher 9, jetzt 19; offen: `if`-Zweige, `getOrPut(…) { … } += x`).
- Zwei Zwischenstände fielen in bestehenden Suiten auf und wurden
  eingeschränkt: `mutableListOf(1).add("x")` wurde angenommen
  (`smoke-curriculum-kotlin`), `reified T` in `filter { … }.map { it as T }`
  lieferte falsche Elemente (`smoke-generics-boundaries`).
- Konformität: alle 819 Baseline-Tests grün.
- Vollständiger Lauf grün: Typecheck 0 Fehler/0 Warnungen, alle Node-Suiten
  grün, PERF-06 162–340 ms je Fall, `test:offline` 4/4, Chromium 154/154;
  PERF-01 324 Frames, p95 15,1 ms, max. 17,5 ms.
