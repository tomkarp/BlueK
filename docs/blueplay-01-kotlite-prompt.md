# Umsetzungsprompt 1: Kotlite-Typsystem für BluePlay und weitere Projekte

Stand: 17. September 2026. Dieser Text ist ein eigenständig verwendbarer
Implementierungsauftrag. Die Arbeit wurde hiermit noch nicht implementiert.
Danach folgt `docs/blueplay-02-implementation-prompt.md`.

## Auftrag

Arbeite im Repository `/Users/thomaskarp/Documents/Apps/BlueK`.
Verbessere die allgemeine Unterstützung generischer Typen und reifizierter
Typparameter in der lokal eingebundenen Kotlite-Laufzeit. Die Lösung muss auch
außerhalb von BluePlay verwendbar sein. Implementiere noch keine Spielengine
und keine BluePlay-Oberfläche.

Lies `AGENTS.md` und `docs/architecture.md`. Svelte bleibt die einzige
Oberfläche; die laufende Kotlite-Session bleibt die Quelle des Objektzustands.
Keine Commits oder Pushes. Aktualisiere bei Laufzeitänderungen die
`docs/regression-checklist.md` unter Erhaltung bestehender IDs. Trenne dort
Runtime-/Hilfstests, tatsächliche Browsertests und ausstehende Benutzerabnahme.

## Ausgangslage und Abgrenzung

Generics fehlen nicht grundsätzlich. In lesenden Architekturproben mit dem
bereits vorhandenen JS-Bundle funktionierten typisierte Listen und eine
generische Identitätsfunktion. Folgende Befunde müssen nach einem frischen
Build zunächst reproduziert und genauer lokalisiert werden:

1. `class Box<T>(val value: T)` und danach
   `val b = Box<String>("Hallo"); b.value` schlugen in einer gemeinsamen
   Auswertung mit einem Fehler über fehlende Typargumente fehl.
2. `inline fun <reified T> matches(item: Any): Boolean { return item is T }`
   wurde vom Parser nicht angenommen.
3. Eine nicht-reifizierte Funktion `fun <T : Actor> select(...)`, die innerhalb
   einer Lambda mit `it is T` filterte, lieferte für eine Liste aus `Coin` und
   `Wall` bei `select<Coin>(...)` beide Elemente. Diese Deklaration ist schon
   semantisch unzulässig in Kotlin und soll abgewiesen werden, nicht still mit
   der Obergrenze `Actor` arbeiten.
4. `filterIsInstance<T>()` war auf einer `MutableList<Actor>` nicht verfügbar.
5. Eine Zuweisung von `List<Coin>` an `List<Actor>` scheiterte in einer Probe.
   Prüfe, ob die Ursache in Varianz, Bibliotheksmetadaten oder der Einbindung
   liegt; verallgemeinere den Befund nicht ungeprüft auf alle Collections.

Das waren kleine Proben des vorhandenen Bundles, keine vollständige
Konformitätsprüfung und keine Diagnose der jeweiligen Fehlerursache.

Kotlin-Sprachreferenzen:
- https://kotlinlang.org/docs/generics.html
- https://kotlinlang.org/docs/inline-functions.html#reified-type-parameters

## Fachliches Ziel

Korrekte Typweitergabe für generische Klassen und Funktionen, einschließlich
Verwendung aus Projektdateien, Codepad und Methodenaufrufen. Konkrete
Typargumente dürfen nicht versehentlich durch ihre Obergrenzen ersetzt werden.

Unterstütze insbesondere diese später benötigte Schnittstelle, ohne
BluePlay-Namen im Parser oder Typsystem speziell zu behandeln:

```kotlin
open class Entity
class Coin : Entity()
class Wall : Entity()

inline fun <reified T : Entity> select(items: List<Entity>): List<T> {
    return items.filterIsInstance<T>()
}
```

Ein Aufruf `select<Coin>(items)` muss ausschließlich passende Instanzen
einschließlich Unterklassen liefern, in ursprünglicher Reihenfolge und mit
unveränderter Identität. Dieselbe Typinformation muss auch bei generischen
Memberfunktionen und registrierten Host-Funktionen verfügbar sein.

## Umsetzung in überprüfbaren Schritten

1. **Iststand reproduzieren.** Prüfe die lokale Gradle-Einbindung unter
   `kotlite-browser` und `vendor/kotlite-interpreter`; baue das Bundle frisch.
   Ergänze kompakte Verhaltenstests für die oben genannten Befunde. Bereits
   funktionierende Fälle bleiben Regressionstests; repariere nur bestätigte
   Probleme.
