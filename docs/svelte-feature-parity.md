# Svelte-Frontend lokal testen

BlueK kann für einen lokalen Vergleich mit dem Svelte-Frontend gestartet werden:

```text
npm run dev:svelte
```

Danach ist die Anwendung unter `http://127.0.0.1:5173/` erreichbar (oder unter dem
freien Port, den Vite ausgibt). Das Kommando verwendet dieselbe zentrale
`LocalRuntimeClient`-Fassade und denselben Worker wie das React-Frontend. Dadurch
werden Compile, main, Codepad, interaktive Eingabe, EOF, Terminalausgabe,
Objektbank, Inspektion, BluePlay und Projekt-/Dateifunktionen mit derselben
Interpreter-Session ausgeführt.

Der Umschalter erfolgt ausschließlich über `VITE_FRAMEWORK=svelte`; der normale
`npm run dev`- und Build-Pfad bleibt React. Die Svelte-Implementierung ist damit
lokal testbar, ohne die produktive React-Oberfläche oder den GitHub-Pages-Pfad zu
verändern. Add Media bleibt entsprechend der aktuellen Produktentscheidung
deaktiviert.

Die lokale Vorschau enthält außerdem unabhängige Inspektorfenster, Konstruktor-
und Methodendialoge, pro Codepad-Objektergebnis eine eigene Get-Aktion sowie die
Ergebnisdialoge für Codepad-Ausdrücke und die BluePlay-Bilddarstellung. Die
Der CodeMirror-Editor bietet dabei ebenfalls Zeilennummern, Kotlin-
Syntaxhighlighting, Klammermatching/-vervollständigung, aktive-Zeile-Markierung,
Undo/Redo und Suche. Die Implementierung verwendet weiterhin bewusst keine
zweite Runtime oder einen alternativen Ausführungspfad.

Die Objekt-Popups trennen direkte und geerbte Methoden wie die React-Version;
geerbte Methoden werden in ausklappbaren Untergruppen angezeigt. Auch die
Compilerdiagnose markiert Quellzeile und Spaltenposition. Der Svelte-Build
meldet weiterhin nicht-blockierende Accessibility-Warnungen für die bewusst
stark interaktive Canvas-/Fensteroberfläche.
