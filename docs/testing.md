# Kotlin-Tests in BlueK

BlueK bietet eine reduzierte Oberfläche von JetBrains’ **`kotlin.test`**.
Testklassen und erzeugte Fixtures sind gewöhnlicher Kotlin-Quelltext und können
mit `kotlin-test-junit5` unter JUnit Jupiter und in IntelliJ laufen. BlueK selbst
führt sie im vorhandenen Kotlite-Interpreter aus; eine JVM läuft im Browser nicht.

## Einfaches Beispiel

`Hund.kt`:

```kotlin
class Hund {
    var alter = 0
    fun geburtstag() { alter++ }
}
```

`HundTest.kt`:

```kotlin
import kotlin.test.*

class HundTest {
    val hund: Hund = Hund()

    @Test
    fun `Geburtstag erhöht das Alter`() {
        hund.geburtstag()
        assertEquals(1, hund.alter)
    }
}
```

Außerhalb BlueKs liegt `Hund.kt` in `src/main/kotlin`, `HundTest.kt` in
`src/test/kotlin`. Die geprüfte Gradle-Konfiguration (`build.gradle.kts`) ist:

```kotlin
plugins { kotlin("jvm") version "2.2.21" }
repositories { mavenCentral() }
dependencies {
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:6.0.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:6.0.0")
}
tasks.test { useJUnitPlatform() }
```

## Bedienung

1. Klassenkarte rechts anklicken → **Create Test Class**. Der vorgeschlagene
   Name ist `HundTest`. Die grüne Testkarte erscheint ohne UML-Stereotyp leicht
   versetzt oben rechts hinter `Hund`. Sie ist fest an die Klasse gebunden,
   lässt sich nicht einzeln verschieben und folgt beim Ziehen der Hund-Karte.
   Ein Klick auf eine Klassenkarte bringt sie nach vorne. Bei einem Testkartenpaar
   bleibt die Produktionsklasse vor ihrer Testkarte.
2. Eine unabhängige Testklasse wird über **New File → Test Class** erstellt;
   sie erhält keine Zuordnung zu einer Produktionsklasse.
3. Im Editor `@Test`-Methoden schreiben oder **Record Test…** wählen.
   Das Testfenster und seine Klassenauswahl enthalten auch Testklassen ohne
   Testmethoden, einschließlich gerade über New File angelegter Klassen.
   Jede Klasse bietet dort eine Aktion zum Starten ihrer ersten Aufzeichnung.
4. **Run All Tests**, **Run Tests** an einer Testkarte oder einen einzelnen
   Test im Kartenmenü starten. Jeder Lauf kompiliert das Projekt neu und ersetzt
   die bisherigen Objekte. Das Testfenster zeigt Ergebnisse, Fehlerdetails,
   Quelltextnavigation und einzelne Wiederholungen. **Stop** beendet auch einen
   Test, der auf Eingabe wartet oder endlos läuft; offene Tests werden abgebrochen.

Die Zuordnung einer erzeugten Testkarte wird als optionales `testTarget` im
Projekt gespeichert und bei einer Dateiumbenennung angepasst. Die Zuordnung
beeinflusst die Kotlin-Semantik nicht. Importierte Testklassen werden durch ihre
Annotationen erkannt; sie können ohne angehängte Produktionsklasse laufen.

## Unterstützte API

| Annotation | Verhalten |
| --- | --- |
| `@Test` | Öffentliche, parameterlose Instanzmethode mit Rückgabetyp `Unit` |
| `@BeforeTest` | Vor jeder Testmethode auf der frischen Testinstanz |
| `@AfterTest` | Nach jeder begonnenen Fixture, auch bei Fehlern im Setup oder Test; Fehler werden zusätzlich angezeigt |
| `@Ignore` | Auf einer Testmethode oder der ganzen Testklasse: überspringen |

