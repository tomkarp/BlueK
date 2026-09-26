# BluePlay in BlueK

BluePlay ist die Spielbibliothek aus dem inf-schule-Kurs „OOP mit Kotlin“
(dort für BlueJ/JVM). BlueK stellt eine Browserfassung mit derselben
Schüler-API bereit. Übergeordnete Architekturregeln stehen in
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
| Engine: Weltregister, Actor-IDs, Bewegung, Kollision, Klick- und Tastenzustand, Frame-Rendering, Sounds | native `bluek*`-Funktionen in `KotliteSession.kt` | als Kotlin/JS **kompiliert**, von der Bibliothek aufgerufen |

Weil die Klassen normaler Kotlite-Quelltext sind, funktionieren sie als
Oberklassen echter Schülerklassen, einschließlich Property-Zugriff,
überschriebenem `act()`, generischer Methoden (`getObjects<T>()`,
`getIntersecting<T>()`) und Metadaten. Es gibt keine Quelltext-RegEx für
Vererbung oder Typfilterung und keine zweite Typinformation.

Die Session ist die einzige Quelle von Welt-, Actor-, Bild- und
Kollisionszustand. `runtime-contract` transportiert einen typisierten
`BluePlayStage`-Frame und den Simulationszustand; Svelte leitet daraus
Canvas, Bibliothekskarten und API-Dokumentation ab. Medien bleiben
projektbezogene, validierte Data-URL-Ressourcen und werden nicht in die
Kotlin-Library kopiert.

## Scheduler

`RuntimeHost` besitzt den einzigen Scheduler: `step`, `start`, `stop`, `reset`
und `setSpeed` sind Runtime-Kommandos (`op: 'simulation'`). Ein Schritt ruft
`World.act()` und danach `act()` aller noch vorhandenen Actors der Welt auf.
Der nächste Schritt wird nach `max(1, 100 - speed - elapsed)` Millisekunden
geplant, wobei `elapsed` die Rechen- und Publikationszeit des letzten
Schritts ist. Überlange Schritte erzeugen keine Nachhol-Warteschlange; der
Client hält keinen zweiten Timer.

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
Ein normales `World.show()` setzt kein Stop-Signal; nur die fachliche
`stop()`-Aktion beendet den nächsten Lauf.

## Rendering und Weltfenster

Setter und Weltmethoden rendern nicht einzeln. Die Session erzeugt den Frame
bei `takeStage()`/`renderBluePlay()`; ein Schritt verwirft vorher gerenderte
Frames und unterdrückt Zwischenbilder. `bluePlayStage.ts` leitet daraus ab,
was der Canvas zeigt: Bildauflösung (`decorateStage`), Zeichnen und
pixelgenaue Klickziele (`StageRenderer`), Tastennamen (`stageKeyName`) sowie
Frame-Sounds und Beep (`StageAudio`). Es hält nur Bild-Cache und
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
äquivalente geometrische Maske. Für Klicks prüft der Browser die Actors in
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

Profiling des Space-Invaders-Beispiels zeigte nicht die Canvas-Zeichnung,
sondern Typauflösung und temporäre Symboltabellen im Interpreter als
Hauptkosten. Die Gegenmaßnahmen im Fork (siehe `PATCH.md`):

- Synthetische Receiver-/Iterator-Bindungen verwenden ihre vorhandenen
  `DataType`s, statt sie über `TypeNode`s erneut aufzulösen.
- Klassen ohne generische Vorfahren brauchen keine
  Generic-Substitutionstabellen.
- Selten benötigte Symboltabellen werden erst beim Schreiben angelegt;
  `by lazy` wird vermieden, weil Kotlin/JS bei jedem delegierten Zugriff eine
  Property-Referenz erzeugt.
