# BlueJ-Analyse und Architekturentscheidungen für BlueK

Stand: 9. September 2026. Gezielte statische Quellcodeanalyse; BlueJ wurde nicht gebaut oder ausgeführt. Keine BlueK-Laufzeit implementiert. Untersucht wurden die unten verlinkten Dateien und ihre relevanten Aufrufpfade, nicht die gesamte IDE.

## Ergebnis

BlueJs Ansatz trägt einen BlueK-PoC mit Kotlin/JVM: Ein langlebiger Benutzerprozess hält Objekte; neue interaktive Eingaben werden in kleine Hilfsklassen übersetzt und separat kompiliert. Projektkompilierung darf diese Laufzeit ersetzen. Die Oberfläche benötigt keine direkten JVM-Referenzen.

Für BlueK übernehmen wir dieses Prinzip als eigene Implementierung. Wir übernehmen weder BlueJs Java-Parser noch seine JavaFX-Oberfläche, JDI-Steuerung, Testaufzeichnung oder Greenfoot-Sonderfälle. Der JVM-Adapter bleibt hinter einer transportneutralen Schnittstelle. Ein späterer Browseradapter ist damit vorbereitbar, aber seine Machbarkeit bleibt separat nachzuweisen.

## Was im BlueJ-Code tatsächlich zu sehen ist

### 1. Interaktive Aufrufe werden kompiliert

`Invoker.writeInvocationFile` erzeugt eine Java-Hilfsklasse mit einer `run`-Methode. Die generierten lokalen Variablen holen Bench-Objekte aus einer gemeinsamen Scope-Map und versehen sie mit passenden Typen. Anschließend wird der eigentliche Aufruf eingebettet, kompiliert und über die Debugger-Abstraktion ausgeführt. Der Code berücksichtigt Rückgabewerte und zusätzlich gespeicherte Codepad-Variablen.

**Folgerung:** BlueK braucht keinen selbst gebauten Kotlin-Interpreter. Generierte Kotlin-Snippets können denselben Zweck erfüllen. Der reguläre Compiler prüft Aufrufe und Ausdrücke. Ein neues Snippet ist keine neue Projektkompilierung und leert die Bench nicht.

### 2. Codepad-Verlauf und Variablen sind verschiedene Zustände

`CodePad.executeCommand` verwendet `TextAnalyzer` für Rückgabetypen und neu deklarierte Variablen. Variablen erhalten eigene Typ- und Initialisierungsinformationen. Die Fehlerbehandlung entfernt fehlgeschlagene Deklarationen; teilweise wird mit einer anderen Ergebnisannahme erneut kompiliert. `Invoker` erzeugt außerdem Code zur Rückspeicherung lokaler Variablen, für bestimmte Pfade in einem `finally`-Block.

**Folgerung:** Eine vollständige persistente REPL ist ein eigenes Feature. Im BlueK-PoC bleiben nur Bench-Objekte zwischen Eingaben erhalten. `Evaluate` und `Run` sind explizite Modi; lokale Deklarationen gelten nur in ihrer Eingabe. Ein späterer Ausbau kann Variablen und Imports als eigenes Sitzungsmodell ergänzen. Vergangene Eingaben zur Zustandsrekonstruktion erneut auszuführen ist keine geeignete Lösung: Das würde Seiteneffekte wiederholen.

### 3. Bench und Laufzeit halten unterschiedliche Repräsentationen

`ObjectBench` verwaltet UI-Wrapper und meldet Entfernen an den Debugger. `Shell` vermittelt Scope-Zugriffe an `ExecServer`; dort liegen die echten Instanzen in Maps. Das Entfernen einer Bench-Referenz bedeutet nicht, dass das Objekt von anderen Objekten nicht mehr referenziert wird.

**Folgerung:** BlueK speichert serverseitig Objektidentität und Referenzen. Im Frontend liegen nur Handles, Namen und Typbeschreibungen. Serialisierte Eigenschaftswerte dürfen nicht die echte Objektinstanz ersetzen. Aliasing muss erhalten bleiben.

### 4. Generischer Typ ist mehr als die Laufzeitklasse

`ObjectWrapper` hält neben dem Debuggerobjekt einen `GenTypeClass`. Für Methodenmenüs werden Typvariablen auf tatsächliche Typargumente abgebildet, auch entlang der Oberklassen. Überschriebene Methoden werden abgeglichen, geerbte Methoden gruppiert. `ConstructorDialog` bietet eigene Eingaben für Typargumente.

