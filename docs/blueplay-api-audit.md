# Abgleich der BluePlay-API

Geprüft am 30. September, korrigiert am 30. September / 1. Oktober 2026. Die folgenden Auditabschnitte
halten den Ausgangsstand fest: Anzeige, Beispiele und Browser-Library hatten
API-Abweichungen. Die Korrektur und ihre Nachweise stehen am Ende.

## Verbindliche Referenz

Maßstab ist ausschließlich das BlueJ-Projekt auf GitHub samt seiner
Schüler-API-Dokumentation. Die interne BlueK-Implementierung ist der
Prüfgegenstand, keine Referenz und keine Begründung für zusätzliche API.

Der Abgleich verwendet den heruntergeladenen GitHub-Stand
[`c8ace580f0506571fc34f287280a3e04eba7c876`](https://github.com/tomkarp/BluePlay/tree/c8ace580f0506571fc34f287280a3e04eba7c876):

- [API-Dokumentation](https://github.com/tomkarp/BluePlay/blob/c8ace580f0506571fc34f287280a3e04eba7c876/docs/README.md)
- [World.kt](https://github.com/tomkarp/BluePlay/blob/c8ace580f0506571fc34f287280a3e04eba7c876/World.kt),
  [Actor.kt](https://github.com/tomkarp/BluePlay/blob/c8ace580f0506571fc34f287280a3e04eba7c876/Actor.kt),
  [Image.kt](https://github.com/tomkarp/BluePlay/blob/c8ace580f0506571fc34f287280a3e04eba7c876/Image.kt),
  [BluePlayFunctions.kt](https://github.com/tomkarp/BluePlay/blob/c8ace580f0506571fc34f287280a3e04eba7c876/BluePlayFunctions.kt)
- Das BlueJ-Projekt im selben Repository: `package.bluej`, `Main.kt`,
  `MyWorld.kt`, `Figure.kt`, `images/` und `sounds/`.

`examples/blueplay/` in BlueK enthielt beim Audit veränderte Browserdateien und
ist deshalb keine unabhängige Referenz für das Original. Ein grüner Test
dieser Dateien belegt keine API-Konformität.

## Fehler der Anzeige (GUI-91)

Die Liste in `frontend/src/SvelteApp.svelte` (`bluePlayApiDocs`) wird von Hand
gepflegt. Sie stammt weder aus der Originaldokumentation noch aus dem
Runtime-Manifest. Sie zeigt zwei Spalten mit Signaturen, aber keine Erklärung,
keine Trennung von Attributen/Konstruktoren/Methoden, keine Beispiele und
keinen Link zum Referenzstand.

| Karte | Fehlende Original-API | Zusätzliche oder abweichende Anzeige |
| --- | --- | --- |
| World | `show()`, `isClicked`, `allObjects()`, beide `setBackground`-Varianten | `cellSize = 1` ist eine BlueK-Erweiterung; im Original ist das dritte Argument Pflicht. `getObjectsAt(): List<Actor>` wird angezeigt, aber von BlueK nicht eingehalten. |
| Actor | `Actor()`, `world`, `distanceTo`, `intersects`, `getIntersecting<T>`, `getOneIntersecting<T>`, `isTouching<T>()`, `removeTouching<T>()` | Beide `setImage`-Varianten und `isTouching(actor)` existieren nicht als Funktionen der Original-Schüler-API. |
| Image | `Image(other: Image)`, `fillOval` | Abweichende Parameternamen bei Farbe und Rechteck/Oval; die angezeigten Konstruktoren und `scale(width, height)` sind mit benannten Argumenten nicht aufrufbar. |
| BluePlayFunctions | Keine der sieben dokumentierten Funktionen fehlt. | `showWorld(world)` ist im Original `internal`, das globale `show()` existiert dort nicht. Beides wird in BlueK als Schüler-API angezeigt. |

Eine Ungenauigkeit liegt bereits in der Originaldokumentation: Die Tabelle
nennt `Actor.image: Image`, der tatsächliche BlueJ-Quelltext deklariert
`var image: Image? = null`. Die Nullable-Angabe in BlueK ist daher richtig.
Ebenso sind `Image.color`, `awtImage`, `transparency` und `overlaps` im
Original ausdrücklich aus der Schüleroberfläche ausgeblendet oder intern.

## Fehler und Erweiterungen der Laufzeit (RT-47)

Die folgenden Ergebnisse wurden mit dem eingecheckten
`frontend/public/kotlite/bluek-kotlite-browser.js` geprüft, mit aktiver
Library `blueplay` v1 und frischer Session pro Einzelprobe.
BlueK-Ausgangsstand: `21bc5cc`; SHA-256 des geprüften Bundles:
`3d53458154591b5e013252523c8b3ca1bf63bed5be11aeb3ec00f71425f3fab0`.

| Probe | Originalvertrag | Beobachtung in BlueK |
| --- | --- | --- |
| `val actors: List<Actor> = World(10, 10, 1).allObjects()` | Kompiliert; Liste enthält Actors. | Compilefehler: tatsächlich `List<Any>`. |
| Dieselbe Zuweisung mit `getObjectsAt(0, 0)` | Kompiliert. | Derselbe Typfehler. |
| `fun readX(w: World): Int = w.allObjects().first().x` | Kompiliert. | Compilefehler: `x` unbekannt für `Any`. |
| `fun invalid(w: World) { w.addObject(7, 0, 0) }` | Compilefehler: `Actor` verlangt. | Deklaration akzeptiert, da `addObject` `Any` annimmt; der fehlerhafte Aufruf wurde nicht ausgeführt. Auch `removeObject` ist im Adapter als `Any` deklariert. |
| `World(10, 10, 1).getObjects<String>()` | Compilefehler: `T : Actor`. | Akzeptiert; leere Liste. Die Typschranke fehlt. |
| `Image(width = 10, height = 10)` | Gültiger Konstruktor. | Compilefehler; tatsächliche Parameter heißen `seed` und `dimension`. |
| `Image(fileName = "figure.png")` | Gültiger Konstruktor. | Compilefehler. |
| `Image(other = Image(10, 10))` | Gültiger Kopierkonstruktor. | Compilefehler. |
| `Image(10, 10).setColor(r = 255, g = 0, b = 0)` | Gültiger Methodenaufruf. | Compilefehler; Parameter heißen `red`, `green`, `blue`. Dasselbe Namensproblem besteht laut Quelltext bei `World.setBackground`. |
| `Image(10, 10).fillRect(x = 0, y = 0, w = 5, h = 5)` | Gültiger Methodenaufruf. | Compilefehler; Parameter heißen `width`, `height`. Dasselbe Namensproblem besteht laut Quelltext bei den übrigen Rechteck-/Ovalmethoden. |
| `Image(10, 10).scale(width = 20, height = 20)` | Gültiger Methodenaufruf. | Compilefehler; Parameter heißen `newWidth`, `newHeight`, trotz anderslautender API-Anzeige. |
| `Actor().turnTowards(x = 5, y = 5)` | Gültiger Methodenaufruf. | Compilefehler; Parameter heißen `targetX`, `targetY`, trotz anderslautender API-Anzeige. |
| `Image(true).width` | Kein passender Konstruktor. | Akzeptiert, Ergebnis `30`; `Any?` ist zu weit. |
| `Image(0, -2)` | Original klemmt beide Dimensionen auf mindestens `1`. | Properties melden `width = 0`, `height = -2`. |
| Actor steht bei `(0, 0)`, `rotation = 90`, dann `turnTowards(0, 0)` | Original behält die Richtung bei. | BlueK setzt `rotation` auf `0`. |

Weitere öffentliche BlueK-Zusätze ohne entsprechende Originalfunktionen:
`Actor.setLocation`, `getX`, `getY`, `getRotation`, `setRotation`, `getImage`,
`setImage`, `isTouching(other)`; `Image()`; `activeWorld()` und globales
`show()`. Die Kotlin-Properties des Originals sind keine in Kotlin
aufrufbaren Funktionen `getX()` oder `setImage(...)`, auch wenn JVM-Bytecode
entsprechende Accessoren enthält.

Engine-Details sind im Browseradapter ebenfalls öffentlich: bei Actor
`worldWidth`, `worldHeight`, `worldCellSize`; bei World `backgroundPath`,
`backgroundColor`, `running`, `speed`, `tick`; bei Image `path`,
`transparency`, `drawingJson`. Sie gehören nicht zur Original-Schüler-API.
Das ist im Adapterquelltext sichtbar; die konkreten Inspektor-/Menüansichten
wurden in diesem Audit nicht im Browser geprüft.

Eine zusätzliche Frame-Probe zeigt einen Image-Verhaltensfehler:
`dest.drawImage(Image("figure.png"), 0, 0)` überträgt nur die leeren
Zeichenoperationen und Größe des geladenen Bildes, aber keinen Ressourcenpfad.
Auch die vorher gesetzte Transparenz des Quellbildes (`128`) fehlt im
eingebetteten Payload. Der Renderer kann diese Angaben daraus nicht
rekonstruieren. Der Frame wurde geprüft; die sichtbare Canvas-Auswirkung
wurde hier nicht durch einen echten Browsertest verifiziert.

## Von BlueK verwendeter Beispielcode

Die Beanstandung trifft die ausgelieferten Beispiele konkret:

| Ort | Nicht zur Original-API gehörende Aufrufe | Originalkonforme Form |
| --- | --- | --- |
| `examples/blueplay/Figure.kt` und `frontend/public/examples/blueplay.bluek.json` | `setImage("figure.png")` | `image = Image("figure.png")` |
| `examples/blueplay/Main.kt` und BluePlay-Example-JSON | `showWorld(world)` | `world.show()` |
| `frontend/public/examples/space-invaders.bluek.json`, Invader/Laser/Defender | `Image()` mit anschließendem `scale`, `setImage(sprite)`, `setLocation(...)` | Gleich `Image(width, height)` erstellen; `image = sprite`; `x` und/oder `y` zuweisen. |
| Space-Invaders-`Main.kt` | `showWorld(spaceWorld)` | `spaceWorld.show()` |

Auch `scripts/smoke-blueplay-browser.mjs` prüft an mehreren Stellen diese
erweiterte Browser-API. Das erklärt, warum erfolgreiche Smokes die
Abweichungen bisher nicht aufgezeigt haben.

## Tatsächlich ausgeführte Prüfung

- 20 einzelne Node/VM-Proben gegen das echte Bundle: zehn Compilefehler
  bei originalgültigen Aufrufen (drei Listen-/Memberfälle, sieben Fälle mit
  benannten Argumenten); zehn akzeptierte Proben, darunter unerwünschte
  Erweiterungen und die beschriebenen Verhaltensabweichungen.
- `Figure.kt`, `MyWorld.kt` und `Main.kt` unverändert aus dem referenzierten
  GitHub-BlueJ-Projekt mit der eingebauten Browser-Library geladen und
  `main()` ausgeführt: erfolgreich, Actor bei `(100, 200)`.
- Originalkonforme Property-Nutzung, `World.show()` und
  `getObjects<Actor>()`: erfolgreich; beobachteter x-Wert `3`.
- Eine zusätzliche native Frame-Probe für `drawImage` mit geladenem Bild
  und Transparenz: die beschriebenen Angaben fehlen.
- Keine JVM-Ausführung des BlueJ-Projekts, keine neuen GUI-Tests und keine
  visuelle Abnahme. Das JVM-Verhalten wurde aus dem Originalquelltext
  abgeleitet. Dies war der Prüfstand vor der Korrektur.

## Umgesetzte Korrektur

Die Hilfe zeigt Konstruktoren, Properties (`val`/`var`) und Methoden mit
kurzen Erklärungen, ohne Beispiele oder GitHub-Links. Die Signaturen stammen
aus dem tatsächlich gebauten Kotlite-Manifest. Das Manifest wird beim
Interpreter-Build generiert und unabhängig mit den Originalsignaturen
verglichen. Die drei Image-Konstruktoren sind echte, typisierte Überladungen.
Listen, Actor-Parameter, Typschranken und benannte Argumente sind korrigiert.
Nicht originale Zusatzfunktionen sind entfernt, Engine-Zustand ist privat
und in Library-Menüs/Inspektoren ausgeblendet. Alle ausgelieferten Beispiele
verwenden die Original-API. Die Frameworkdateien in `examples/blueplay/` sind
nun unveränderte GitHub-Kopien für BlueJ-Importe; die Interpretertests verwenden
die eingebaute Library.

Behoben sind außerdem Mindestbildgröße, unveränderte Richtung beim Zielen
auf den eigenen Standort, Ressourcen und Quelltransparenz in `drawImage`,
Bildkopien und Skalierung vorhandener Pixel. Browser und Runtime beachten
verschachtelte Bildkopien und Transparenz bei Zeichnen und Kollisionen.

Nachweise: `test:blueplay-api` prüft sämtliche öffentlichen Signaturen,
14 gültige und 28 ungültige Aufrufe, originale GitHub-Schülerdateien,
Objektlebensdauer und Bildkopien. GUI-91 prüft die vier Hilfedialoge mit
korrekten Signaturen, ohne Links/Beispiele und ohne horizontalen Überlauf;
Desktop- und schmale Ansicht wurden zusätzlich anhand Browser-Screenshots
geprüft. GUI-86 und RT-47 prüfen tatsächlich gerenderte Canvas-Pixel.
Weitere Ergebnisse stehen in [regression-checklist.md](regression-checklist.md).

Eine vollständige JVM-Pixelgleichheit wird nicht behauptet: Schriftmetriken
und Kantenglättung unterscheiden sich, Textkollisionen bleiben geometrisch
angenähert. Auch die Steuerung entspricht der Referenz: `World.show()` pausiert, `step()`
wird während Run ignoriert; reines Rendering pausiert weiterhin nicht (RT-11).
Eine JVM-/BlueJ-Ausführung fand nicht statt.

## Weltzugriff und Inspektion

`Actor.world: World` entspricht dem Typ der BlueJ-Referenz und wirft ohne
Welt `IllegalStateException`. Dadurch benötigen Schüler beim normalen
Weltzugriff keine Nullbehandlung. Weltabhängige Properties und
Kollisionsabfragen werfen ebenfalls statt stiller Ersatzwerte; der
Objektinspektor zeigt gewöhnliche Exceptions je Property und setzt die
Auswertung fort. Die Inspektionsregel steht in
[architecture.md](architecture.md#inspektor).
Die Fixtures bleiben unverändert; der Konformitätstest verlangt dieselben
öffentlichen Typen wie die Referenz.
