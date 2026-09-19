# Kotlite-Genericschnittstelle

## Generische Klassen und Collections

Generische Klassen funktionieren über mehrere `session.load()`-Aufrufe und
anschließende Codepad-Ausdrücke, einschließlich `Box<String>` und `Box<Int>`.
Generische Member, vererbte Methoden, Rückgabewerte und Objektidentität bleiben
erhalten. `List`, `Collection` und `Iterable` sind kovariant; `MutableList` und
`MutableCollection` bleiben invariant.

## Reifizierte Funktionen und Closures

`inline fun <reified T> ...` macht den konkreten Aufruf-Typ in `is T`, `!is T`
und `as T` verfügbar. Verschachtelte und zurückgegebene Lambdas behalten die
konkreten Typen ihres jeweiligen Aufrufs sowie ihre lexikalischen Variablen.
Auch wiederholte Factory-Aufrufe mit unterschiedlichen Typargumenten teilen
keine Typauflösung.

Die Analyse weist nicht-reifizierte `is T`-Prüfungen, direkte und inferierte
Weitergabe eines nicht-reifizierten Typparameters an einen reifizierten
Parameter, `reified` an Klassen sowie reifiziertes `Nothing` ab.
Namensgleiche Typparameter innerer Funktionen und Klassen verdecken äußere.

Die Laufzeitprüfung prüft den Klassifikator und Nullbarkeit. Generische
Elementtypen werden nicht durch Betrachtung der Listenelemente geprüft:
`matches<List<String>>(listOf(1))` kann deshalb bei einer reifizierten
`matches`-Funktion wahr sein. Eine direkte Prüfung `any is List<String>` wird
bei unbekannten Elementtypen abgewiesen; `any is List<*>` ist zulässig.
Siehe [Kotlin: Type erasure](https://kotlinlang.org/docs/generics.html#type-erasure).

## Inline-Lambdas und Rücksprünge

Der Interpreter bildet das Verhalten ohne JVM-/JS-Quelltextexpansion ab:

- Gewöhnliche Lambda-Parameter einer `inline`-Funktion erlauben nichtlokale
  `return`-Anweisungen zur lexikalisch umgebenden Funktion, auch durch mehrere
  Inline-Aufrufe. Direkte Weitergabe an andere Inline-Parameter ist zulässig.
- `noinline` erlaubt Speicherung, Rückgabe und Weitergabe eines Funktionswerts,
  aber keinen nichtlokalen Rücksprung aus dessen Lambda.
- `crossinline` erlaubt den Aufruf in einer zurückgegebenen Wrapper-Lambda,
  aber keinen nichtlokalen Rücksprung. Der Parameter selbst darf nicht als
  gewöhnlicher Funktionswert entkommen.
- Lokale `return@funktionsname` und explizite Lambda-Labels funktionieren.
  Nichtlokale Rücksprünge umgehen `catch`, führen aber `finally` aus.
- Rücksprungziele gehören zu einer konkreten Funktionsausführung. Rekursion,
  zurückgegebene Closures und Suspendierung verwechseln keine Aufrufe.

Die Analyse verhindert illegale Parameterweitergabe und Rücksprünge sowie
unzulässige Kombinationen von `noinline`/`crossinline`. Für die ältere,
binär eingebundene Kotlite-Standardbibliothek ergänzt `StdlibInlineMetadata`
gezielt Inline-Metadaten für Scope-Funktionen und aufgezählte synchrone
Collection-/Text-/Byte-Operationen. Neue Host-Funktionen deklarieren ihre
Modifier direkt. Referenz: [Kotlin: Inline functions](https://kotlinlang.org/docs/inline-functions.html).

Dies ist keine vollständige Kotlin-Compilerimplementierung: Es gibt keine
Optimierung durch Code-Inlining, keine Erweiterung um Inline-Properties,
Reflection oder modulübergreifende `@PublishedApi`-Prüfungen. Nichtlokale
`break`/`continue` über Lambda-Grenzen sind weiterhin nicht unterstützt.
Die dokumentierte Unterstützung betrifft Funktionsparameter und Returns.

## Host-Funktionen und `filterIsInstance`

BlueK reicht explizite und inferierte Typargumente über
`FunctionCallNode.typeArguments` bis zu `CallableNode.execute(..., typeArguments)`
weiter. Host-Funktionen deklarieren `CustomFunctionDefinition.typeParameters`
und erhalten die aufgelösten `DataType`-Werte im letzten Callback-Argument.
`TypeParameter.isReified` und `FunctionModifier.inline` beschreiben reifizierte
Host-Funktionen. `extraTypeParameters` enthält unabhängig davon Typparameter,
die nur aus dem Receiver aufgelöst werden.

`filterIsInstance` liegt im allgemeinen `GenericCollectionsModule`, unabhängig
von Session und BluePlay. Seine interne Signatur lautet:

```kotlin
inline fun <reified T> Iterable<S>.filterIsInstance(): List<T>
```

`S` wird aus dem Receiver ermittelt, nur `T` wird am Aufruf angegeben. Die native
Implementierung nutzt wie `is`, Casts und Rückgabewertprüfungen die gemeinsame Laufzeitprüfung
`DataType.acceptsRuntimeType`, berücksichtigt Unterklassen und nullable
Zieltypen und erhält Reihenfolge und Objektidentität.

## Prüfung

`npm run test:generics` führt `scripts/smoke-generics.mjs` und
`scripts/smoke-generics-boundaries.mjs` gegen das gebaute Browser-Bundle aus.
Die Tests prüfen positive Ergebnisse und die Analysephase ungültiger Programme,
lexikalische Captures, Rekursion, Labels, Modifier und Suspendierung.
`tests/gui/generics.spec.ts` prüft zusätzlich Projektkompilierung, generische
Instanzen, Returns und Closure-Aufrufe über die echte Browser-/Worker-Strecke.
Tatsächliche Testläufe werden in der Regression-Checkliste festgehalten.
