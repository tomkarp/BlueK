# BluePlay in BlueK

BluePlay ist die Spielbibliothek aus dem inf-schule-Kurs „OOP mit Kotlin“
(dort für BlueJ/JVM). BlueK stellt eine Browserfassung bereit, die sich an
der Original-Schüler-API orientiert. Maßstab ist das BlueJ-Projekt auf GitHub,
Stand `c8ace580f0506571fc34f287280a3e04eba7c876`, nicht der Browseradapter.
Der [API-Abgleich vom 30. September 2026](blueplay-api-audit.md) dokumentiert
Ausgangsfehler und ihre Korrektur. Übergeordnete Architekturregeln stehen in
[architecture.md](architecture.md).

## Aufbau

BluePlay ist eine versionierte Projekt-Library (`{ id: "blueplay", version: 1 }`)
und kein Satz editierbarer Framework-Dateien. Fremde oder fehlende
Library-Versionen weist das Projektformat ab. Alte Projekte dürfen die
historischen Framework-Dateien noch enthalten; Projekt- und BlueJ-Import
filtern sie bei ausgewiesener Library heraus.

Die Bibliothek besteht aus zwei Schichten:

| Schicht | Ort | Ausführung |
| --- | --- | --- |
| Öffentliche Klassen `Image`, `World`, `Actor` und die Top-Level-Funktionen | `kotlite-browser/.../BluePlayLibrary.kt` (Kotlin-Quelltext als String) | wird beim Compile vor die Schülerdateien gesetzt und **von Kotlite interpretiert** |
| Engine: Weltregister, Actor-IDs, Bewegung, Kollision, Klick- und Tastenzustand, Simulationsschritt, Frame-Rendering, Sounds | `BluePlayEngine.kt` (native `bluek*`-Funktionen) und `BluePlayDrawing.kt` (Pixelgeometrie der Bilder) | als Kotlin/JS **kompiliert**, von der Bibliothek aufgerufen |

Weil die Klassen normaler Kotlite-Quelltext sind, funktionieren sie als
Oberklassen echter Schülerklassen, einschließlich Property-Zugriff,
überschriebenem `act()`, generischer Methoden (`getObjects<T>()`,
`getIntersecting<T>()`) und Metadaten. Es gibt keine Quelltext-RegEx für
Vererbung oder Typfilterung und keine zweite Typinformation.

