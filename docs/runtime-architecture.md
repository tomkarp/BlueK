# Runtime-Architektur nach dem Umbau

Stand: 14. September 2026. Dieser Umbau betrifft Zustandsführung und
Ausführungsgrenzen. Er ist keine Zusage vollständiger Kotlin- oder BluePlay-Parität.

## Zuständigkeiten

```text
Codepad / Konstruktor / Methodenmenü / Inspektor / main
                         |
                 LocalRuntimeClient
           ein beobachtbarer RuntimeSnapshot
                         |
                    Web Worker
                         |
                    RuntimeHost
                         |
                   KotliteSession
                         |
              ein lebender Interpreter
```

- `runtime-contract/src/index.ts`: gemeinsame Befehle, Antworten, Typen,
  Metadaten und Sitzungszustände. Es gibt keinen parallelen HTTP-Vertrag mehr.
- `frontend/src/localRuntimeClient.ts`: einziger Zugang für Befehle und
  Lebenszyklus. Besitzt Worker, ausstehende Anfragen und den Snapshot.
- `frontend/src/localRuntimeWorker.ts`: lädt das lokale Bundle, transportiert
  Nachrichten und serialisiert deren Bearbeitung; enthält keine Sprachlogik.
- `frontend/src/runtimeHost.ts`: übersetzt Befehle in die explizite
  `KotliteSessionBridge`, sammelt Ausgaben und passive Inspektionen und liefert
  danach einen zusammenhängenden Snapshot zurück.
- `frontend/src/runtimeMetadata.ts`: gruppiert das Kotlite-Manifest für die
  Klassenkarten. Keine Quelltext-RegEx als Ersatz für fehlende Typinformationen.
- `kotlite-browser/.../KotliteSession.kt`: hält Interpreter, Quelltext der Sitzung,
  Eingabepuffer und kanonische Objektverweise. Alle Ausführungswege benutzen
  denselben Analyse-/Auswertungspfad.
- `vendor/kotlite-interpreter/.../ReplAnalyzer.kt`: Kotlite-seitiger Einstieg für
  die Analyse einer fortlaufenden Sitzung.

React hält Projektdokumente, Fensterpositionen, Auswahl, Dialogentwürfe,
Ausgabehistorie und Objektbank-Beschriftungen. Klassenmetadaten, Laufzustand und
Inspektorwerte kommen aus dem Snapshot über `useSyncExternalStore`. Der Inspektor
hält keine zweite veränderliche Kopie der Objektfelder.

## Zustands- und Fehlerregeln

| Zustand | Bedeutung |
| --- | --- |
| `uncompiled` | Keine ausführbare Sitzung. |
| `compiling` | Neuer Worker lädt und analysiert das Projekt. |
| `ready` | Ein neuer Befehl ist möglich. |
| `running` | Ein Befehl läuft; konkurrierende Benutzerbefehle werden abgewiesen. |
| `waitingForInput` | Eine laufende Ausführung ist an einer offenen Eingabe suspendiert; die Sitzung bleibt aktiv und wartet auf Zeile oder EOF. |
| `faulted` | Laufzeit-/Transportfehler: Reset oder Compile erforderlich. |

Compile ersetzt Worker und Generation. Reset kompiliert den zuletzt an den
Client übergebenen Projektstand neu; Stop beendet den Worker. Quelltextänderungen
invalidieren die Sitzung. Generationswechsel verwerfen offene Anfragen und
verspätete Antworten. Die UI verwirft dazugehörige Dialoge und Objektverweise.

Analysefehler führen nicht zur Ausführung und lassen eine bereits gültige Sitzung
weiter benutzbar. Laufzeitfehler können bereits Seiteneffekte verursacht haben:
Sie sperren deshalb die Sitzung. Das ist **kein Rollback**. Bereits beobachtbare
Backing-Felder können noch passiv inspiziert werden. Es gibt keine Wiederholung
des fehlgeschlagenen Aufrufs und keine Reparatur anhand seiner Ausgabezeichenkette.

Beim Laden werden auch Top-Level-Initialisierungen ausgeführt. Spätere Eingaben
werden im Kontext des bisherigen Quelltexts analysiert; ausgeführt werden nur
Knoten im neuen Quelltextintervall, nicht erneut frühere Initialisierungen.

## Objektidentität und Inspektor

Ein Objekt hat innerhalb einer Generation einen kanonischen Handle. Konstruktor,
Methodenrückgabe, Codepad und Alias zeigen auf dieselbe Kotlite-Instanz. Ein Name
aus dem Get-/Objektbank-Dialog wird als echtes Kotlin-Binding angelegt.