**Folgerung:** BlueK muss beispielsweise `Box<String>` zusätzlich zur Laufzeitklasse `Box` speichern. JVM-Objekte verraten ihre konkreten generischen Argumente nicht allgemein nachträglich. Konstruktoraktionen erhalten deshalb zunächst explizite Typargumente; die daraus entstehende statische Bindung wird für Codepad-Snippets bewahrt. Deklarationstyp, Bindungstyp und Laufzeittyp nicht zu einem einzelnen Klassennamen zusammenziehen.

### 5. Projektwechsel invalidiert mehr als die Bench

`Project.removeClassLoader` entfernt Bench-Objekte, Inspector-Fenster und gecachte Klassenansichten. `clearObjectBenches` leert auch die Codepad-Auswertung. `ExecServer.newLoader` ersetzt den Benutzer-Classloader und leert die Objekt-Maps.

**Folgerung:** BlueK verwendet eine eindeutige Kompilierungsgeneration. Alle Objekt- und Methoden-Handles gehören zu genau einer Generation. Nach erneutem Projektkompilieren sind alte Handles und verspätete Antworten ungültig. Für den PoC ist ein neuer Worker einfacher als komplexes Hot-Reloading.

### 6. Laufzeitsteuerung und Benutzercode sind getrennt

`Debugger` definiert Ausführungszustände und Operationen. `JdiDebugger` und `VMReference` setzen sie JVM-spezifisch um. `ExecServer` hat einen zusätzlichen Steuerthread, der laut Codekommentar keinen Benutzercode ausführen darf, damit er nicht durch diesen blockiert wird. `VMReference.redirectToTerminal` verbindet die drei Standardstreams des Benutzerprozesses mit dem Terminal.

**Folgerung:** BlueK übernimmt die Trennung, braucht aber für den PoC keinen Debugger mit Breakpoints. Ein Worker mit separatem Steuerkanal, serieller Ausführung, gestreamten Standardstreams und Prozessabbruch genügt. Compiler oder Benutzerprogramme dürfen nicht im HTTP-Serverprozess laufen.

### 7. Inspektion sollte nicht versehentlich Programmcode ausführen

`ObjectInspector` liest über Debugger-Feldobjekte Felder und Objektverweise. Kotlin-Eigenschaften sind dagegen nicht immer einfache Felder: Ein Getter kann beliebigen Code ausführen.

**Folgerung:** Automatische BlueK-Inspektion liest vorhandene Backing Fields und stellt Referenzen begrenzt dar. Berechnete Properties erhalten eine explizite Auswertungsaktion. Auch `toString()` kann blockieren oder Zustand ändern; keine unkontrollierten Aufrufe bei automatischem Refresh.

## Festgelegte BlueK-Architektur

1. **Weboberfläche:** Dateien/Editor, Klassenkarten, Bench, Dialoge, Codepad und Konsole.
2. **RuntimeClient:** asynchrone, serialisierbare Operationen und Ereignisse; keine HTTP-, JDI- oder Classloader-Typen im Fachmodell.
3. **JvmRuntimeAdapter:** Sitzungen, offizielle Kotlin-Kompilierung, Kotlin-spezifische Metadaten, Wrappererzeugung, Prozesssteuerung.
4. **Worker pro Sitzung/Generation:** gemeinsame API, einmal geladene Projektklassen, Registry und nachgeladene Snippets.

Frontend und Worker-Objekte werden nicht gemeinsam genutzt; lediglich die JVM-Klassen innerhalb eines Workers müssen dieselbe Typidentität behalten. Bei Snippets ist der Projekt-Classloader Parent. Die gemeinsamen API-Typen kommen aus genau einem übergeordneten Loader.

### Kotlin-spezifische Analyse

Für Dateiregeln und Quellpositionen ist der Parser/PSI des offiziellen Kotlin-Compilers geeignet. Für erfolgreich kompilierte Deklarationen kommen Kotlin-Metadaten und `kotlin-reflect` infrage. Java-Reflection allein würde unter anderem Properties und synthetische JVM-Methoden unpassend darstellen. Compilerinterne APIs werden hinter einem eigenen Modul mit gepinnter Kotlin-Version gekapselt.

Die konkrete Kombination muss der erste technische Durchstich bestätigen. Metadatenextraktion ist keine vollständige semantische Analysis API. Aufrufauflösung und allgemeine Kotlin-Typprüfung bleiben beim Compiler. Generische Substitution für Anzeigen muss nachvollziehbar getestet werden; sie darf nicht zu einem konkurrierenden Typprüfer wachsen.

