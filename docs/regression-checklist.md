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

## Checkliste

| ID | Erwartetes Verhalten / Reproduktion | Bisheriger Nachweis | Automatisierung / offen |
| --- | --- | --- | --- |
| GUI-01 | New Project: Empty Project, BluePlay Template, BluePlay Example, BlueK Demo Project und Space Invaders Demo erscheinen in dieser Reihenfolge | Echter Chromium-Lauf prüft alle fünf Vorlagen; `test:blueplay-demos` prüft Welt, Invader, Defender und Laser | Laufendes Canvas-Spiel noch visuell abnehmen |
| GUI-02 | Auch ein parameterloser Konstruktor öffnet den Create-Dialog, schlägt hund1 bzw. hund2 vor und erstellt erst nach Bestätigung die Instanz | GUI-Test aktualisiert: beide parameterlosen Konstruktor-Dialoge, Namensvorschläge und Bench | Abgesichert |
| GUI-03 | Computed Property zeigt im Inspektor den Wert | Nutzerbestätigung + GUI grün mit echtem Getter | Abgesichert |
| GUI-04 | Nach jeder Änderung im Inspektor sofort aktueller Getter-Wert, keine Änderung Verzögerung | GUI grün: 1 → 2 → 3 → 7, zusätzlich Änderung über Codepad auf 9 | Abgesichert |
| GUI-05 | Codepad: Enter, danach Pfeil hoch wiederholt Eingabe; auch nach Terminalausgabe | GUI grün: Fokus und History nach Ausdruck und println | Abgesichert für diese Abläufe |
| GUI-06 | Terminal-Splitter reicht über gesamte Höhe; Ziehen verändert beide Bereiche korrekt | GUI grün: Höhe und Breiten beider Bereiche | Abgesichert bei 1440 × 1000 |
| GUI-07 | Alle Kotlin-Werte im Codepad haben bedienbaren roten Kasten und können auf die Bench | GUI grün: Int, String, eigene Klasse; Werte und Alias sichtbar | Weitere Typen noch ausbauen |
| GUI-08 | Editor öffnet fokussiert; der Close-Button gehört zur gemeinsamen Fenster-Titelleiste | Chromium-Test prüft Fokus, Umbenennung nach leerem Inhalt und sichtbaren Close-Button | Abgesichert |
| GUI-09 | Bench/Codepad-Splitter springt beim ersten Ziehen nicht | Nutzerbestätigung + GUI grün für ersten und zweiten Drag | Abgesichert bei 1440 × 1000 |
| GUI-10 | Klasse umbenennen benennt Datei um, auch nach vorübergehend leerem Editor | GUI grün: Hund → Tier → leer → Katze; danach instanziiert | Abgesichert für Ersetzen des Editorinhalts |
| GUI-11 | Codepad ohne manuellen Compile: Ausdruck im leeren Projekt und mit Klassen ausführen | GUI grün mit echtem Worker | Abgesichert |
| GUI-12 | Terminal zeigt Eingabe blau zwischen vorheriger und nachfolgender Ausgabe | GUI grün: A, Eingabe, B, Ausgabe; Echo-Klasse vorhanden | Exakte Farbe noch visuell prüfen |
| GUI-13 | Clear leert alle Terminalinhalte sofort, auch im geteilten Terminal; App bleibt sichtbar; spätere Ausgabe funktioniert | GUI grün: Clear im Split-Terminal, Form Feed, danach neue Ausgabe | Abgesichert |
| GUI-14 | Print/println wird während laufender Schleife sichtbar | GUI grün: Ausgabe vor Schleifenende, danach Reset | Laufzeit prüft zusätzlich Einzelereignisse |
| GUI-15 | Keine EOF/Stop/Close-Leiste oder Hinweiszeile; aktives Eingabefeld farblich erkennbar | GUI grün: Eingabe aktiv/inaktiv, keine Hinweiszeile | Visuelle Details noch offen |
| GUI-16 | Files zeigt zunächst nur einen Hinweis-Popup ohne Funktionalität | GUI grün | Abgesichert |
| GUI-17 | Vorlagen erscheinen untereinander; Escape bricht Projekt-, Konstruktor- und Methodendialoge ab; Eingabefokus startet sinnvoll | GUI grün: 17/17 Chromium-Tests | Weitere visuelle Abnahmen offen |
| GUI-18 | Primitive Inspektoren zeigen ihren Typ, bleiben feldlos und werden beim Verschieben aktiviert; Escape schließt den aktiven Inspector | GUI grün: 18/18 Chromium-Tests | Weitere Typen noch ausbauen |
| GUI-19 | Codepad-Eingaben und Ergebnisse stehen mit kompaktem vertikalem Abstand wie im BlueJ-Stil | GUI-Test grün | Visuelle Abnahme offen |
| GUI-20 | Lange Codepad-Werte werden per CSS dynamisch einzeilig gekürzt, behalten den Typ sichtbar und zeigen den vollständigen Wert per Hover | GUI-Test grün | Visuelle Abnahme offen |
| GUI-21 | Dasselbe Codepad-Objekt kann unter mehreren Referenznamen auf der Objektbank abgelegt werden; der gemeinsame Inspector zeigt den jeweils aufgerufenen Referenznamen | GUI-Test grün | Visuelle Abnahme offen |
| GUI-22 | Obere Aktionen sind zu New Project, Open / Import, Save / Export und Files gebündelt; Open nutzt ein Drop-Feld, Save das New-Project-Layout und alle schalten gemeinsam auf Icon-only um | GUI-Test grün | Visuelle Abnahme offen |
| GUI-23 | Save / Export ist bei leerem Projekt bereits auf der Hauptleiste deaktiviert | GUI-Test grün | Abgesichert |
| RT-01 | Identität, Getter/Setter, Main, Reset, Input, veraltete Worker-Antworten bleiben korrekt | Bestehende Integrationstests | `test:runtime-state` |
| GUI-24 | Direkte Anweisungen in Projektdateien ergeben vor jeder Ausgabe einen Compilerfehler mit Dateiposition; auch Codepad kann den fehlgeschlagenen Compile nicht umgehen; direkte Codepad-Anweisungen bleiben erlaubt | GUI grün: echter Worker, Fehlerdialog mit Actions.kt/Zeile/Spalte, keine Terminalausgabe, Codepad nach Projektwechsel | Abgesichert in Chromium |
| GUI-25 | CodeMirror zeigt keine automatische Codevervollständigung und verwendet vier Leerzeichen für manuelle Einrückung; normale Editorfunktionen und Klammerergänzung bleiben erhalten | Chromium-Tests grün: 2/2; Typecheck grün | Abgesichert |
| GUI-26 | Cmd/Ctrl-Shift-I formatiert die komplette Kotlin-Datei mit dem lokal gebündelten ktfmt-WASM-Formatter im Hauptthread; komprimierte WASM-Auslieferung wird korrekt behandelt; normale Tab-/Shift-Tab-Einrückung bleibt separat | Chromium-Test grün: 2/2 für Ctrl und Cmd; Typecheck und Produktionsbuild grün | Abgesichert |
| GUI-27 | Kotlin-Editor bietet Maximieren, Schließen per `×` und einen Formatier-Button unten rechts mit Shortcut-Hinweis | Chromium-Test ergänzt; Formatieren, Maximieren und Schließen geprüft | Abgesichert |
| GUI-28 | Kotlin-Editor lässt sich wie das Terminal verschieben und an allen Seiten/Ecken in der Größe verändern; Codepad bleibt dabei sichtbar | Chromium-Test für Verschieben und Resize ergänzt | Abgesichert |
| GUI-29 | Kotlin-Editor verwendet die Terminal-Fensteroptik, zeigt Verschiebe-Cursor und hat keinen unnötigen Leerraum unter dem Editor | Chromium-Test für Stil, Cursor und unteren Abstand ergänzt | Abgesichert |
| GUI-30 | Editor und Terminal sind nicht modal; das zuletzt angeklickte Fenster liegt jeweils oben | Chromium-Test für Fensterfokus und aktiven Z-Index ergänzt | Abgesichert |
| GUI-31 | Pro Klasse bzw. Funktionsdatei kann ein eigenes Editorfenster geöffnet bleiben | Chromium-Test mit zwei gleichzeitig geöffneten Kotlin-Dateien ergänzt | Abgesichert |
| GUI-32 | Editor und Terminal verwenden identische Fenster-Buttons, gemeinsame Mindestgrößen und vollständig nutzbare Rahmenbereiche für Resize | Chromium-Test für Icons, 24-Pixel-Rahmenbereiche und Mindestgrößen ergänzt | Abgesichert |
| GUI-33 | Mehrere Editorfenster lassen sich zu einem Tab-Fenster sammeln, der aktive Tab ist durch seine mit dem Codefeld verbundene Hervorhebung eindeutig erkennbar, der vertikale Abstand unter den Fenster-Icons ist in beiden Modi gleich, Tabs lassen sich wechseln, über das Tab-Kreuz oder das X der Gruppe schließen und wieder in einzelne Fenster zerlegen | Chromium-Test für Sammeln, aktive Tab-Markierung, vertikalen Header-Abstand, Tabwechsel, Tab-Schließen, Gruppenschließen und Aufteilen ergänzt | Abgesichert |
| GUI-34 | Eine fehlgeschlagene Formatierung zeigt einen schließbaren Fehler ohne unnötigen Formatter-Paketpräfix; ein neuer Formatierungsversuch entfernt die alte Meldung vor dem erneuten Ergebnis | Chromium-Test für Fehler, Schließen und erneuten Versuch grün | Abgesichert |
| GUI-36 | Terminal-Splitter bleibt auf der Trennlinie zwischen BlueK und Terminal zentriert und verändert beim Ziehen beide Bereiche | Chromium-Test erweitert: Griffposition und Breitenänderung grün | Abgesichert |
| GUI-37 | Der Terminal-Splitter wird bei geöffnetem Editorfenster nicht über den Editorinhalt gezeichnet | Chromium-Test für aktives Editorfenster grün | Abgesichert |
| GUI-38 | Die Kotlin-Schrift im Editor ist auf 16 px eingestellt | GUI-Test grün | Abgesichert |
| GUI-39 | Die Editor-Schriftgröße lässt sich über Settings oben rechts von 10 px bis 30 px einstellen und wirkt sofort auf Code und Zeilennummern | GUI-Test erweitert und grün | Abgesichert |
| GUI-40 | Settings und New File liegen beim Öffnen über Editoren, Terminal und Objektinspektoren; der Dialog bietet zusätzlich Kotlin Functions an | Chromium-Test grün: Settings/New File, Kotlin-Functions-Option und kein New-Functions-Button | Abgesichert |
| GUI-41 | New Project, Open / Import, Save / Export und Files liegen beim Öffnen über Editoren, Terminal und Objektinspektoren | GUI-Test ergänzt | Abzusichern |
| GUI-42 | Escape schließt kein geöffnetes Editorfenster | GUI-Test grün | Abgesichert |
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
| GUI-51 | Eingebaute BluePlay-Karten sind von editierbaren Schülerdateien getrennt; API-Hilfe ist separat; die Welt wird als Canvas-2D-Frame mit Zellkoordinaten gerendert | `build:svelte`, typisierte Stage-Frames und native Smoke-Tests grün | Tatsächliche Chromium-Interaktion und visuelle Abnahme offen |
| GUI-52 | BluePlay-Welt ist ein gemeinsames Fenster mit zusammengehöriger Titelleiste, Canvas und Steuerleiste; Schließen entfernt das gesamte Fenster; Titelzeile lässt sich verschieben | Built-in-Browser: gemeinsamer Rahmen, Close, Drag und Maximize visuell geprüft | Chromium-Automatisierung ergänzt |
| GUI-53 | BluePlay-Canvas nimmt Welt- und Actor-Klicks an; bei Actors zählen unter Skalierung und Rotation nur sichtbare Pixel, nicht der transparente Bildhintergrund | Built-in-Browser: transparenter Pixel ergibt `false`, sichtbarer Pixel abseits der Mitte ergibt `true`; Chromium wiederholt beide echten Canvas-Klicks | Abgesichert |
| GUI-54 | Eine Welt ohne eigenes `background` wird als weiße Canvas ohne weißen Außenbereich direkt unter der Titelleiste dargestellt; der umgebende World-Body ist grau, eigene Welt-Hintergründe bleiben Zeicheninhalt der Welt | Chromium-GUI-Test prüft weiße Canvas, grauen World-Body und `padding: 0`; native Smoke deckt `Image`-/Hintergrund-Zeichenoperationen ab | Keine pixelgenaue visuelle Abnahme |
| GUI-55 | Eine kleine Welt (z. B. `100x100`) bleibt in ihrer echten Pixelgröße; reicht sie nicht bis zur Buttonleiste, zeigt der World-Body einen grauen Rand statt die Welt zu skalieren | Chromium-GUI-Test misst Canvas `100x100` und prüft den grauen Surround; eingebauter Browser visuell bestätigt | Abgesichert |
| GUI-56 | Das World-Fenster wächst bis knapp an die Browsergrenzen, damit eine große unvergrößerte Welt möglichst lange ohne Scrollen sichtbar bleibt | Chromium-GUI-Test misst eine `1000x100`-Canvas in Originalgröße und bestätigt, dass der World-Body noch nicht horizontal scrollt | Abgesichert |
| GUI-57 | Maximieren füllt den gesamten Browser-Viewport; die Welt bleibt dabei unskaliert, kleine Welten zeigen weiterhin den grauen Surround und das Spielfeld ist horizontal/vertikal symmetrisch zentriert | Chromium-GUI-Test prüft Fenster `0,0` bis `100vw,100vh`, unveränderte `100x100`-Canvas, grauen Body sowie gleiche linke/rechte und obere/untere Abstände | Abgesichert |
| GUI-58 | BluePlay-Bibliothekskarten (`BluePlayFunctions`, `World`, `Actor`, `Image`) erscheinen wie normale Karten ohne Built-in-Leiste, sind verschiebbar, bilden mit `Actor`-/`World`-Unterklassen die Vererbungspfeile und öffnen dateibezogene API-Hilfe; jede Karte und die zugehörigen Pfeile folgen beim Überlappen derselben Stapelordnung | Chromium-GUI-Test prüft normale Darstellung, Karten-Drag, zwei Pfeile (`Figure -> Actor`, `MyWorld -> World`), das Nach-vorne-Holen einer verschobenen Karte samt Vererbungspfeil, `World API` per Doppelklick und das eingeschränkte Actor-Kontextmenü | Abgesichert |
| GUI-59 | Neue Schülerklassen werden bei der Kartenpositionierung hinter den vier BluePlay-Bibliothekskarten berücksichtigt | Chromium-GUI-Test prüft die Position der ersten neu angelegten Klasse | Abgesichert |
| RT-11 | `Run` führt dauerhaft Schritte aus, fokussiert sofort die Spielfläche für Tastatursteuerung, `Pause` beendet den nächsten Scheduler-Schritt ohne zweiten Lauf; Speed bleibt während Run änderbar und plant den nächsten Schritt neu | Native Runtime-Smoke + Built-in-Browser mit laufendem `simulation=running`, fokussiertem Canvas, Pause und Slider-Drag | Abgesichert |
| RT-12 | `isTouching`/`intersects` verwenden sichtbare Alpha-Pixel mit Skalierung und Rotation; ein angeklickter Actor darf in `act()` sicher `world.removeObject(this)` ausführen | Native Browser-Smoke prüft getrennte Alpha-Flächen trotz überlappender Rechtecke, 180°-Rotation, sichtbare Überdeckung, Klick-ID außerhalb der Mittelpunktzelle und Selbstentfernung ohne Fault | Abgesichert; 100-Actor-Performance bleibt PERF-01 |
| PERF-01 | Scheduler, Frame-Abstände, Stop-Reaktion, Historien- und Ressourcenwachstum bei Referenzspielen und 100 Actoren sind messbar | Node-Benchmark prüft 180 komplette Schritte mit 1-Pixel-Bewegung, echte Laser und synchrone Invader. Chromium: Speed 95, Pfeil+Space für 4 s, 206 DOM-Frame-Updates, p95 26,7 ms, max. 30,2 ms. Gateway-Test: gleichzeitige Key-down/up ohne Busy-Phase oder alte Frames. Interpreter optimiert; Alpha-Kollisionen unverändert | Noch keine 60-Sekunden-/100-Actor-Messung und keine 60-FPS-Garantie; visuelle Benutzerabnahme offen |

## Letzter Prüflauf

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
