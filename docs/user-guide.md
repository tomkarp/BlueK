# Using BlueK

[Back to the overview](../README.md)

## Built-in manual

The **Help** icon at the bottom left opens the bundled user manual. Choose a
section for quick start, objects/codepad, projects/saving, saved state, testing,
Kotlin compatibility, BluePlay, keyboard shortcuts or troubleshooting. The
contents are available offline; links to GitHub require internet. Shortcuts
show Cmd on macOS and Ctrl elsewhere. Long sections scroll within the dialog,
leaving Close available.

## Interface language

Choose **English** or **Deutsch** in **Settings → Language**. BlueK uses the
browser language when supported, otherwise English, and remembers an explicit
choice in this browser. Kotlin code,
program output and compiler/runtime errors keep their original text.

## Projects and editing

**New Project** offers an empty project, BluePlay templates and demo projects.
Each Kotlin file contains either one class, interface or enum, or top-level
functions and properties. Inheritance appears as arrows in the diagram.
A project can also have a name and a README note.

The editor supports Kotlin syntax highlighting, formatting, tabs, windows,
font settings, dark mode and an optional Vim mode. Formatting runs locally.
Compile errors point to the relevant file and source position.

Right-click a class to create an instance. Right-click an object on the bench
to call its methods; double-click to inspect it. Inspectors evaluate getters
when opened or refreshed, so a getter can have effects or report an exception.
Following a stored object reference does not create a new object.

The codepad accepts expressions and statements. Variables remain available
until Compile or Reset. Use **Get** on a result to put it on the object bench.
The terminal supports `print`, `println`, `readln`, `readLine` and
`readlnOrNull`, including waiting for input, EOF and Stop.
See [terminal formatting](terminal.md) for colors and control sequences.

## Compile, main and Reset

**Compile** starts a fresh interpreter session, checks all files together and
runs top-level property initializers once. It clears previous interactive
objects and variables. Codepad operations compile on demand.

A functions file may contain `fun main()` or `fun main(args: Array<String>)`.
The latter receives an empty array. The filename does not have to be `Main.kt`.

- With one entry point, **Start main** starts it immediately.
- With several, **Choose main** asks for the file on each invocation.
  **Cancel** or Escape executes nothing; the selection is not saved.
- With none, **Start main** is disabled. A class method is not an entry point.
- A functions card's context menu can start its own `main` directly.

**Reset** recompiles an ordinary project. In BluePlay, Reset calls the selected
`main` again in the existing session; top-level properties are not initialized
again. **Stop** terminates execution even in an endless loop.
Ordinary uncaught program exceptions end the current call, leaving existing
objects usable and retaining changes already made. Interpreter faults require
Reset or Compile.

## Autosave and recent work

Each tab has an independent working draft. Reloading restores that tab's draft.
Edits and project changes within the same tab update one saved entry; there is
no history entry for every keystroke. Different tabs do not overwrite each
other's projects. Duplicated tabs get independent drafts when the browser
supports Web Locks; the fallback may create an additional entry on restoration.

A fresh start shows a dismissible notice if saved projects exist.
**Open / Import → Recent work** reopens them, including source, resources,
README, card positions and the default state class. The object bench itself
is restored only through [Load state](testing.md#saved-state).

Use the trash icon beside a saved project, or **Delete all**, to remove browser
copies after confirmation. This keeps settings and does not close open projects.
An unchanged open project does not recreate its deleted copy; editing it does.

Drafts have no BlueK expiry date. Browser cleanup, private browsing, storage
limits and browser policies can remove them. Browser session restoration also
determines which tabs return after reopening the browser. Export JSON for work
you need to retain.

## Import, export and links

**Open / Import** accepts `.bluek.json` files and BlueJ projects as ZIPs or
folders. Historical BluePlay framework files are replaced by the built-in
library when applicable; Kotlin files, card positions, images and sounds are
imported. Java source is not interpreted.

**Save / Export** offers:

- **Copy Full Project Link**: the complete project is encoded in the URL.
- **Copy Short Link**: the optional share service stores the project for 30 days.
  Anyone with the link can open it.
- **Export Project JSON**: a reusable `.bluek.json` file.
- **Export as HTML (Beta)**: a standalone program page with the runtime embedded.
  It requires a supported `main` and runs without a server or network.
- **Export BlueJ Project (.zip)** is not implemented yet.

The two link actions share **Open README** and **Load state** options.
Load state requires a default test class and automatically restores its state
on opening the link. Both options can be selected together.
Regular JSON imports and autosave restoration do not automatically load state.

After importing a link, BlueK removes the project payload from the address bar.
Reload then restores your own draft. To return to the original assignment,
explicitly open the original link again; this replaces the current tab's draft.

## Offline use

The download icon at the bottom left, below the testing area, opens instructions first.
Choose **Download ZIP**, extract it and open **BlueK.html** in a recent desktop
browser. No installation, server, Node.js or Python is needed.

The editor, interpreter, BluePlay images, templates, formatter and HTML export
are embedded. Short links require the online service and are hidden offline.
Full project links point to the online BlueK site; opening them needs internet.

The offline version has not yet been widely tested in practice. Test your own
projects and browser before relying on it. Browser autosave may depend on the
location of BlueK.html; moving the file can make previous drafts unavailable.
Use JSON export for submissions and backups.

[Report a bug on GitHub](https://github.com/tomkarp/BlueK/issues/new)
when online. Package instructions: [offline README](../scripts/offline/LIESMICH.txt).
