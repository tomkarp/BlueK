# BlueK entwickeln

Architektur und Zuständigkeiten stehen verbindlich in
[docs/architecture.md](docs/architecture.md), Regeln für KI-Agenten in
[AGENTS.md](AGENTS.md).

## Voraussetzungen

- Node.js 22 (wie in CI)
- Java 21, nur für `npm run build:kotlite` bzw. `npm run build`
- Einmalig für GUI-Tests: `npx playwright install chromium`

## Verzeichnisse

| Pfad | Inhalt |
| --- | --- |
| `frontend/src/` | Svelte-Oberfläche, Runtime-Client, Worker, Runtime-Host, Projektformat, HTML-Export, Player |
| `frontend/public/` | statische Assets: Interpreter-Bundle (`kotlite/`, eingecheckt), Vorlagen (`examples/`), generierte Player-Vorlage (`player/`) und Offline-ZIP (`downloads/`) |
| `frontend/build/` | Vite-Plugin, das das Interpreter-Bundle für den Player gzip+base64-kodiert einbettet |
| `runtime-contract/src/index.ts` | gemeinsame Typen von Oberfläche, Worker und Runtime-Host |
| `kotlite-browser/` | Kotlin/JS-Projekt: `KotliteSession`, BlueK-Stdlib, BluePlay-Bibliothek, Fehlermeldungshilfen |
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
3. **`build:offline`** – `scripts/build-offline.mjs` baut die Anwendung mit
   `VITE_BLUEK_OFFLINE=1` und relativer Basis nach
   `dist-offline/BlueK-offline/app/`, legt Server und Startskripte dazu,
   zippt und kopiert das ZIP nach `frontend/public/downloads/`.
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
| `npm run test:offline` | baut das Offline-Paket und lädt es über dessen eigenen Server |
| `npm run test:share-server` | Share-Dienst mit temporärer Datenbank |
| `npm run test:gui` | Playwright/Chromium gegen einen eigenen Vite-Server auf Port 5194 |
| `node scripts/check-interactive-core.mjs` | Suspension bei `readln` direkt am Bundle |
| `node scripts/smoke-kotlite-browser.mjs` | Teil von `browser-smoke`; enthält u. a. die RT-37-Fälle (Eingabe in Stdlib-Lambdas, gepuffert und auf Anforderung) |
| `node scripts/benchmark-blueplay.mjs` | Tick- und Frame-Kosten des Space-Invaders-Beispiels |

GUI-Bericht: `playwright-report/`; Fehlerbilder und Traces: `test-results/`.
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
| BluePlay-API | `BluePlayLibrary.kt` (Kotlin-Quelltext der Bibliothek) und native `bluek*`-Funktionen in `KotliteSession.kt`; Darstellung in `frontend/src/bluePlayStage.ts` |
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