- Es gibt keine prozessweite Typtabelle. `ClassDefinition` hält nur den
  `ObjectType` der eigenen nicht-generischen Hierarchie (per Identität
  revalidiert). Typen mit konkreten Argumenten wie `List<Invader>` liegen in
  der Root-Symboltabelle des jeweiligen Interpreters und behalten ihren
  `ClassMemberResolver`; Reset und Compile beginnen daher mit leerem Cache.
  Typen mit Typparametern werden weiterhin pro Aufruf aufgelöst.

Auf BlueK-Seite:

- Die Bibliothek kopiert Objektlisten mit `toList()` statt über
  interpretierte Lambdas und führt `isTouching(other)` direkt zur nativen
  Kollisionsprüfung.
- Der Scheduler überspringt `act()` mit leerem Rumpf (etwa die geerbte
  Default-Methode), ohne beobachtbaren Unterschied.
- Automatische Ticks verzichten auf vollständige Inspektionen; Terminal-
  Ausgabe wird gebündelt (siehe architecture.md).

`node scripts/benchmark-blueplay.mjs` misst Tick und zusätzliche
Frame-Publikation, mit 1-Pixel-Bewegung und mit/ohne Dauerschießen. Der
Chromium-Test PERF-01 misst vier Sekunden lang Frame-Ankünfte bei Speed 95.
Das ist keine Garantie für 60 präsentierte Bilder/s auf jedem Gerät; eine
60-Sekunden-/100-Actor-Messung steht aus.

Mögliche weitere Umbauten, noch nicht umgesetzt: vorbereitete
Aufruf-/Typsignaturen pro Generation (braucht saubere Grenzen für lokale
Typen/Generics), native BluePlay-Methoden statt interpretierter Wrapper (darf
Overrides und Identität nicht umgehen) und ein Frame-Transport ohne
IDE-Metadaten. Ein anderer Renderer oder ein zweiter Scheduler behebt den
gemessenen Interpreter-Engpass nicht. Kollisionsprüfungen werden nie
übersprungen.

## API

| Einheit | Öffentliche Oberfläche | Nachweis |
| --- | --- | --- |
| `World` | `World(width, height, cellSize = 1)`, `background: Image`, `show`, `act`, `addObject`, `removeObject`, `allObjects`, `getObjects<T>`, `getObjectsAt`, `numberOfObjects`, `isClicked`, `setBackground(fileName)`, `setBackground(r, g, b)`, `showText` | `smoke-blueplay-browser.mjs`: Unterklassen, World-Callback, Objektlebensdauer, Text-/Bild-Frames |
| `Actor` | `x`, `y`, `rotation`, `image: Image?`, `world`, `act`, `setImage`, `getImage`, `setLocation`, `getX`, `getY`, `setRotation`, `getRotation`, `move`, `turn`, `turnTowards`, `distanceTo`, `intersects`, `isTouching(other)`, `isTouching<T>()`, `getIntersecting<T>`, `getOneIntersecting<T>`, `removeTouching<T>`, `isAtEdge`, `isClicked` | dynamischer `act`-Aufruf, Reified-Suche, Eingabe und Identität im Browser-Smoke |
| `Image` | `Image(width, height)`, `Image(fileName)`, `Image(other)`, `width`, `height`, `path`, `transparency`, `setColor`, `fill`, `fillRect`, `drawRect`, `fillOval`, `drawOval`, `drawLine`, `drawString`, `drawImage`, `clear`, `scale`, `setTransparency` | Kopie/geteilte Instanz, Zeichenoperationen, Skalierung, Transparenz, Canvas-Frame |
| Funktionen | `activeWorld`, `showWorld`, `show`, `isKeyDown`, `start`, `stop`, `step`, `getSpeed`, `setSpeed`, `playSound` | native Bridge, Input-/Sound-Effekt, Scheduler- und Reset-Smokes |

`move(distance)` unterstützt beliebige Winkel und rundet auf ganze Zellen;
Koordinaten-Setter klemmen an den Weltrand. Die Matrix beschreibt die
vorhandene Oberfläche, keine Zusage für JVM-Interna wie `awtImage`,
`java.awt.Color` oder Dateizugriffe.