### Langfristiger Sprachumfang versus PoC-Bedienumfang

Kotlin/JVM übersetzt den regulären Sprachumfang. Der PoC automatisiert noch nicht jede mögliche Deklaration in Dialogen. Nicht unterstützte Dialogfälle werden ehrlich gekennzeichnet und können, soweit möglich, über das Codepad benutzt werden. Vererbung, einfache generische Klassen und Überladung werden bereits als Architekturproben umgesetzt. Kein festes Manifest für die zwei Demoklassen.

### Browseroption

Ein zukünftiger Adapter kann Compiler und Laufzeit in einem Web Worker betreiben. Er muss denselben Vertrag erfüllen, insbesondere neue Codepad-Eingaben auf bestehenden Objekten, Typinformationen und echten Abbruch. Ein WebAssembly-Compiler allein garantiert das nicht. JVM-Bibliotheken sind außerdem nicht automatisch auf einem Browserziel verfügbar. Portabler Kotlin-Code und JVM-spezifische Bibliotheksnutzung sind langfristig getrennte Fähigkeiten.

## Nicht übernehmen

- JavaFX-Widgets, BlueJ-Projektformat und Java-Sprachanalyse.
- JDI-Protokoll als öffentliche BlueK-API.
- Tests, Git, Telemetrie, Greenfoot und Desktop-Fenstersteuerung.
- Komplexe REPL-Verarbeitung bereits in der ersten Version.
- Ausführbaren BlueJ-Code: Die Analyse dient einer eigenen Implementierung. Das Repository nennt GPLv2 mit Classpath Exception; bei später beabsichtigter Codeübernahme ist dessen Lizenz konkret zu prüfen.

## Verifikation und verbleibende Risiken

Die beschriebenen BlueJ-Mechanismen sind anhand des Quellcodes belegt. Nicht verifiziert sind die konkrete Kotlin-Metadatenintegration, Wrapperkompilierung, Performance und die Browseralternative. Der Umsetzungsprompt verlangt deshalb zuerst einen echten Laufzeitdurchstich und erst danach die Oberfläche.

Erfolgsproben: dritte frei geschriebene Klasse ohne BlueK-Anpassung; getrennte Eingaben auf derselben Instanz; Objekt als Argument mit erhaltenem Aliasing; generischer Typ in Bench und Codepad; dynamischer Dispatch; korrekte Überladung; interaktives stdin; Abbruch; Invalidierung alter Handles.

## Quellverweise

Untersuchte Revision: `bf11ce44a6dcb866921485dd43fb31411dc32937`. Die Links sind auf diese Revision fixiert.

- [Invoker](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugmgr/Invoker.java#L688)
- [CodePad](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugmgr/codepad/CodePad.java#L1085)
- [CodePad Fehlerbehandlung](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugmgr/codepad/CodePad.java#L880)
- [Shell](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/runtime/Shell.java#L45)
- [ExecServer Registry und Classloader](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/runtime/ExecServer.java#L381)
- [ExecServer Steuerthread](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/runtime/ExecServer.java#L218)
- [ObjectBench](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugmgr/objectbench/ObjectBench.java#L153)
- [ObjectWrapper Typinformationen](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugmgr/objectbench/ObjectWrapper.java#L130)
- [ObjectWrapper Methodenmenüs](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugmgr/objectbench/ObjectWrapper.java#L482)
- [ConstructorDialog](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugmgr/ConstructorDialog.java#L145)
- [ObjectInspector](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugmgr/inspector/ObjectInspector.java#L290)
- [Debugger](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugger/Debugger.java#L40)
- [JdiDebugger](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugger/jdi/JdiDebugger.java#L50)
- [VMReference Konsole](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/debugger/jdi/VMReference.java#L512)
- [Project Reset](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/bluej/src/main/java/bluej/pkgmgr/Project.java#L1705)

Weitere Referenzen:

- [BlueJ-Lizenz](https://github.com/k-pet-group/BlueJ-Greenfoot/blob/bf11ce44a6dcb866921485dd43fb31411dc32937/LICENSE.txt)
- [Kotlin Reflection](https://kotlinlang.org/docs/reflection.html)
- [Kotlin Generics und Type Erasure](https://kotlinlang.org/docs/generics.html)
- [Kotlin JVM Metadata](https://kotlinlang.org/docs/metadata-jvm.html)