Remove entfernt nur die Darstellung aus der Objektbank. Es löscht weder die
Instanz noch Variablen im Schülerprogramm. Handles und Bindings leben bis zum
Sitzungswechsel. Das vermeidet ungültige Verweise aus anderen Objekten oder
offenen Inspektoren, kann aber bei langen Sitzungen Speicher kosten.

Inspektion liest ausschließlich Backing-Felder. Berechnete Properties werden als
`<computed>` angezeigt; ihre Getter laufen nicht automatisch beim Öffnen oder
Aktualisieren des Inspektors. Ein expliziter Property-Zugriff ist ein normaler
Runtime-Befehl. Feldänderungen laufen ebenfalls als Befehl und adressieren den
Handle des betreffenden Fensters. Typinformationen stammen aus Kotlite, nicht
aus dem Format des angezeigten Werts.

## Bewusste Einschränkungen und verbleibende Architekturarbeit

1. **Eingaben:** Der Kotlite-Kern besitzt jetzt eine suspendierbare Auswertung,
   eine Continuation-basierte Eingabewarteposition und getrennte Zeilen-/EOF-
   Fortsetzung. Die JS-Worker-Fassade und der Client verwenden diese API noch
   nicht durchgängig; der produktive UI-Weg bleibt daher bis zur Fertigstellung
   der Ereignis-/Worker-Integration auf dem bisherigen synchronen Pfad.
2. **Vorwärtsreferenzen:** `ReplAnalyzer` kapselt vorerst den vorhandenen
   Analyse-Wiederholungsmechanismus auf frischen ASTs. Er erkennt fehlende
   Deklarationen noch anhand von Fehlermeldungen. Das ist verbleibende technische
   Schuld, keine endgültige Zwei-Pass-Symbolanalyse. Es wird dabei nie Schülercode
   erneut ausgeführt. Die endgültige Lösung gehört in Kotlite.
3. **Inkrementelle Analyse:** Der gesamte bisherige Quelltext wird neu analysiert.
   Eine echte inkrementelle Symboltabelle/REPL-Schnittstelle ist spätere
   Kotlite-Arbeit. Laufzeitfehler sind bis dahin absichtlich nicht wiederaufnehmbar.
4. **Metadaten:** Generische Oberklassentypen und ihre Spezialisierung müssen noch
   umfassender geprüft werden. Einige ältere UI- und BluePlay-Datenstrukturen
   sind weiterhin dynamisch typisiert; der Runtime-Befehlsweg ist jetzt typisiert.
5. **BluePlay:** Keine Erweiterung der API oder vollständige Prüfung in diesem
   Auftrag. Die Steuerung bleibt angebunden; schnelle Tastaturereignisse bei
   laufendem Befehl benötigen noch einen gesonderten Input-Snapshot-Entwurf.
6. **UI-Struktur:** `main.tsx` ist weiterhin groß. Eine weitere Aufteilung in
   Ansichts-Komponenten ist möglich, darf aber keine neuen Objektzustandskopien
   oder Interpreter-Zugänge schaffen.

## Prüfungen und Übergabe

```sh
npm run typecheck
npm run build
npm run test:runtime-state
npm run browser-smoke
```

`test:runtime-state` verwendet den tatsächlichen Client, Host und Kotlin/JS-Bundle
mit einem kontrollierten Worker-Ersatz. Es prüft Objektidentität über mehrere
Zugriffswege, passive Getter, Top-Level-Initialisierung, wiederholtes `main`,
Eingabepuffer, Fehlerzustände, Reset, konkurrierende Befehle und alte Antworten.
Es ersetzt keinen Test mit echten Browser-Workern und Mausklicks.

Die Kern-Compilation und das Bundle bauen erfolgreich. Die breitere funktionale
Abnahme bleibt offen, bis der Worker die aktive Ausführung auch während
`waitingForInput` weiter bedienen kann:

- Im Browser Instanzen per Konstruktor erstellen und danach weitere Methoden
  und Konstruktoren anklicken; keine blockierten Dialoge.
- Ein Objekt über Codepad, Methoden und `main` verändern und dieselben Werte in
  mehreren Inspektorfenstern beobachten; im jeweils richtigen Fenster editieren.
- Objekt- und Alias-Rückgaben mit Get auf die Bank holen; Identität erhalten.
- Remove, Stop, Reset, erneutes Compile und Quelltextänderungen prüfen.
- Private Properties, berechnete Getter, Generics, Vererbung und verschiedene
  Rückgabetypen testen. Private Zugriffe werden teils erst zur Laufzeit abgelehnt.
- Gepufferte Eingaben, leeren Puffer und Ausgabe vor Fehlern testen. Keine
  automatische Wiederholung erwarten. Spielbarkeit erst nach echter Kotlite-
  Fortsetzungsunterstützung erneut als Anforderung abnehmen.
