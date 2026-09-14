# Plan: echte interaktive Ausführung

## Ausgangsbefund

Der aktuelle Kotlite-Evaluator wertet AST-Knoten synchron über `eval()` aus.
Benutzerfunktionen, `CallableNode.execute`, Lambdas und Bibliotheks-Callbacks
verwenden dieselbe synchrone Aufrufkette. `KotliteSession` puffert Eingabezeilen;
ein leerer Puffer ist derzeit Fehler beziehungsweise `null`. Der Browser-Worker
serialisiert alle Nachrichten über eine Promise-Kette und kann deshalb während
einer laufenden Ausführung keine Eingabeantwort verarbeiten.

## Umsetzungsetappen

1. Einen kleinen, interpreterunabhängigen Host mit Ausgabe, suspendierbarem
   Zeilenlesen/EOF und kooperativen Checkpoints einführen. Den gemeinsamen
   Evaluator schrittweise auf eine suspendierbare Aufrufkette erweitern, ohne
   eine zweite Ausführung oder Replay-Logik zu bauen.
2. Stdlib-Callbacks, Ausgabeereignisse und interne Cancellation an die neue
   Kette anschließen; Checkpoints an Aufruf- und Schleifengrenzen geben an den
   Browser-Event-Loop ab.
3. Kotlin/JS-Fassade und Worker-Protokoll trennen: Start, Ereignisse,
   Eingabeantwort, Abbruch und passive Inspektion erhalten eigene Nachrichten
   sowie Generation-, Ausführungs-, Request- und Input-IDs.
4. `LocalRuntimeClient`, `RuntimeHost` und die UI auf `waitingForInput`,
   ereignisbasierte Ausgabe und sichere verspätete/doppelte Antworten umstellen.
5. Kontrollierte Kotlite-/Runtime-Tests und echte Browser-Smoke-Prüfungen für
   Eingabe, Verschachtelung, Lambdas, Kontrollfluss, EOF, Stop und Generationen
   ergänzen; Bundle neu bauen und Dokumentation/README aktualisieren.

## Abnahmeregel

Ein Zwischenstand gilt nicht als fertig, solange nur das einfache `main`-
Beispiel funktioniert. Nicht erfüllte Pflichtfälle und unabhängige
Interpreterfehler werden explizit dokumentiert.

## Umgesetzter Stand

Die Etappen sind im BlueK-Worker umgesetzt und durch Bundle-, Runtime-State-
und Browser-Smokes abgedeckt. `waitingForInput` suspendiert dieselbe laufende
Continuation; Zeile, leerer String und EOF werden getrennt behandelt. Der
Worker verarbeitet Eingabeantworten neben der suspendierten Ausführung,
verwirft alte Generationen/Request-IDs und kann beim Stop den Worker beenden.
Schleifen besitzen zusätzlich einen hostseitig konfigurierten kooperativen
Checkpoint, der im Browser über `setTimeout(0)` zur Event-Schleife zurückkehrt.
