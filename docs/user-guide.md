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

**New** offers an empty project, BluePlay templates and demo projects.
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

## Automatic recovery

Each tab has an independent automatic recovery draft. Reloading restores that
tab's draft. Edits update that one entry; they do not create a version history.
Different tabs do not overwrite each other's work. Duplicated tabs get
independent drafts when the browser supports Web Locks; the fallback may create
an additional draft on restoration.

A fresh start shows a dismissible notice when other recoverable drafts exist.
The active tab restores itself automatically. **Open → Restore** shows drafts
from other tabs or earlier sessions, with the three newest shown first. It can
reopen source, resources, README, card positions and the default state class.
The object bench itself is restored only through [Load state](testing.md#saved-state).
Loading another project into a non-empty tab asks before replacing the open
project and its browser autosave.

Use the trash icon beside a recovery draft, or **Delete all**, to remove browser
copies after confirmation. This keeps settings and does not close open projects.
An unchanged open project does not recreate its deleted copy; editing it does.

Drafts have no BlueK expiry date. Browser cleanup, private browsing, storage
limits and browser policies can remove them. Browser session restoration also
determines which tabs return after reopening the browser. Export JSON for work
you need to retain.

## Import, export and links

**Open** accepts `.bluek.json` files and BlueJ projects as ZIPs or
folders. Historical BluePlay library source files are replaced by the built-in
library when applicable; Kotlin files, card positions, images and sounds are
imported. If a ZIP or folder contains several projects, choose one from the
project list. Cancel leaves the current project open. Java source is not interpreted.

**New** offers empty projects and BluePlay templates first, followed by examples.
The left-hand editing/run/test controls and the terminal/window layout are unchanged.
The view buttons remain in the upper-right toolbar; a separator distinguishes
**Sign in / Account** from these display controls.

**Open** groups browser drafts, **In my account**, **From computer** and shared
project codes in one dialog. Expand **In my account** to load or delete private
projects. Only that explicit action contacts the optional account service.

**Save** offers **Download BlueK project file** (portable `.bluek.json`) and
**Save in account** (private server storage). Under **Other formats**, choose
**Export BlueJ Project (.zip)** or **Runnable webpage …**. The webpage step
shows player options and the **Export as HTML** action. **Back** returns to
the format choices. The save dialog does not publish public links.

**Share** creates an immutable public copy that expires after seven days;
no account is needed. **Edit project** creates a link to an editable BlueK
copy. Its README and saved-state opening options appear only when available.
**Run program** creates a direct player link; its optional program settings are
collapsed until needed. HTML downloads and runnable publications use the same
program-option values.
A runnable export starts the chosen `main()` in a console or BluePlay player,
without classes, an object bench or editors. If several files have a supported
main, choose one for each export. `main()` and `main(args: Array<String>)` are
supported; args is an empty array.

The dialogs retain a stable size when switching options. Their content scrolls
on smaller screens; Cancel and Back remain available. The offline edition keeps
local file formats and omits account and public-sharing actions.

Publishing stores a separate immutable public copy for seven days. Only built-in
BluePlay media are allowed; supplied images and sounds are rejected by name
without modifying the original. Anyone with a link can open it. Publishers
cannot withdraw it; the operator can block it. Visits do not extend its lifetime.
Server uploads are limited to 1 MiB of UTF-8 project JSON including embedded
media/Base64 overhead. Local JSON and HTML files have no such server limit.
HTML exports embed the runtime and run without a server or network.

**Sign in / Account** offers optional pseudonymous registration without
email and account settings. All accounts have the same abilities. Use a
unique BlueK password and save it with a password manager: there is no password
reset or manual recovery. You can change the password while authenticated with
the current password. Private saves/updates and new copies belong to **Save → Save in account**;
opening and deletion belong to **Open → In my account**. Signing in from one
of these dialogs returns to that task; sign-in never uploads the project.
Saving still requires an explicit action after authentication. The account
project lists in Open and Save let you rename projects; Open → In my account
also lets you load or delete them. Lists load when you select the account
source. Other accounts cannot access private contents.
Publishing always creates an independent copy; editing/deleting a private
original does not change it. Keep your own downloaded JSON backups: server
storage can fail or lose data and promises no retention period. Accounts and
private projects may be deleted after twelve months without signed-in use.
Public visits do not count as account use.

The BlueJ ZIP contains one folder with the Kotlin files, `README.TXT` and
`package.bluej`, which keeps the cards where the class diagram shows them.
Test classes are left out because BlueJ has no `kotlin.test`. BluePlay projects
also get the BlueJ version of the BluePlay library and all standard images and
sounds in `images/` and `sounds/`, even unused ones, so they remain available
in BlueJ; your own images and sounds replace standard files with the same
name. In BlueJ, BluePlay plays WAV sounds only, not MP3. Only if the project
has test classes or MP3 sounds does a notice after the export name them; it
stays until you close it.
Importing such a ZIP into BlueK again keeps unchanged standard images and
sounds as standard resources.

Project links use `?p=<code>`; runnable links use `?run=<code>`. New codes have
twelve case-insensitive characters and are displayed in three groups of four
for easier reading. The alphabet omits `0`, `1`, `i`, `l` and `o` to avoid
typing ambiguities. When opening a project, spaces and hyphens are ignored, and
you can paste the full link instead of extracting its code. The length keeps
public links difficult to guess; public reads currently have no per-code
request limit. These links open directly on static hosting and contain no
project data. Existing word codes and full `#bluek=…`/`#run=…` content links
remain readable for a transition with no agreed end date. New full content links
cannot be generated. Main selection/options remain in the stored runnable copy.

An expired or unknown short link shows an explanation instead of a program or
an empty project; ask the person who shared it for a new link. Opening a link
that cannot be loaded keeps the work previously open in that browser tab.
If a project code is opened as a program, the player offers to open the
project in BlueK instead.

Project links share **Open README** and **Load state** options. Load state
requires a default test class and automatically restores its state on opening
the link. Both options can be selected together. Regular JSON imports and
autosave restoration do not automatically load state.

Both runnable export actions use one shared **For links and HTML** options
panel beside the equally sized actions (stacked on small screens).
Program links and HTML exports share independent **Show project name**,
**Allow source download** and **Include “Open in BlueK”** options. Hiding the
name removes the page heading and uses a generic browser-tab title; the saved
project name is preserved. The player has no running/paused status label. The download is the complete editable
`.bluek.json` project. The developer link of a published program opens the same stored copy with its
original expiry. A local HTML player opens the BlueK home page: download its
JSON and import it there. Without
**Include “Open in BlueK”**, a short program code also cannot be opened as a
project through `?p=…` or **Open**. These options do not provide
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