Pro Klasse gibt es höchstens eine `@BeforeTest`- und eine `@AfterTest`-Methode.
Ein fehlgeschlagener Konstruktor startet kein Teardown. Testklassen sind
gewöhnliche Klassen auf oberster Ebene, ohne Vererbung oder Typparameter,
mit parameterlosem Konstruktor. Methoden haben einen Blockrumpf oder deklarieren `Unit` ausdrücklich.
Verschachtelte und parametrisierte Tests, Extensions, `@BeforeAll`/`@AfterAll`
und weitere Framework-Annotationen werden nicht unterstützt. Die vier
Annotationen funktionieren mit Einzel-/Wildcard-Import, Importalias und
qualifiziertem Namen. Tests erhalten pro Methode eine neue Instanz;
Top-Level-Zustand wird innerhalb eines Laufs geteilt, zwischen Läufen neu geladen.
Methodennamen mit Leerzeichen in Backticks sind erlaubt; auf der JVM unzulässige
Namenszeichen werden abgewiesen, gemäß der
[Kotlin-Spezifikation](https://kotlinlang.org/spec/syntax-and-grammar.html#identifiers).

Assertions: `assertEquals<T>(expected, actual, message: String? = null)`,
`assertNotEquals<T>(illegal, actual, message)`, `assertTrue(Boolean, message)`, `assertFalse(Boolean, message)`,
`assertNull(Any?, message)`, `assertNotNull<T>(T?, message): T`, `fail(message): Nothing`.
Die Nachrichten sind optional. `Double`-Werte folgen der generischen Kotlin-
Gleichheit: NaN ist NaN gleich, `0.0` und `-0.0` sind verschieden. `assertNotNull`,
`assertTrue` und `assertFalse` unterstützen die vorhandenen Smartcast-Regeln.
Lambda-/Toleranz-Overloads, `assertContentEquals`, `assertFailsWith` und eigene
Asserter sind noch nicht enthalten. Assertion-Fehler und andere Exceptions
werden getrennt angezeigt; weitere Tests laufen danach weiter. Interpreter-
Zustandsfehler dürfen weiterhin nicht von Schülercode abgefangen werden.

## Objektleiste und gespeicherter Testzustand

**Save State from Object Bench** erzeugt Felder und ein `@BeforeTest`-Setup aus
Konstruktoren, Methodenaufrufen, expliziten Property-Lesezugriffen, Zuweisungen
und einfachen Codepad-Anweisungen. Das Fenster zeigt den gesamten erzeugten
Quelltext vor **Save & Compile** in einem eingebetteten Kotlin-Editor mit
Syntax-Highlighting, Editor-Einstellungen sowie Kommentar- und Formatieraktionen.
Vorhandene Testmethoden bleiben erhalten.
Die Objektleiste wird beim Speichern und Neukompilieren geleert.
Automatisch benannte Rückgabewerte (`result1` usw.) werden nur dann als lokale
Variablen ausgegeben, wenn ein späterer aufgezeichneter Schritt sie verwendet;
andernfalls bleibt der Aufruf ohne unnötige Zuweisung stehen.
Automatische Getter-Auswertungen beim Anzeigen im Objektinspektor werden nicht
aufgezeichnet. Ein ausdrücklich aufgerufener Property-Getter bleibt dagegen
Teil des gespeicherten Zustands.
Objekte, die nicht mehr auf der Objektleiste liegen, werden nicht als Attribute
gespeichert. Benötigen spätere aufgezeichnete Schritte ein solches Objekt noch,
bleibt seine lokale Variable im Setup; andernfalls entfällt die unbenutzte
Deklaration; ihr Konstruktor wird weiterhin ausgeführt, damit dessen Effekte
auf andere Objekte erhalten bleiben.

**Load State to Object Bench** lädt das Projekt frisch, erzeugt eine Testinstanz,
führt deren Setup aus und bindet initialisierte gespeicherte Felder auf die
Objektleiste. Objektidentität und gemeinsame Referenzen bleiben erhalten.
Berechnete Properties werden dabei nicht zusätzlich ausgeführt. Auch ein
von Hand bearbeiteter Testzustand lässt sich laden; beim Überschreiben erscheint die
gleiche Warnung wie bei einem bereits gespeicherten Zustand.
Das Laden über die Objektleisten-Aktion oder das Kontextmenü öffnet das
Testfenster nicht. Es bleibt für Testläufe und Aufzeichnungen reserviert.
Nach einem Seiten-Neuladen ist kein manueller Compile-Schritt nötig:
Die Ladeaktion kompiliert das gespeicherte Projekt bei Bedarf selbst.

Gespeicherte Zustände aus der Objektleiste lassen sich erneut laden, interaktiv verändern
und wieder speichern. Beim Speichern in eine vorhandene Testklasse warnt BlueK,
dass alle Klassenattribute und alle `@BeforeTest`-Methoden ersetzt werden.
Enthält die Klasse `init`-Blöcke, werden auch diese ersetzt; die Warnung
nennt sie ausdrücklich.
`@Test`-Methoden und andere Methoden bleiben erhalten. Damit ist die
Objektleiste die maßgebliche Definition des gespeicherten Zustands.

Drei textfreie Aktionen in der Statuszeile direkt unter der Objektleiste,
rechts neben der Objekt-Auswahl, heißen **Save state**, **Load state** und
**Choose default test class**. Sie speichern und laden den Zustand der
Standard-Testklasse beziehungsweise ändern diese Standardklasse. Beim
ersten Speichern fragt BlueK nach einem Klassennamen (Vorschlag
`StateTest`), zeigt danach die Kotlin-Vorschau und speichert die erzeugte
unabhängige Testklasse als Standard. Die Auswahl wird im Projekt gespeichert
und mit Autosave sowie Projekt-Export/Import übernommen.
Im Dialog **Save / Export** lässt sich für volle Projektlinks und Kurzlinks
zusätzlich **Load state** auswählen. Ein solcher Link lädt nach dem Öffnen
automatisch den Zustand der gespeicherten Standard-Testklasse in die Objektleiste
und kompiliert das Projekt dafür selbst. Ohne Standardklasse ist die Option
deaktiviert. **Open README** kann gleichzeitig gewählt werden; das Testfenster
und der Quelltexteditor bleiben geschlossen. Die Optionen gehören zum Link:
volle Links tragen `&state=1` im Fragment, Kurzlinks `?state=1` im Query-String
(mit README `?readme=1&state=1`). Ein normaler Dateiimport oder Autosave-Restore
lädt den Zustand weiterhin erst auf Wunsch. Fehler beim automatischen Laden
werden im normalen Fehlerdialog angezeigt.
Erzeugte Zustandsfelder sind `val`-Referenzen mit ihrem ursprünglichen
Konstruktoraufruf; Objekte bleiben über ihre Methoden veränderbar. Dafür ist
`lateinit` nicht nötig. Werden zwischen den Konstruktoren andere Aktionen
aufgezeichnet oder entsteht ein Objekt aus einem Methodenresultat, werden
die `val`-Felder im `init`-Block zugewiesen. So bleibt die ursprüngliche
Reihenfolge erhalten; Konstruktorargumente sehen den Zustand zum richtigen
Zeitpunkt. Einfachere Zustände behalten Feldinitialisierungen und `setUp()`.

Der Zustand wird durch **Wiederholung der Vorbereitung** rekonstruiert. Es gibt
keine allgemeine Serialisierung beliebiger Objektgraphen. Deterministische
private Zustandsänderungen durch aufgezeichnete Methoden bleiben erhalten;
Zufall, Zeit, externe Effekte und Eingaben können beim Wiederholen andere Werte
liefern. BluePlay-Simulationen und `main()` sind nicht als gespeicherter
Objektleisten-Zustand erfassbar.
Nach einem fehlgeschlagenen Runtime-Aufruf kann Zustand verändert sein; BlueK
verlangt dann Reset und erneute Vorbereitung. Wiederverwendete Bench-Namen,
interne Handles und nicht rekonstruierbare Bindungen werden mit einem Hinweis
abgewiesen.
Zuweisungen an die Referenz einer Codepad-Variablen und lokale Variablen,
die ein Zustandsattribut verdecken, lassen sich nicht unverändert als `val`-
Zustand wiedergeben; BlueK meldet diese Grenze statt fehlerhaften Code anzubieten.
Primitive Bench-Werte (Zahlen, Boolean und Char) als gespeicherte
Zustandsfelder sind zunächst ausgeschlossen; String-Referenzen sind möglich.
Die Codevorschau bleibt vor jedem Speichern editierbar; Compile-Diagnosen prüfen
auch dort Typen und Sichtbarkeit.

## Aufzeichnung

**Record Test…** stellt zuerst die Fixture auf die Objektleiste. Danach werden
Konstruktoren, Methoden, Zuweisungen und Codepad-Schritte aufgezeichnet.
Bei einem Methodenresultat kann **Add Assertion** Gleichheit, null oder nicht
null prüfen. Erwartete skalare Werte werden als Kotlin-Ausdruck vorgeschlagen
und können geändert werden. Das Resultat wird nur einmal berechnet und im Test
in einer lokalen Variable behalten. **Finish Recording…** ergänzt eine neue
`@Test`-Methode nach Vorschau. **Cancel Recording** verwirft Assertion-Entwürfe;
die bereits vorgenommenen Änderungen an Objekten bleiben bestehen.

Die Bedienidee stammt aus dem offiziellen
[BlueJ Testing Tutorial](https://www.bluej.org/tutorial/testing-tutorial.pdf):
angehängte Testklassen, Fixture-Transfer und Aufzeichnung mit Assertions im
Ergebnisdialog. BlueK verwendet dafür die Kotlin-API und einen zusätzlichen
Quelltext-Vorschauschritt.

## Architektur und Nachweise

- Parser/AST im vendorten Interpreter besitzen Annotationen und Quellpositionen.
- `BlueKTesting` gehört genau einer `KotliteSession`: Discovery, Ergebnisse,
  Replay-Journal und Aufzeichnung liegen im Worker. Anweisungsgrenzen stammen
  aus Parser-Metadaten; mehrzeilige String-Inhalte werden beim Einrücken erhalten. Die Oberfläche besitzt
  ausschließlich Dialogentwürfe und leitet ihre Ansichten aus `RuntimeSnapshot` ab.
- Der Runner erzeugt interne Aufrufe im normalen suspendierbaren Interpreterpfad.
  Konstruktoren, Setup, Tests und Teardown durchlaufen `enterCall`/`leaveCall`;
  Eingabe, Depth-Limit und Generationen gelten unverändert.
- `TestWorkspace` nutzt den einzigen bestehenden `LocalRuntimeClient`.
  Quelltextänderungen/Compile ersetzen seine Generation und beenden eine
  Aufzeichnung. Eine gespeicherte Vorschau darf keine inzwischen geänderte Datei
  überschreiben (Revisionprüfung).
- `npm run test:testing`: echter Client/Host/Bundle; Lifecycle, Fehler, Ignorieren,
  Annotationen, Fixture-Roundtrip, Aufzeichnung, Abbruch und Cancel.
- `npm run test:testing:portable`: zusätzlich genau den generierten Fixture- und
  Testquelltext mit Kotlin 2.2.21, `kotlin-test-junit5` und JUnit Jupiter 6.0.0
  außerhalb BlueKs kompilieren und ausführen (einschließlich mehrzeiliger
  Fixture-Argumente, chronologisch geordneter `init`-Vorbereitung, gemeinsamer
  Objektreferenzen und benannter Assertion-Parameter). Nutzt einen sauberen
  Gradle-Build, Java und Maven Central;
  Projekt und Ergebnisse liegen in `.cache/kotlin-test-portability/`.
- `tests/gui/testing.spec.ts`: tatsächliche Chromium-Bedienung für Karten,
  Fixture-Transfer, Recording, Ergebnisdetails, Wiederholung und Cancel.
- Der Stand der manuellen Prüfung im eingebauten Browser steht getrennt in
  [regression-checklist.md](regression-checklist.md).
