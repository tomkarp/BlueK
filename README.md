# BlueK

BlueK is a browser-based Kotlin learning environment inspired by BlueJ.
Create objects, call their methods and explore their state without writing
an entire application first. Student code runs locally in your browser.

**[Open BlueK](https://bluek.de)** · **[Try the beta](https://beta.bluek.de)**

## What you can do

- Work with class diagrams, a Kotlin editor, an object bench and inspectors.
- Evaluate expressions in the codepad and run programs with terminal input/output.
- Build games with the included BluePlay library and project templates.
- Save projects as JSON, import BlueJ projects and share project links.
- Export a program as a standalone HTML page or use BlueK offline.
- Save and reload an interactive object state, record tests and run a reduced
  `kotlin.test` API. **Testing is currently in alpha.**

BlueK interprets a subset of Kotlin using an extended
[Kotlite](https://github.com/sunny-chung/kotlite) interpreter.
It does not run JVM libraries or compile student code to JavaScript.
See the [Kotlin support and limitations](docs/kotlin-support.md) before
using unfamiliar language features in lessons.

## Getting started

Open [bluek.de](https://bluek.de) and choose **New Project** to start with an
empty project or a template. Create a class, compile it and right-click its
card to create an object. Right-click the object to call a method, or
inspect it with a double-click.

Projects autosave in the browser. Use **Save / Export → Export Project JSON**
for a backup or submission; browser storage is not a reliable backup.

## Documentation

- [Using BlueK](docs/user-guide.md): projects, autosave, sharing, running and offline use.
- [Tests and saved state](docs/testing.md).
- [BluePlay](docs/blueplay.md): games, images and the supported API.
- [Terminal formatting](docs/terminal.md).
- [Kotlin support](docs/kotlin-support.md) and [standard library](docs/kotlin-surface.md).
- [Development](DEVELOPMENT.md): local setup, builds and tests.

Use **Report a problem…** in BlueK to tell the developer about bugs or missing
Kotlin support. Project attachments are optional.
For offline use, test your own projects and browser first; the offline version
has not yet been widely tested in practice.

## Credits

Kotlite is by Sunny Chung, licensed under MIT; see the
[vendored license](vendor/kotlite-interpreter/LICENSE).
Short-link words are derived from the EFF Large Wordlist;
see [attribution and curation](docs/share-wordlist.md).
