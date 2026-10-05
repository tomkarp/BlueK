# BlueK entwickeln

Architektur und Zuständigkeiten stehen verbindlich in
[docs/architecture.md](docs/architecture.md), Regeln für KI-Agenten in
[AGENTS.md](AGENTS.md).

## Voraussetzungen

- Node.js 22 (wie in CI)
- Java 21, nur für `npm run build:kotlite` bzw. `npm run build`
- Einmalig für GUI-/Offline-Tests: `npx playwright install chromium webkit`

## Verzeichnisse

| Pfad | Inhalt |
| --- | --- |
| `frontend/src/` | Svelte-Oberfläche, Runtime-Client, Worker, Runtime-Host, Projektformat, HTML-Export, Player |
| `frontend/src/components/` | Darstellung von Fenstern, Dialogen, Diagramm und Hauptbedienelementen; typisierte Props und Rückruffunktionen |
| `frontend/src/workspace/` | reaktive Svelte-Controller mit eigenem UI-Zustand für Projekt, Editor, Ausführung, Objekte, BluePlay und Terminal; Verdrahtung in `SvelteApp.svelte` |
| `frontend/public/` | statische Assets: Interpreter-Bundle (`kotlite/`, eingecheckt), Vorlagen (`examples/`), generierte Player-Vorlage (`player/`) und Offline-ZIP (`downloads/`) |
| `frontend/build/` | Build-Helfer für einzelne HTML-Dateien und das gzip+base64-Interpreter-Bundle |
| `runtime-contract/src/index.ts` | gemeinsame Typen von Oberfläche, Worker und Runtime-Host |
| `kotlite-browser/` | Kotlin/JS-Projekt: `KotliteSession`, BlueK-Stdlib, BluePlay-Bibliothek und -Engine, Fehlermeldungshilfen |
| `vendor/kotlite-interpreter/` | Quellstand des Kotlite-Interpreters mit allen BlueK-Änderungen (siehe `PATCH.md`) |
| `jvm/` | nur noch der Gradle-Wrapper (Gradle 8.14.1); der Name ist historisch |
| `assets/standard-images/` | BluePlay-Standardgrafiken (Quelle für `standardImages.generated.ts`) |
| `scripts/` | Build-Skripte, Node-Smoke-Tests, Benchmark, Dateien des Offline-Pakets (`offline/`) |
| `tests/gui/` | Playwright-Tests im echten Chromium |
| `server/` | optionaler Share-Dienst für Kurz-Links |
| `data/` | Wortliste des Share-Diensts |
| `examples/` | Kotlin-Quelltexte als Testeingaben (u. a. historische BluePlay-Frameworkdateien für `smoke-blueplay-browser`) |

## Build-Pipeline

