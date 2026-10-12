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
choice in this browser. Dark mode, editor font size and Vim mode are also saved
in this browser and restored when BlueK opens. Kotlin code,
program output and compiler/runtime errors keep their original text.

## Projects and editing

**New Project** offers an empty project, BluePlay templates and demo projects.
Each Kotlin file contains either one class, interface or enum, or top-level
functions and properties. Inheritance appears as arrows in the diagram.
A project can also have a name and a README note.

Use **Delete** in a file card's context menu to remove it. BlueK asks for
confirmation with the filename, including class, test and functions files.
Cancel keeps the file and the current runtime session.

The editor supports Kotlin syntax highlighting, formatting, tabs, windows,
font settings, dark mode and an optional Vim mode. Formatting runs locally.
Compile errors point to the relevant file and source position.

Right-click a class to create an instance. Right-click an object on the bench
to call its methods; double-click to inspect it. Inspectors evaluate getters
when opened or refreshed, so a getter can have effects or report an exception.
Following a stored object reference does not create a new object.

The codepad accepts expressions and statements. Variables remain available
until Compile or Reset. Use **Get** on a result to put it on the object bench.
If the result comes from a direct variable read, such as `s`, Get suggests that
same name. A method result or new object uses the usual class-based suggestion.
The terminal supports `print`, `println`, `readln`, `readLine` and
`readlnOrNull`, including waiting for input, EOF and Stop.
Settings → Terminal lets you change the terminal font size from 10 to 30 px and
offers automatic clearing before interactive calls, Codepad executions or Start
main; all clear options are off by default. Use `print("\u000C")` to clear from
Kotlin code. See [terminal behavior and formatting](terminal.md) for details.

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
folders. Historical BluePlay library source files are replaced by the built-in
library when applicable; Kotlin files, card positions, images and sounds are
imported. Java source is not interpreted.

**Save / Export** keeps the same window size when switching views or changing
options. The content scrolls on smaller screens; Cancel stays available.
Choose the view recipients will open:

- **BlueK project**: full project link, 30-day short link and reusable project
  JSON. These open the editable developer workspace. BlueJ ZIP export is not
  implemented yet.
- **Runnable program**: full program link, 30-day short program link and
  **Export as HTML (Beta)**. These start the chosen `main()` in a console or
  BluePlay player, without classes, an object bench or editors. If several
  files have a supported main, choose one for each export. `main()` and
  `main(args: Array<String>)` are supported; args is an empty array.

Full links contain the complete project, resources, selected main and player
options in the URL, with no server storage or expiry. Very large programs
need a short link or HTML export. Short links store the same payload for 30
days on the optional share service. Anyone with the link can open it.
HTML exports embed the runtime and run without a server or network.

Project links use `#bluek=…` or `/bluek/three-word-code`; runnable exports use
`#run=…` or `/run/three-word-code`. Both forms preserve the BlueK base address
and select the developer workspace or player without a filename in the link.
Main selection and all execution options travel inside the runnable package.
Existing permanent `#bluek=…` links remain valid. The old `/load/…` short-link
route is temporarily supported while those stored links expire.

An expired or unknown short link shows an explanation instead of a program or
an empty project; ask the person who shared it for a new link. Opening a link
that cannot be loaded keeps the work previously open in that browser tab.
If a project code is opened as a program, the player offers to open the
project in BlueK instead.

Project links share **Open README** and **Load state** options. Load state
requires a default test class and automatically restores its state on opening
the link. Both options can be selected together. Regular JSON imports and
autosave restoration do not automatically load state.

All three runnable export actions use one shared **For links and HTML** options
panel beside the equally sized actions (stacked on small screens).
Program links and HTML exports share independent **Show project name**,
**Allow source download** and **Include “Open in BlueK”** options. Hiding the
name removes the page heading and uses a generic browser-tab title; the saved
project name is preserved. The player has no running/paused status label. The download is the complete editable
`.bluek.json` project. The developer link opens that project in normal BlueK;
for a short program link it uses the same stored copy and expiry. Without
**Include “Open in BlueK”**, a short program code also cannot be opened as a
project through `/bluek/…` or **Open / Import**. These options do not provide
source confidentiality: the interpreter needs the source, which remains part of
the exported program and can be extracted with browser developer tools.

BluePlay additionally offers **Start game automatically**, **Show Act / Run /
Reset buttons** and **Show speed slider**. New exports start automatically by
default. Buttons and speed can be hidden independently when autostart is on.
With autostart off, buttons remain visible so the game can be started. Main
always runs when the player opens; autostart controls the subsequent simulation.
Reset runs the selected main again and resumes simulation when autostart is on.
Older HTML exports retain their original paused start and visible controls.

After importing a link, BlueK removes the project payload from the address bar.
Reload then restores your own draft. To return to the original assignment,
explicitly open the original link again; this replaces the current tab's draft.

## Offline use

The download icon at the bottom left, below the testing area, opens instructions first.
Choose **Download ZIP**, extract it and open **BlueK.html** in a recent desktop
browser. No installation, server, Node.js or Python is needed.

The editor, interpreter, BluePlay images, templates, formatter and HTML export
are embedded. Short links require the online service and are hidden offline.
Full project and program links point to the online BlueK site; opening them needs internet.

The offline version has not yet been widely tested in practice. Test your own
projects and browser before relying on it. Browser autosave may depend on the
location of BlueK.html; moving the file can make previous drafts unavailable.
Use JSON export for submissions and backups.

Use **Report a problem…** in the sidebar or from a compiler/codepad error to
tell the developer about a bug or missing Kotlin support.
Review the included version, browser and diagnostic data before
sending. The current project is included only if you select its checkbox.
An optional email lets the developer reply manually. Sending requires an
internet connection, including in the offline application.
Package instructions: [offline README](../scripts/offline/LIESMICH.txt).
