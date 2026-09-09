# BlueK

BlueK is a local Kotlin/JVM proof of concept inspired by BlueJ's object bench. The frontend knows only the serializable runtime contract; the server compiles project sources with `kotlinc` and delegates live objects to one long-lived JVM worker per session. Objects are held as opaque handles in the worker, so an action operates on the same instance.

## Run

Requirements: Node 22, Java 21, Kotlin/JVM 2.2.21. Install dependencies and start the app:

```sh
npm install
kotlinc jvm/src/main/kotlin/de/tomkarp/bluek/*.kt -include-runtime -d jvm/worker.jar
npm run build
node server/dist/server/src/index.js
```

Open http://localhost:5173. The example files are editable and are compiled together. A class card can be right-clicked after compiling; the first method on a bench object is invoked by clicking it. The code pad and console are intentionally compact in this first cut.

For the local PoC use `npm start` in a terminal and stop it with `Ctrl+C`.

## First technical slice

The worker has a separate process, a generation load operation, an object registry keyed by opaque UUIDs, reflection-based constructor/method dispatch, field-only inspection, scalar/null/object result variants, and process isolation from the HTTP server. The Kotlin compiler is the source of truth for project syntax and type checking. The JVM module uses package `de.tomkarp.bluek` and Kotlin 2.2.21 on JDK 21.

The current implementation proves compilation, dynamic construction, identity-preserving worker storage, method dispatch, field inspection and compiler-backed expression/block snippets. The UI and transport are deliberately a PoC: method argument forms, stdin control, stop, richer Kotlin metadata (including generic substitution and inherited-callable grouping), diagnostics positions, WebSocket streaming and full generation invalidation remain the next implementation slice. No browser JVM or interpreter is used.

This is for trusted local code only. A separate process is not a sandbox; public multi-user execution needs OS/container isolation, resource limits and a stronger control protocol.