Kotlin-Schülercode wird nie kompiliert. Gebaut werden nur die Werkzeuge, die
ihn im Browser interpretieren, und die Oberfläche. Eine grafische Übersicht mit
allen Schritten steht in [docs/architecture.md](docs/architecture.md#build).

`npm run build` führt nacheinander aus:

1. **`build:kotlite`** – `./jvm/gradlew -p kotlite-browser jsBrowserProductionWebpack`.
   Der Kotlin-Multiplatform-Compiler (Plugin 2.2.21, Ziel JS IR) übersetzt
   `kotlite-browser` und über einen Gradle-Composite-Build
   (`includeBuild("../vendor/kotlite-interpreter")`) den vendorten Interpreter
   nach JavaScript. Die Maven-Koordinate
   `io.github.sunny-chung:kotlite-interpreter` wird dabei durch den
   vendorten Quellstand ersetzt – auch als transitive Abhängigkeit der
   binär von Maven Central geladenen `kotlite-stdlib` 1.1.0. Webpack bündelt
   alles zu `bluek-kotlite-browser.js` (~950 KB) und kopiert es nach
   `frontend/public/kotlite/`. Das Bundle ist eingecheckt; `npm run dev` und
   alle Node-Smokes verwenden es direkt ohne Gradle.
2. **`build:player`** – `scripts/build-player.mjs` baut mit Vite zwei
   IIFE-Skripte (Player-Worker mit eingebettetem gzip+base64-Interpreter und
   Player-Oberfläche) und schreibt sie inline in
   `frontend/public/player/bluek-player.html` (generiert, nicht eingecheckt).
3. **`build:offline`** – `scripts/build-offline.mjs` baut die Svelte-IDE als
   IIFE mit `VITE_BLUEK_OFFLINE=1`. Es bettet CSS, den Blob-Worker mit
   gzip+base64-Interpreter, die Player-Vorlage und das zur Build-Zeit aus
   Brotli entpackte und neu gzip-komprimierte Formatter-WASM ein.
   Projektvorlagen sind eingebettete JSON-Daten. Ergebnis:
   `dist-offline/BlueK-offline/BlueK.html`, direkt per Doppelklick ausführbar.
   Ein ZIP aus HTML und Anleitung wird nach `frontend/public/downloads/`
   kopiert; Server und Startskripte entfallen.
4. **`vite build`** – kompiliert Svelte 5 und TypeScript nach
   `frontend/dist/`: Hauptbundle, Runtime-Worker als Modul-Worker, ktfmt-WASM
   und alle Dateien aus `frontend/public/`.

Getrennt und nur bei Bedarf: `npm run build:standard-images` erzeugt aus
`assets/standard-images/*.png` das eingecheckte Modul
`frontend/src/standardImages.generated.ts` (Data-URLs samt Alpha-Masken).
Nach dem Hinzufügen oder Entfernen einer Grafik erneut ausführen.

`npm run dev` startet Vite auf Port 5173 und leitet `/api` an
`127.0.0.1:8787` weiter. Vorher erzeugt `predev` die Player-Vorlage, falls
sie fehlt oder älter als das Interpreter-Bundle ist, und das Offline-ZIP,
falls es fehlt.
Einen Produktionsbuild prüft man mit einem beliebigen statischen Server, etwa
`python3 -m http.server 4173 --directory frontend/dist`.

## Tests

Nach Kotlin-Änderungen zuerst `npm run build:kotlite`: Node-Smokes,
Runtime-State-Tests und GUI-Tests verwenden das gebaute Bundle unter
`frontend/public/kotlite/`.

| Befehl | Prüft |
| --- | --- |
| `npm run test:regression` | Sammellauf: Typecheck, UI-Helfer, Runtime-State, Referenzen, Kotlin-Oberfläche, Inspektor, BluePlay-Stage, Projekt- und Exportformat, Player-Worker, Codepad-Ablauf, Offline-Paket und alle GUI-Tests |
| `npm run typecheck` | `tsc` und `svelte-check` (nur Fehler brechen ab) |
| `npm run browser-smoke` | Architekturregeln (statisch), Kotlite-Bundle, BluePlay-Runtime, Curriculum-Kotlin und Runtime-State |
| `npm run test:runtime-state` | echter Client und Host mit dem gebauten Bundle und Worker-Ersatz: Identität, passive Inspektion, Phasen, Eingabe, konkurrierende Befehle, veraltete Antworten |
| `npm run test:references` | Referenz- und Erreichbarkeitsmodell direkt an der Session |
| `npm run test:generics` | Generics, `reified`, Inline-Lambdas, Analysegrenzen |
| `npm run test:kotlin-surface` | zugesagte Stdlib-Oberfläche und bekannte Lücken (siehe `docs/kotlin-surface.md`) |
| `npm run test:blueplay-demos` | Space-Invaders-Vorlage im Interpreter |
| `npm run test:inspector`, `test:codepad-flow`, `test:project-format`, `test:program-export`, `test:blueplay-stage`, `test:player-worker`, `test:ui` | einzelne TypeScript-Module ohne Browser |
| `npm run test:window-interaction` | gemeinsame Fenstergeometrie, Mindestgrößen, Pointer-Abbruch und Titelzeilen-Buttons; auch Teil von `test:regression` |
| `npm run test:workspace` | echte kompilierte Svelte-Controller: klonbare Aufrufargumente, unabhängige App-Instanzen und verworfene Aufrufergebnisse nach Generationswechsel; auch Teil von `test:regression` |
| `npm run test:offline` | baut und prüft HTML/ZIP; echte Chromium-/WebKit-Tests über `file://` ohne Webserver und mit gesperrtem HTTP-Netzwerk |
| `npm run test:share-server` | Share-Dienst mit temporärer Datenbank |
| `npm run test:gui` | Playwright/Chromium gegen einen eigenen Vite-Server auf Port 5194 |
| `node scripts/check-interactive-core.mjs` | Suspension bei `readln` direkt am Bundle |
| `node scripts/smoke-kotlite-browser.mjs` | Teil von `browser-smoke`; enthält u. a. die RT-37-Fälle (Eingabe in Stdlib-Lambdas, gepuffert und auf Anforderung) |
| `npm run test:performance` | Laufzeit des Interpreters (Rekursion, Schleifen, Objekte, Lambdas, Zeichenketten, Compile) gegen Grenzwerte (PERF-06); auch Teil von `test:regression`. Mit `BLUEK_BUNDLE=… node scripts/benchmark-interpreter.mjs --report` lässt sich ein anderes Bundle vergleichen |
| `node scripts/benchmark-blueplay.mjs` | Tick- und Frame-Kosten des Space-Invaders-Beispiels und ihr Wachstum mit vielen Schüssen (0–400) |

GUI-Bericht: `playwright-report/`; Fehlerbilder und Traces: `test-results/`.

**Profilieren.** Das eingecheckte Bundle ist minifiziert. Für lesbare
Funktionsnamen im CPU-Profil `./jvm/gradlew -p kotlite-browser
jsBrowserDevelopmentWebpack` bauen (bleibt unter `kotlite-browser/build/`)
und den Benchmark damit profilieren:
`BLUEK_BUNDLE=kotlite-browser/build/kotlin-webpack/js/developmentExecutable/bluek-kotlite-browser.js node --cpu-prof scripts/benchmark-blueplay.mjs`.
Die Datei `*.cpuprofile` lässt sich in den Chrome DevTools (Performance)
öffnen.
Welche Tests zu welcher Regression gehören und was zuletzt tatsächlich lief,
steht in [docs/regression-checklist.md](docs/regression-checklist.md).

## Wo wird was geändert?

| Änderung | Ort |
| --- | --- |
| fehlende Stdlib-Funktion | `kotlite-browser/.../BlueKStdlibModule.kt` (nativ), dazu `docs/kotlin-surface.md` und `scripts/smoke-kotlin-surface.mjs` |
| Stdlib-Funktion verhält sich anders als Kotlin oder muss suspendieren können | `environment.patchFunction` in `KotliteSession.resetInterpreter` (Beispiele: `count`, `removeAll`, `substring`) |
| Sprachsemantik, Parser, Analyse, Interpreter | `vendor/kotlite-interpreter/`, Eintrag in `PATCH.md` |
| Session: Laden, Codepad, Objektbank, Inspektion, Eingabe | `kotlite-browser/.../KotliteSession.kt` |
| Befehle und Snapshot zwischen UI und Worker | `runtime-contract/src/index.ts`, `frontend/src/runtimeHost.ts`, `frontend/src/localRuntimeClient.ts` |
| BluePlay-API | `BluePlayLibrary.kt` (Kotlin-Quelltext der Bibliothek) und native `bluek*`-Funktionen in `BluePlayEngine.kt` (Bildgeometrie: `BluePlayDrawing.kt`); Darstellung in `frontend/src/bluePlayStage.ts`, Takt in `frontend/src/simulationTimer.ts` |
| Oberfläche | `frontend/src/SvelteApp.svelte` und die dort genutzten Module |

Bei jeder Änderung an GUI- oder Laufzeitverhalten wird
`docs/regression-checklist.md` mitgepflegt (siehe AGENTS.md).

## Branches und Deployment

- `main` → <https://bluek.de> und GitHub Pages
- `beta` → <https://beta.bluek.de>

Jeder Push löst den passenden Workflow unter `.github/workflows/` aus; der
Build läuft dort vollständig neu (Java 21, Node 22, `npm ci`,
`npm run build`). Einrichtung von Server, Caddy und Share-Dienst:
[docs/deployment.md](docs/deployment.md).

### BluePlay-API-Abgleich

`npm run test:blueplay-api` vergleicht öffentliche Signaturen und das erzeugte
Hilfemanifest mit dem festgehaltenen BlueJ-Projekt in
`tests/fixtures/blueplay-reference/`. Es prüft gültige und ungültige Aufrufe,
benannte Argumente, originale Schülerdateien, Objektlebensdauer und Bildkopien.
Der Test gehört zu `browser-smoke` und `test:regression`.
`npm run build:kotlite` erzeugt nach dem Bundle auch
`frontend/src/bluePlayApi.generated.json`; beide Dateien gemeinsam aktualisieren.
