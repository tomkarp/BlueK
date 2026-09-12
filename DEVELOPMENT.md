# BlueK – Entwicklungsstand

Der Architekturversuch läuft auf dem Branch `main`.

## Entwicklung

```sh
npm install
npm run build
npm run dev
```

Der Build erzeugt zuerst den gebündelten Kotlite-Interpreter und danach die statische Vite-Anwendung. Für einen Produktionscheck genügt ein statischer Server:

```sh
python3 -m http.server 4173 --directory frontend/dist
```

Der einzige Runtime-Ausführungspfad ist der Browser-Worker. Die langlebige Kotlite-Sitzung erhält Objektidentität und Codepad-Bindings über getrennte Eingaben hinweg; Compile, Reset und Stop beginnen mit einer neuen Sitzung beziehungsweise einem neuen Worker.

## Prüfungen

```sh
npm run browser-smoke
npm run build
```

Der Smoke-Test deckt Objektidentität, Alias-Verhalten, getrennte Instanzen, Vererbung, dynamischen Dispatch, Host-Aufrufe, BluePlay-Schritte und Klick-Rückrufe sowie Typ- und `val`-Fehler ab. Die Produktions-GUI wurde zusätzlich über einen statischen lokalen Server geöffnet und mit Compile, `main()`, Act, Run und Pause geprüft. Der gemeinsame Objektwelt-Ablauf wurde ebenfalls direkt geprüft: `Figure` und `World` wurden über Klassenkarten erzeugt, `world1.addObject(figure1, 5, 6)` im Codepad ausgeführt und `Act` bewegte denselben Actor sichtbar weiter.

## Bekannte Grenzen

Die vorhandene GUI bleibt die Basis. In diesem Versuch sind Kotlite-Ausführung, Codepad, Objektbank und der erste BluePlay-Durchstich lokal angebunden. Die Klassenkarten werden aus Kotlites AST-Manifest erzeugt; der lokale Adapter ergänzt nur GUI-spezifische geerbte Mitglieder. `readln`/`readlnOrNull`/`readLine` werden mit einer klaren Fehlermeldung abgewiesen, und BluePlay bietet noch keine vollständige API-/Medienparität. Siehe [README.md](README.md).