2. **Normale Generics stabilisieren.** Prüfe Konstruktoren, Memberzugriff,
   Rückgabetypen, Weiterreichen von Typparametern, Vererbung, nullable Typen
   und Collection-Varianz. `List`-Kovarianz darf nicht dazu führen, dass
   `MutableList` unzulässig kovariant wird.
3. **Reifizierte Funktionen korrekt implementieren.** Parser, Analyse und
   Auswertung müssen zusammenpassen. Reifizierte Typinformationen müssen
   in `is`/`as`, verschachtelten Aufrufen und Lambdas erhalten bleiben.
   Implementiere `filterIsInstance<T>()` im passenden Bibliotheksmodul und
   nutze gemeinsame Typprüflogik für interpretierte und native Funktionen.
4. **BlueK-Anbindung prüfen.** Projektanalyse, interaktive Aufrufe,
   Methodenmetadaten und Inspektor dürfen generische Argumente nicht
   verlieren. Verwende den bestehenden Session-/Client-Weg.

Ein Interpreter muss zur Umsetzung von `reified` keinen JVM-Bytecode
erzeugen und keinen Quelltext an Aufrufstellen kopieren. Er muss aber die
Kotlin-Sprachregeln einhalten. `inline`/`reified` lediglich zu entfernen oder
ignorieren ist keine Lösung. Insbesondere nicht-lokale Returns und
`noinline`/`crossinline` nicht versehentlich mit falscher Semantik akzeptieren.
Prüfe den vorhandenen Funktionsumfang; falls eine korrekte Unterstützung
dieser verwandten Konstrukte den begrenzten Auftrag erheblich erweitert,
dokumentiere die konkrete Grenze und unterstütze keine stillen Fehlresultate.
Versprich nicht vollständige Kotlin-Konformität aufgrund weniger Tests.

Fehlende Standardbibliotheksfunktionen gehören in ein klar abgegrenztes
Bibliotheksmodul. Keine Quelltext-Ersetzungen in Svelte, keine
BluePlay-spezifischen Parser-Ausnahmen, kein paralleler Kotlin-Parser.

## Abnahme

Verwende das tatsächlich frisch gebaute Bundle, nicht ausschließlich Mocks.
Prüfe mindestens:

- `Box<String>` und `Box<Int>` mit Konstruktor, Feld und Rückgabe;
  auch verteilt über Projektdateien und anschließende Codepad-Aufrufe.
- Generische Funktionen, generische Member und Weitergabe von `T` über
  mehrere Aufrufe; Instanzen bleiben identisch.
- `List<Sub>` kann als `List<Base>` verwendet werden;
  entsprechende unsichere `MutableList`-Zuweisungen werden abgewiesen.
- Reifizierte Filter über gemischte Instanzen: Treffer, Nichttreffer,
  Unterklassen, leere Liste, nullable Typen gemäß Kotlin-Verhalten.
- Reifizierte Typprüfung innerhalb einer Lambda und Weitergabe an eine
  andere reifizierte Funktion.
- Ungültige `is T`-Prüfung ohne reifiziertes `T` wird vor Ausführung
  diagnostiziert; unerlaubte Bounds/Typkombinationen ebenso.
- Dieselben Typargumente erreichen eine registrierte native generische
  Funktion; der Test ist unabhängig von BluePlay.
- Analysefehler führen zu keinen neuen Seiteneffekten. Bestehende
  REPL-Historie, Objektidentität, passive Inspektion und Suspendierung
  funktionieren weiterhin.

Relevante vorhandene Prüfungen sind `npm run build`, `npm run typecheck`,
`npm run test:runtime-state`, `npm run test:references` und bei betroffenen
Oberflächen die passenden Playwright-Tests. Ergänze ein gezieltes,
wiederholbares Testkommando für Generics. Wähle zusätzliche Tests anhand
der tatsächlich geänderten Bereiche. Bestehende fremde Fehler getrennt
ausweisen, nicht durch Abschwächen von Tests verdecken.

## Ergebnis und Übergabe

Arbeite die Schritte selbstständig ab; normale lokale Implementierungs- und
Testentscheidungen brauchen keine zusätzliche Freigabe. Liefere anschließend
eine kurze Zusammenfassung mit tatsächlich bestandenen/fehlgeschlagenen
Prüfungen und verbleibenden Grenzen. Dokumentiere die für die nachfolgende
BluePlay-Bibliothek nutzbaren Typ- und Host-Schnittstellen im Repository.
Wenn ein kritischer Teil technisch blockiert ist, benenne den konkreten
Blocker; ersetze ihn nicht durch einen scheinbar funktionierenden Spezialfall.
