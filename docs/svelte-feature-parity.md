# Svelte-Frontend

BlueK verwendet ausschließlich die Svelte-Anwendung. Entwicklung und Build
laufen direkt über die folgenden Kommandos:

```text
npm run dev
npm run build:svelte
```

Die Anwendung nutzt den zentralen `LocalRuntimeClient`, denselben Worker und
das lokale Kotlin/JS-Bundle. Compile, main, Codepad, interaktive Eingabe, EOF,
Terminalausgabe, Objektbank, Inspektion, BluePlay sowie Projekt- und
Dateifunktionen laufen über diesen gemeinsamen Runtime-Zugang.

Die Oberfläche enthält unabhängige Inspektorfenster, Konstruktor- und
Methodendialoge, pro Codepad-Objektergebnis eine eigene Get-Aktion sowie die
Ergebnisdialoge für Codepad-Ausdrücke und die BluePlay-Bilddarstellung. Der
CodeMirror-Editor bietet Zeilennummern, Kotlin-Syntaxhighlighting,
Klammermatching/-vervollständigung, aktive-Zeile-Markierung, Undo/Redo und
Suche. Es gibt keine zweite Runtime und keinen alternativen Ausführungspfad.

Add Media bleibt entsprechend der aktuellen Produktentscheidung deaktiviert.
Die Objekt-Popups trennen direkte und geerbte Methoden in ausklappbaren
Untergruppen. Compilerdiagnosen markieren Quellzeile und Spaltenposition.
Der Svelte-Build kann weiterhin nicht-blockierende Accessibility-Hinweise für
die stark interaktive Canvas-/Fensteroberfläche melden.