Ein `Actor` darf vor `addObject` und nach `removeObject` ohne Welt existieren.
`world: World` wirft dann `IllegalStateException`, statt `null` zu liefern.
So benötigen Schüler beim gewöhnlichen Weltzugriff keine Nullbehandlung.
Weltabhängige Properties (`isAtEdge`,
`isClicked`) und Kollisionsabfragen einschließlich `removeTouching` verlangen
eine Welt; die nativen Funktionen werfen sonst dieselbe `IllegalStateException`
wie `world`. `intersects` verlangt eine Welt für beide Actors. Bewegung, Rotation und
Bildänderungen benötigen dagegen keine Welt. Eine unbehandelte Ausnahme im
Schülerprogramm beendet die Ausführung und versetzt die Laufzeit in `faulted`;
der Objektinspektor fängt gewöhnliche Exceptions je Property und zeigt sie
in deren Zeile. Der Typ von `world` entspricht der gepinnten BlueJ-Referenz;
weltabhängige Zugriffe werfen statt stiller Ersatzwerte. Die Fehlerbehandlung des Inspektors ist in
[architecture.md](architecture.md#inspektor) beschrieben.

Die Engine der Session (`BluePlayEngine`) ist die einzige Quelle von Welt-,
Actor-, Bild- und Kollisionszustand. Insbesondere hält nur sie, welche Actors
eine Welt in welcher Reihenfolge enthält; `World` hat keine eigene Liste.
`allObjects()`, `getObjects<T>()`, `getObjectsAt()` und `numberOfObjects`
fragen die Engine, Typfilter verwenden das reifizierte `T` des Aufrufs.
Objekte erkennt die Engine an der gemeinsamen Wurzel ihrer
Vererbungsteile, also an ihrer Identität und nie an einem Schüler-`equals`.
Für die Erreichbarkeit von Objekt-Handles meldet sie die Actors einer Welt
(`reachableRuntimeValues(..., hostRetained)`), als wären sie ein Feld der
Welt. `runtime-contract` transportiert einen typisierten
`BluePlayStage`-Frame und den Simulationszustand; Svelte leitet daraus
Canvas und Bibliothekskarten ab. Die API-Dokumentation verwendet das beim
Interpreter-Build erzeugte, unveränderliche Library-Manifest
(`build-blueplay-api.mjs` → `bluePlayApi.generated.json`). Nur kurze
Erklärungen werden in `bluePlayApi.ts` gepflegt; Signaturen, Typen,
Parameternamen und Typschranken kommen aus Kotlite. Die Hilfe führt keinen
Schülercode aus und enthält weder Beispiele noch GitHub-Links. Medien bleiben
projektbezogene, validierte Data-URL-Ressourcen und werden nicht in die
Kotlin-Library kopiert.

## Scheduler

`RuntimeHost` besitzt den einzigen Scheduler: `step`, `start`, `stop`, `reset`
und `setSpeed` sind Runtime-Kommandos (`op: 'simulation'`). Ein Schritt ruft
`World.act()` und danach `act()` aller noch vorhandenen Actors der Welt auf.
Der nächste Schritt wird nach `max(1, 100 - speed - elapsed)` Millisekunden
geplant, wobei `elapsed` die Rechen- und Publikationszeit des letzten
Schritts ist. Überlange Schritte erzeugen keine Nachhol-Warteschlange; der
Client hält keinen zweiten Timer. Das Warten ist genau
(`simulationTimer.ts`): Browser-Timer feuern verspätet und verschachtelt nie
vor 4 ms. Ein Schritt wartet deshalb den Großteil mit einem Timer und die
letzten 4 ms in Event-Loop-Aufgaben (Message-Channel), zwischen denen Tasten
und Pause weiter ankommen. So bleibt ein Spiel bei jeder Geschwindigkeit
gleich schnell, ob mit wenigen oder vielen Actors, solange die Schritte in
das Intervall passen. Speed 96–100 erreicht so tatsächlich bis zu 1000
Schritte/s (leeres Space Invaders: gut 800) statt der vorher gemessenen gut
150.

Ein Schritt eines laufenden Spiels veröffentlicht keinen vollständigen
Snapshot, sondern ein `frame`-Ereignis (`SimulationFrame`: Revision, Phase,
Simulationszustand, Fehler, Bühne, dazu Ausgabe und Effekte); der Client
übernimmt es in seinen Snapshot, Klassenmetadaten und Referenzen behalten ihre
Identität. Gerendert und gesendet wird höchstens alle 10 ms, also öfter, als
ein 60-Hz-Bildschirm Bilder zeigt; Schritte dazwischen werden gerechnet, aber
nicht gezeichnet, ihre Ausgabe, Sounds und Effekte trägt das nächste Bild.
Endet Run in einem Schritt (`stop()`, Fehler), folgt ein vollständiger
Snapshot mit Inspektionen.

Während eines laufenden Schritts bleiben Tastatur- und Mausereignisse
zulässig; Codepad- und Objektoperationen werden bis zum Pause-Zustand
abgewiesen. Tastatur und Maus sind Zustandsänderungen, keine
Code-Ausführungen: Ihre Bestätigungen setzen die Phase nicht auf `running` und
veröffentlichen keinen alten Frame erneut.

**Reset** ist im Pause-Zustand verfügbar. Nach der gegebenenfalls nötigen
Dateiauswahl stoppt der Host den Scheduler und ruft die gewählte parameterlose
`main()` direkt in derselben Session auf (`startBluePlayMain`, aufgelöst über
die interne Namenszuordnung). Top-Level-Initialisierer laufen nicht erneut.
Die Ausführung meldet ihre Phase und kann interaktive Eingabe anfordern.
Wie im BlueJ-Projekt pausiert ein explizites `World.show()` die Simulation.
Reines Frame-Rendering sendet kein Stop-Signal (RT-11). `step()` wird während
Run ignoriert; die Session liest dafür über eine schmale Abfrage den Zustand
des autoritativen Host-Schedulers und hält keine zweite Zustandskopie.

## Rendering und Weltfenster

Setter und Weltmethoden rendern nicht einzeln. Die Session erzeugt den Frame
bei `takeStage()`/`renderBluePlay()`; ein Schritt verwirft vorher gerenderte
Frames und unterdrückt Zwischenbilder. Ein Frame (`BluePlayStage`) listet jedes
verschiedene Bild einmal (`images`); Actors verweisen per Index darauf, denn
viele Actors sehen gleich aus (alle Laser). Die Engine erzeugt die
Bildbeschreibung je `Image` nur nach einer Änderung neu. `bluePlayStage.ts`
leitet aus dem Frame ab, was der Canvas zeigt: Bildauflösung je
verschiedenem Bild (`decorateStage`, Data-URLs nach Inhalt zwischengespeichert),
Zeichnen und
pixelgenaue Klickziele (`StageRenderer`), Tastennamen (`stageKeyName`) sowie
Frame-Sounds und Beep (`StageAudio`). Es hält nur begrenzte Bild-Caches und
Alpha-Masken, keinen Weltzustand; die IDE behält Zeichentakt, Fokus,
gedrückte Tasten und Client-Zugriff. Der Canvas wird höchstens einmal pro
Bildschirm-Frame (`requestAnimationFrame`) gezeichnet. Nicht geladene Bilder
erhalten einen deterministischen, vollständig treffbaren Platzhalter.

Die Welt ist ein BlueJ-artiges Fenster aus Titelleiste, Canvas und
Steuerleiste (Act, Run/Pause, Reset, Speed). Die Titelleiste verschiebt das
ganze Fenster; alle Steuerungen verwenden ausschließlich den
Worker-Scheduler. Die Canvas-Größe ist immer `width * cellSize` mal
`height * cellSize`; die Welt wird nicht automatisch skaliert. Der Body ist
scrollbar, zentriert die Canvas und zeigt bei kleinen Welten einen grauen
Rand. Seine Breite wächst mit Welt und Steuerleiste bis knapp an die
Browsergrenzen. Maximieren füllt den Viewport (`100vw`/`100vh`), ohne die
Canvas zu skalieren.

Die vier Bibliothekselemente erscheinen als virtuelle Karten. Sie sind keine
Schülerdateien, nehmen aber an Dragging, Vererbungsdarstellung und der
Positionierung neuer Klassen teil. Doppelklick und Kontextmenü öffnen nur die
API-Dokumentation.

## Kollision und Klicks

Bildressourcen werden vor dem Compile einmal im Browser dekodiert
(`imageAlpha.ts`). Nur Breite, Höhe und Alpha-Maske gelangen als flüchtige
Runtime-Metadaten in den Worker; Export und Autosave enthalten weiterhin nur
Pfad und Data-URL. Der Runtime werden alle bekannten Ressourcenpfade gemeldet,
auch solche ohne Maske, damit sie einen Tippfehler von einer vorhandenen Datei
unterscheiden kann.

`intersects`/`isTouching` verwenden nach einem gedrehten AABB-Schnelltest
dieselbe Weltpixel-Geometrie, inverse Rotation, Skalierung und den
Alpha-Schwellwert `> 16`. Transparente PNG-Bereiche lösen weder Klicks noch
Kollisionen aus; einfache `Image`-Zeichenoperationen verwenden eine
äquivalente geometrische Maske. `getIntersecting<T>()`, `getOneIntersecting<T>()`,
`isTouching<T>()` und `removeTouching<T>()` sind je ein nativer Aufruf. Die
Engine hält die Actors einer Welt zusätzlich nach Laufzeitklasse gruppiert,
jede Gruppe in der Reihenfolge der Welt; eine Abfrage prüft `T` einmal je
Gruppe, besucht nur passende Gruppen und liefert die Treffer wieder in der
Reihenfolge der Welt (ebenso `getObjects<T>()` und `getObjectsAt()`). So kostet
die Suche nach den 32 Invadern nicht mehr Zeit, wenn hunderte Schüsse in der
Welt sind. Die
Geometrie eines Actors (Mittelpunkt, Drehung, Grenzen, Bildversion) bleibt
gespeichert, solange seine Feldwerte und sein Bild unverändert sind; die
Zeichenoperationen eines Bildes werden einmal je Version zerlegt. Ungedreht
liegen die geprüften Punkte eines Actors auf einem festen Halbpixel-Raster;
deren Sichtbarkeit wird je Bildversion einmal berechnet
(`BluePlayEngine.ImageModel.visibleAt`), mit demselben Ergebnis wie die
Prüfung Pixel für Pixel. Für Klicks prüft der Browser die Actors in
umgekehrter Zeichenreihenfolge, rechnet Pointerkoordinaten aus den
tatsächlichen Canvas-Grenzen und `cellSize` in Weltkoordinaten um und übergibt
die stabile Treffer-ID nur bei einem sichtbaren Pixel.

Actor-IDs hängen an der gemeinsamen Wurzel der `parentInstance`-Kette von
Kotlites Vererbungsteilen und werden freigegeben, wenn ein Actor keine Welt
mehr hat. Dadurch kann ein Actor in seinem eigenen `act()` sicher
`world.removeObject(this)` ausführen.

## Ressourcen und Standardgrafiken

Die mitgelieferten Standardgrafiken (`assets/standard-images/`, z. B.
`duck.png`, `cat.png`, `pizza.png`) sind gewöhnliche Ressourcen, die nicht zum
Projekt gehören: `withStandardImages` stellt sie den Projektressourcen voran,
eine gleichnamige Projektressource gewinnt. Sie liegen samt Pixelmaske im
Bundle (`frontend/src/standardImages.generated.ts`), damit Rendern, Compile
und Kollision ohne Netzwerk und ohne Dekodierung auskommen. Gespeichert,
exportiert oder im Dateidialog gelistet werden nur Projektressourcen.

Eine Grafik, die weder im Projekt noch unter den Standardgrafiken existiert,
ergibt wie in BluePlay einen Laufzeitfehler
(`Image file not found: duckk.png (expected e.g. in the folder 'images/')`).
`playSound` spielt Projekt-Sounds über den Frame-Transport ab. Eigene Bilder
und Sounds lassen sich in der Oberfläche derzeit nicht hinzufügen (Import über
BlueJ-Projekt oder Projekt-JSON).

## Performance

Maßstab ist ein Spiel mit vielen Actors bei hoher Geschwindigkeit, etwa
Space Invaders mit vielen Schüssen, die je Schritt `getOneIntersecting<Invader>()`
aufrufen. Ursprünglich kostete jeder solche Schuss etwa 0,8 ms je Schritt
(ein interpretiertes `filter`-Lambda je Invader), und jeder Schritt sendete den
vollständigen Snapshot. Gemessen mit `node scripts/benchmark-blueplay.mjs`
(Node, Space Invaders plus Schüsse, Mittel je Schritt):

| Schüsse | vorher | jetzt |
| --- | --- | --- |
| 0 | 0,9 ms | 0,3 ms |
| 100 | 81 ms | 1,9 ms |
| 200 | 165 ms | 3,7 ms |
| 400 | – | 7,2 ms |

In Chromium (IDE, Speed 90 = 100 Schritte/s) hält die Welt mit 400 Schüssen
noch etwa 98 Schritte/s; vorher sank sie schon bei 50 Schüssen auf etwa 23.
Bei Speed 80 bleiben es bis 400 Schüsse 50 Schritte/s. Die Maßnahmen:

- Engine: natives, identitätsbasiertes Welt- und Actor-Register statt
  Listen-Scans; Kollisionsabfragen nativ über die Klassengruppen der Welt,
  mit gespeicherter Geometrie und Sichtbarkeitsrastern (siehe oben); Felder der
  Actors und Bilder werden über einmal aufgelöste Speicherplätze gelesen.
- Interpreter (siehe `PATCH.md`): kleine lineare Symboltabellen statt
  Hash-Maps (Kotlin/JS hasht Strings bei jedem Zugriff), eine
  Receiver-Bindung je Methodenaufruf statt einer Bindung je Name, schlanke
  Aufrufe nativer Funktionen, je Klasse gemerkte Member-Zugriffe an den
  AST-Knoten, Blöcke ohne Deklarationen ohne eigenen Scope, Typprüfungen ohne
  Allokation und nur einmal erzeugte Typen. Ein Methodenaufruf kostet etwa
  4 µs statt 10 µs, ein Durchlauf einer `while`-Schleife etwa 2 µs statt 17 µs.
- Schleifen geben nach einem Zeitbudget (10 ms) statt nach 128 Durchläufen an
  den Worker ab, über einen Message-Channel statt eines verschachtelten Timers
  (mindestens 4 ms Pause im Browser). Die Prüfung je Durchlauf ist eine
  synchrone Abfrage ohne Coroutine.
- Scheduler und Transport: genaues Warten (siehe Scheduler), schlanke
  `frame`-Ereignisse höchstens alle 10 ms, jedes Bild einmal je Frame,
  Bilddarstellung je Inhalt zwischengespeichert; die Weltansicht dekoriert
  einen Frame nur noch einmal.
- Der Scheduler überspringt `act()` mit leerem Rumpf (etwa die geerbte
  Default-Methode), ohne beobachtbaren Unterschied.

Der Chromium-Test PERF-01 misst vier Sekunden lang Frame-Ankünfte bei Speed 95,
PERF-03 die `frame`-Ereignisse. Den verbleibenden Großteil eines
Methodenaufrufs kosten die Zustandsautomaten der `suspend`-Auswertung (etwa
40 % eines leeren Aufrufs); sie zu vermeiden hieße, die Auswertung von
Ausdrücken grundlegend umzubauen. Kollisionsprüfungen werden nie übersprungen.

## API der Browserfassung

Öffentliche Signaturen werden unabhängig gegen die originalen Frameworkdateien
und die Schüler-API in `tests/fixtures/blueplay-reference/` geprüft. Die
unveränderten Schülerdateien des BlueJ-Projekts laufen mit der Library.

| Einheit | Öffentliche Oberfläche | Nachweis |
| --- | --- | --- |
| `World` | `World(width: Int, height: Int, cellSize: Int)`, `width`, `height`, `cellSize`, `background: Image`, `show`, `act`, `addObject(Actor, x, y)`, `removeObject(Actor)`, `allObjects(): List<Actor>`, `getObjects<T : Actor>()`, `getObjectsAt(): List<Actor>`, `numberOfObjects`, `isClicked`, beide `setBackground`-Varianten, `showText` | `test:blueplay-api`, `smoke-blueplay-browser` |
| `Actor` | `Actor()`, `x`, `y`, `rotation`, `image: Image?`, `world`, `act`, `move`, `turn`, `turnTowards`, `distanceTo`, `intersects`, `isTouching<T>()`, `getIntersecting<T>`, `getOneIntersecting<T>`, `removeTouching<T>`, `isAtEdge`, `isClicked` | `test:blueplay-api`, typisierte Kollisions-/Klicktests |
| `Image` | `Image(width: Int, height: Int)`, `Image(fileName: String)`, `Image(other: Image)`, `width`, `height`, `setColor`, `fill`, `fillRect`, `drawRect`, `fillOval`, `drawOval`, `drawLine`, `drawString`, `drawImage`, `clear`, `scale`, `setTransparency` | drei echte Konstruktoren, Kopien, Ressourcen, Zeichenoperationen, Skalierung und Transparenz |
| Funktionen | `isKeyDown`, `start`, `stop`, `step`, `getSpeed`, `setSpeed`, `playSound` | Scheduler-, Input-, Reset- und Player-Tests |

`move(distance)` unterstützt beliebige Winkel und rundet auf ganze Zellen;
Koordinaten-Setter klemmen an den Weltrand. `turnTowards` zum eigenen Standort
behält die Rotation. Bildgrößen werden wie im Original auf mindestens einen
Pixel begrenzt. `drawImage` kopiert Inhalt und Transparenz im Aufrufzeitpunkt;
`scale` skaliert den vorhandenen Inhalt, statt nur die Zeichenfläche zu ändern.
Geladene Ressourcen und zusätzliche Zeichenoperationen werden gemeinsam
gerendert. Auch Hintergründe behalten Größe und Transparenz. Private
Engine-Felder und Hilfsmethoden erscheinen weder in der Hilfe noch im
Library-Manifest oder passiven Inspektor.

JVM-/AWT-Interna wie `awtImage`, `java.awt.Color` und Dateizugriffe gehören nicht
zur Browser-API. Schriftmetriken und Kantenglättung im Browser sind keine
pixelidentische AWT-Nachbildung; Textkollisionen verwenden weiterhin eine
geometrische Näherung.
