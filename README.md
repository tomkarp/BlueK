# BlueK

BlueK ist eine browserbasierte Kotlin-Lernumgebung nach dem Vorbild von BlueJ:
Klassenkarten, Objektbank, Objektinspektor, Codepad, Terminal und die
Spielbibliothek BluePlay. Schülercode läuft vollständig im Browser – in einem
Web Worker mit einem eingebundenen, erweiterten
[Kotlite](https://github.com/sunny-chung/kotlite)-Interpreter. Es gibt weder
serverseitige Kotlin-Ausführung noch einen Kotlin-Compiler zur Laufzeit.

- Öffentliche Version: <https://bluek.de> (Branch `main`)
- Beta: <https://beta.bluek.de> (Branch `beta`)

## Schnellstart

Voraussetzung ist Node.js 22. Java 21 wird nur gebraucht, wenn der Kotlin-Teil
(`kotlite-browser/`, `vendor/kotlite-interpreter/`) neu gebaut wird; das
fertige Interpreter-Bundle `frontend/public/kotlite/bluek-kotlite-browser.js`
ist eingecheckt.

```sh
npm install
npm run dev     # Entwicklungsserver, http://localhost:5173
npm run build   # vollständiger Produktionsbuild nach frontend/dist/
```

Build-Pipeline, Tests und Deployment stehen in [DEVELOPMENT.md](DEVELOPMENT.md).

## Funktionen

- **Projekte:** Jede Kotlin-Datei ist eine Karte – entweder genau eine Klasse
  oder Top-Level-Funktionen und -Properties. Vererbung wird als Pfeil
  gezeichnet. Dazu kommen Projektname und README-Notiz. Das Projekt wird im
  Browser automatisch gesichert (localStorage), als `.bluek.json`
  exportiert/importiert, als BlueJ-Projekt (ZIP oder Ordner) importiert oder
  als Link geteilt: vollständig im Link (`#bluek=…`) oder optional als
  Drei-Wort-Kurzlink über den Share-Dienst.
- **Editor:** CodeMirror mit Kotlin-Highlighting, Tabs und Fenstern,
  Formatierung über einen lokal gebündelten ktfmt-WASM-Build,
  Compilerfehler an Zeile/Spalte, optionaler Vim-Modus.
- **Compile und Start main:** siehe unten.
- **Objektbank und Inspektor:** Objekte über den Konstruktor-Dialog erzeugen,
  Methoden (direkt/geerbt) aufrufen, Felder passiv inspizieren, Getter auf
  Anfrage auswerten, Felder setzen (Objekte per Klick auf die Objektbank
  einsetzen), gespeicherten Objektreferenzen folgen.
- **Codepad:** Ausdrücke und Anweisungen; Variablen bleiben bis Compile/Reset
  erhalten. Ergebnisse lassen sich per „Get“ auf die Objektbank legen.
- **Terminal:** `print`/`println`, `readln`/`readLine`/`readlnOrNull` mit
  echter Wartestellung, EOF, Stop und BlueJ-artigem Löschen per Form Feed.
- **BluePlay:** eingebaute Bibliothek mit `World`, `Actor`, `Image` und
  Hilfsfunktionen; Weltfenster mit Act, Run/Pause, Reset und Speed;
  Tastatur und Maus; pixelgenaue Kollision; mitgelieferte Standardgrafiken.
  Siehe [docs/blueplay.md](docs/blueplay.md).
- **HTML-Export (Beta):** ein Programm als einzelne HTML-Datei, die ohne
  Server und ohne Netzwerk läuft.
- **Vorlagen:** New Project bietet Empty Project, BluePlay Template, BluePlay
  Example sowie zwei Demo-Projekte (BlueK Demo, Space Invaders).

Hinzufügen eigener Bilder und Sounds ist in der Oberfläche noch nicht
freigeschaltet; Ressourcen gelangen derzeit über BlueJ-Import oder
Projekt-JSON ins Projekt.

## Compile, main und Reset

**Compile** startet einen neuen Worker, analysiert alle Kotlin-Dateien
gemeinsam, führt die Top-Level-Property-Initialisierer einmal aus und
aktualisiert die Klassenkarten. Dabei wird Kotlin nicht in JavaScript
übersetzt: „Compile“ bedeutet Parsen, semantische Analyse und Laden in eine
neue Interpreter-Sitzung. Codepad-Eingaben kompilieren bei Bedarf automatisch.

Eine parameterlose Top-Level-Funktion `fun main()` darf in jeder
Funktionsdatei stehen; `Main.kt` ist nicht vorgeschrieben. **Start main** (auch
per Tastenkürzel) und **Reset** der BluePlay-Welt verwenden dieselbe Auswahl:

- Bei genau einer `main()` startet sie sofort.
- Bei mehreren erscheint bei jedem Aufruf **Choose main** mit den Dateinamen;
  **Cancel** oder Escape bricht ohne Ausführung ab. Die Wahl wird nirgends
  gespeichert.
- Ohne passende `main()` ist **Start main** deaktiviert und der Reset-Button der
  BluePlay-Welt ausgeblendet. Klassenmethoden zählen nicht als Einstiegspunkt.
- Über das Kontextmenü einer Funktionskarte lässt sich gezielt deren `main()`
  starten.

**Reset** kompiliert ein normales Projekt neu. In einem BluePlay-Projekt ruft
Reset dagegen die gewählte `main()` in derselben Sitzung erneut auf;
Top-Level-Properties werden dabei nicht neu initialisiert. **Stop** beendet den
Worker sofort, auch mitten in einer Endlosschleife.

## Offline-Paket für Prüfungen

`npm run build:offline` erzeugt `dist-offline/BlueK-offline/BlueK.html`
und ein ZIP mit dieser Datei und einer kurzen Anleitung. Nach dem Entpacken
reicht ein Doppelklick auf **BlueK.html**. Es sind weder ein Server noch
Node.js, Python oder eine Installation auf dem Zielrechner erforderlich.
Oberfläche, Interpreter, BluePlay-Grafiken, Projektvorlagen, Kotlin-Formatter
und HTML-Exportvorlage sind vollständig eingebettet.

Das ZIP wird zusätzlich nach `frontend/public/downloads/` kopiert; die
Online-Version verlinkt es in der Seitenleiste. `npm run build` baut es jedes
Mal neu, `npm run dev` nur, falls es fehlt (ein veraltetes ZIP bleibt dort
also liegen). Im Offline-Build sind die Kurzlink-Funktionen ausgeblendet;
JSON-Export/-Import und HTML-Programmexport funktionieren. „Copy Full Project
Link“ erzeugt einen teilbaren Link zu `https://bluek.de/` mit dem vollständigen
Projekt. Für die lokale Abgabe eignet sich die JSON-Datei.

Browser können lokale Dateien unterschiedlich behandeln. Automatisches
Speichern gehört zum jeweiligen Browser und Dateipfad; beim Verschieben von
BlueK.html muss das bisherige Autosave nicht mehr verfügbar sein. Projekte
für die Abgabe deshalb ausdrücklich als `.bluek.json` speichern.
Anleitung für Lehrkräfte: `scripts/offline/LIESMICH.txt`.

## Kurz-Links (optional)

Der Dienst `server/share-server.mjs` (Node.js + SQLite) speichert Projekt-JSON
für 30 Tage unter einem Code aus drei englischen Wörtern
(`/load/wort-wort-wort`). Er kennt keine Benutzer und führt keinen Kotlin-Code
aus. Lokal:

```sh
npm run share:server   # 127.0.0.1:8787
npm run dev            # Vite leitet /api dorthin weiter
```

Betrieb auf dem Server: [docs/deployment.md](docs/deployment.md).

## Aktuelle Grenzen

Stand: 2. Oktober 2026, geprüft gegen das eingecheckte Interpreter-Bundle.
Der Objektinspektor wertet alle Properties automatisch aus und zeigt gewöhnliche
Getter-Exceptions in der jeweiligen Zeile. `Actor.world` hat den Typ `World`
und wirft ohne Welt `IllegalStateException`; der Inspektor zeigt den Fehler
wie bei anderen Properties, ohne die Ausführung zu beenden.

**Projektdateien.** Eine Datei enthält entweder genau eine Klasse (bzw. ein
Interface oder Enum) oder Top-Level-Funktionen und -Properties. Direkte
Anweisungen auf oberster Ebene sind ein Compilefehler (im Codepad erlaubt).
Imports sind nur aus `kotlin.*` zulässig; `java.*`/`javax.*` werden mit Datei
und Zeile abgewiesen. `package`-Deklarationen gibt es nicht.

**Sprache.** BlueK unterstützt die Kotlite-Teilmenge von Kotlin plus die
Erweiterungen des eigenen Forks (siehe [docs/kotlite.md](docs/kotlite.md)).
Es funktionieren unter anderem Klassen mit Primärkonstruktor und `init`,
sekundäre Konstruktoren ohne Primärkonstruktor und ohne Delegation,
Klassen, die einander in beliebiger Datei- und Deklarationsreihenfolge und
auch gegenseitig verwenden (`Hund` mit `var herrchen: Mensch?`, `Mensch` mit
`val hunde = mutableListOf<Hund>()`, RT-40), Top-Level-Funktionen und
-Properties, die in Dateireihenfolge erst später stehen (`main()` ruft
`hilfe()` aus `Util.kt`, eine Klasse liest `val maximum` einer späteren
Datei, RT-45),
Vererbung (`open`, `abstract`, `override`, `super`), Interfaces mit abstrakten
Methoden, Generics einschließlich `inline`/`reified`, Extension-Funktionen,
Operator-Überladung, Lambdas und Scope-Funktionen, `enum class` (auch mit
Konstruktor), eigene Getter/Setter mit `field`, `private` (auch `private set`),
Default- und Named-Arguments, `vararg`, `try`/`catch`/`finally` mit
Standardausnahmen, `Long`, `Float` (als `Double`), Nullability mit `?.`/`?:`,
Smart Casts nach `is` und Null-Prüfungen,
`when` ohne `else` als Anweisung oder wenn alle Enum-Werte bzw. `true` und
`false` abgedeckt sind (RT-56), `break`/`continue` in allen Schleifen (RT-55),
List/Map/Set und Ranges.

Nicht unterstützt sind derzeit:

- `data class`, `object`, `companion object`, `sealed`, verschachtelte und
  innere Klassen, anonyme Objekte, `fun interface`, `typealias`
- sekundäre Konstruktoren zusammen mit einem Primärkonstruktor oder mit
  `this`-/`super`-Delegation (mit eigener Fehlermeldung), `protected`,
  `internal`, `lateinit`, `const`
- Default-Methoden und Properties in Interfaces, abstrakte Properties,
  Extension-Properties mit Getter
- Destrukturierung (auch `for ((k, v) in map)`), Funktionsreferenzen (`::f`),
  Labels an Schleifen (`break@outer`)
- Smart Casts nach `is` und Null-Prüfungen wirken nur auf einfache Namen
  (nicht auf `objekt.eigenschaft` oder `this.eigenschaft`) und, wie in Kotlin,
  bei `is` nur auf lokale Variablen, Parameter und `val`-Properties ohne eigenen
  Getter, nicht auf `var`-Properties. Ein Test auf einen nicht verwandten Typ
  (Kotlin bildet Schnittmengen-Typen) und Zuweisungen in einem späteren
  Schleifendurchlauf werden nicht berücksichtigt; dort ist ein explizites `as`
  nötig
- Arrays (`arrayOf`, `IntArray`), `Short`, Hex-/Binär-/`_`-Zahlliterale,
  Bit-Operationen, `Triple`
- `enum`-`values()` (`entries` funktioniert)
- Über einen impliziten Empfänger (`liste.apply { add(1) }`,
  `with(text) { uppercase() }`, `gruss()` für `fun Hund.gruss()` in einer
  `Hund`-Methode) gewinnt eine gleichnamige eigene Top-Level-Funktion, die zu
  den Argumenten passt (Kotlin: die Funktion des Empfängers, RT-63);
  Erweiterungs-Properties eines Obertyps werden dort nur gefunden, wenn ihr Typ
  keinen Typparameter enthält (`size`, `lastIndex`)
- Eine überschreibende Funktion braucht denselben Rückgabetyp wie die
  überschriebene; Kotlin erlaubt auch einen spezielleren (`override fun f():
  String` für `open fun f(): Any`). Ohne angegebenen Rückgabetyp übernimmt sie
  den überschriebenen, z. B. `override fun toString() = "…"` (RT-57)
- Top-Level-Properties bei Bedarf initialisieren: BlueK initialisiert sie
  beim Laden in Dateireihenfolge. Liest ein Initialisierer eine später
  stehende Property direkt (`val a = b + 1` vor `val b = 2`), ist das ein
  Compilefehler; über eine Funktion oder Klasse (`val h = Hund()` vor
  `val maximum = 3`, das `Hund` liest) ein Laufzeitfehler „… is used before
  it is initialized“. Kotlin/JVM würde die spätere Datei vorher
  initialisieren.
- Aufrufe einer Funktion mit Ausdruckskörper ohne Rückgabetyp
  (`fun b() = 1`), deren Typ Kotlite an dieser Stelle noch nicht kennt: weiter
  oben in derselben Klasse (`fun a() = b()`) oder bei gegenseitiger
  Rekursion (`fun a() = b()` mit `fun b(): Int = a()`); ein expliziter
  Rückgabetyp (`fun b(): Int = 1`) behebt das

**Standardbibliothek.** Grundlage ist `kotlite-stdlib` 1.1.0, ergänzt durch
BlueK. Was zugesagt ist und welche Lücken bekannt sind (u. a.
`String.format`, `withIndex`, `buildString`/`StringBuilder`,
`kotlin.random.Random`, vollqualifizierte Aufrufe wie `kotlin.math.abs(x)`),
steht in [docs/kotlin-surface.md](docs/kotlin-surface.md). Für fehlende Namen
nennt BlueK eine verständliche Meldung statt Kotlites generischem Fehler.

**Warten und Ausnahmen.**

- `readln()` und `Thread.sleep()` können nicht innerhalb von `toString()`,
  `equals()`, `hashCode()` oder `compareTo()` warten; BlueK meldet dann einen
  Laufzeitfehler („cannot pause inside toString() …“), den auch ein
  umgebendes `catch` nicht abfängt. In Lambdas von
  Bibliotheksfunktionen (`forEach`, `map`, `filter`, `repeat`, `let` …)
  funktionieren sie seit RT-37.
- Ausnahmen aus Bibliotheksfunktionen lassen sich für
  `NumberFormatException`, `IllegalArgumentException`,
  `IllegalStateException`, `IndexOutOfBoundsException`,
  `NoSuchElementException` und `ArithmeticException` (auch Ganzzahldivision
  durch 0) mit ihrer Klasse oder mit `Exception` fangen (etwa `"x".toInt()`
  mit `catch (e: NumberFormatException)`, RT-38). Andere, etwa
  `UnsupportedOperationException`, fängt nur `catch (e: Throwable)`. Solche
  Ausnahmen haben keinen Stacktrace; `printStackTrace()` zeigt nur Klasse und
  Meldung.
- `substring` prüft seine Grenzen wie Kotlin und wirft
  `IndexOutOfBoundsException` (RT-39).
- Rekursion ist auf 1000 verschachtelte Aufrufe begrenzt; danach wirft BlueK
  einen `StackOverflowError`, der sich mit `catch (e: Throwable)` oder
  `catch (e: Error)` fangen lässt (RT-42). In Lambdas von
  Bibliotheksfunktionen und in `toString()` & Co. kann die Grenze früher
  erreicht sein. Setter oder Getter, die ihre eigene Property statt `field`
  benutzen und sich dadurch endlos selbst aufrufen, meldet Compile als
  Warnung (RT-43).

**Laufzeit.**

- Nach einem Laufzeitfehler gibt es kein Rollback; Reset oder Compile ist
  nötig. Analysefehler lassen die Sitzung dagegen unverändert benutzbar.
- Jede Codepad-/Objektbank-Aktion analysiert den gesamten bisherigen
  Sitzungsquelltext erneut. Sehr lange Sitzungen werden dadurch langsamer.
- Nur Schleifen besitzen kooperative Checkpoints; sie geben nach etwa 10 ms
  Rechenzeit an den Worker ab. Rechnet Code ohne Schleife
  (z. B. eine häufig verzweigende Rekursion) lange, verarbeitet der Worker
  Eingaben erst danach;
  Stop funktioniert trotzdem immer. Dasselbe gilt für Schleifen in Lambdas
  von Bibliotheksfunktionen (`forEach { for (…) }`) und in `toString()`,
  `equals()`, `hashCode()` und `compareTo()`: Sie laufen korrekt, geben aber
  erst am Ende an den Worker ab.
- `Thread.sleep` wird unterstützt, andere Thread-APIs nicht.

**BluePlay.** Die Browser-API ist in [docs/blueplay.md](docs/blueplay.md)
aufgelistet. Öffentliche Signaturen, Parameternamen und Beispiele sind gegen
das BlueJ-Projekt auf GitHub abgeglichen; die API-Hilfe enthält diese Signaturen
mit kurzen Erklärungen. Frühere BlueK-Zusätze wie `setImage`, `setLocation`,
`showWorld` und `Image()` sind entfernt. Der
[API-Abgleich](docs/blueplay-api-audit.md) hält Ausgangsfehler und Nachweise fest.
JVM-/AWT-Interna (`java.awt.Color`, Dateizugriffe) gehören nicht
dazu. Eine Grafik, die weder im Projekt noch unter den Standardgrafiken
existiert, ergibt einen Laufzeitfehler (`Image file not found: …`). Welten
erkennen ihre Actors an der Identität: Ein überschriebenes `equals` wirkt sich
weder auf `addObject`/`removeObject` noch auf Kollisionsabfragen aus.

## Dokumentation

| Datei | Inhalt |
| --- | --- |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Build-Pipeline, Befehle, Tests, Branches, Deployment-Überblick |
| [AGENTS.md](AGENTS.md) | Verbindliche Regeln für KI-Agenten (Codex, Claude) |
| [docs/architecture.md](docs/architecture.md) | Verbindliche Architektur: Zuständigkeiten, Laufzeit, Objekt- und Referenzmodell, Inspektor, Codepad, HTML-Export |
| [docs/kotlite.md](docs/kotlite.md) | Kotlite in BlueK: Upstream, Fork, Einbindung, Interpreter-Pipeline, Sprachgrenzen |
| [docs/blueplay.md](docs/blueplay.md) | BluePlay-Bibliothek, Scheduler, Rendering, Kollision, Performance, API |
| [docs/blueplay-api-audit.md](docs/blueplay-api-audit.md) | Abgleich mit der GitHub-API und dem BlueJ-Projekt; reproduzierte Abweichungen |
| [docs/kotlin-surface.md](docs/kotlin-surface.md) | Zugesagte Standardbibliothek und bekannte Lücken |
| [docs/kotlite-generics.md](docs/kotlite-generics.md) | Generics, `reified`, Inline-Lambdas und Host-Funktionen |
| [docs/regression-checklist.md](docs/regression-checklist.md) | Regressionsliste mit stabilen IDs und Prüfprotokoll |
| [docs/deployment.md](docs/deployment.md) | GitHub Actions, Server, Caddy, Share-Dienst, Beta |
| [docs/share-wordlist.md](docs/share-wordlist.md) | Herkunft der Wortliste für Kurz-Links |
| [vendor/kotlite-interpreter/PATCH.md](vendor/kotlite-interpreter/PATCH.md) | Alle Änderungen des vendorten Interpreters gegenüber Upstream |

## Lizenz und Herkunft

Kotlite stammt von [sunny-chung/kotlite](https://github.com/sunny-chung/kotlite)
(MIT, siehe `vendor/kotlite-interpreter/LICENSE`). Die Wortliste für Kurz-Links
basiert auf der EFF Large Wordlist (siehe `docs/share-wordlist.md`).
