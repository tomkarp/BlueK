# BlueK – Entwicklungsstand

Der Architekturversuch läuft auf dem Branch `codex/architecture-experiment`.

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

Der Smoke-Test deckt Objektidentität, Alias-Verhalten, getrennte Instanzen, Vererbung, dynamischen Dispatch, Host-Aufrufe sowie Typ- und `val`-Fehler ab. Die Produktions-GUI wurde zusätzlich über einen statischen lokalen Server geöffnet und mit Compile sowie drei getrennten Codepad-Eingaben geprüft.

## Bekannte Grenzen

Die vorhandene GUI bleibt die Basis. In diesem Versuch sind Kotlite-Ausführung, Codepad und Objektbank lokal angebunden. Die Klassenkarten-Metadaten sind noch eine begrenzte Quelltextableitung, die Konsoleneingabe ist nicht unterstützt, und die bestehende BluePlay-Darstellung ist noch nicht mit einer Kotlite-Host-Bridge verbunden. Siehe [README.md](README.md).
