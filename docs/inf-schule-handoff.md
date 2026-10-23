# Opening editorial inf-schule projects in BlueK

The inf-schule page opens BlueK in a new tab, reads a project JSON file from its
own website and sends it with `postMessage`. This works with the normal static
app on bluek.online and beta.bluek.online, including GitHub Pages. No BlueK
account, API, CORS configuration or additional server is required. BlueK opens
an editable project without automatically running it.

## One central script, plain chapter links

Copy `integrations/inf-schule/bluek-handoff.js` into inf-schule's SVN and include
it once in the central site template (adjust the script path):

```html
<script src="/path/to/bluek-handoff.js" defer></script>
```

Content pages contain only an ordinary link to their project file:

```html
<a href="./projekt.bluek.json" data-bluek-project>In BlueK öffnen</a>
```

Paths are relative to the content page, as with normal downloads. The script
handles all marked links, including dynamically inserted ones, and adds a
status message next to the link. A regular click or keyboard activation opens
BlueK; modifier/middle clicks retain the ordinary file-link behavior. Keeping
an explicit download link is useful if scripts or new tabs are blocked:

```html
<a href="./projekt.bluek.json" download>Projekt herunterladen</a>
```

There is no JavaScript or event handler in chapter content. The default target
is `https://bluek.online/`. To test beta, set the target once on the central
script include; the script and project links remain identical:

```html
<script src="/path/to/bluek-handoff.js"
        data-bluek-target="https://beta.bluek.online/" defer></script>
```

Keep the sender script and editorial `.bluek.json` files on inf-schule. BlueK
does not fetch or host these files. The reusable sender is maintained in the BlueK repository. With explicit
permission, the first Kotlin chapter trial appends it to the chapter’s existing
`_skripte.js` (temporarily targeting beta), replaces the first KrokoAlarm link
and stores its former embedded payload as `krokoalarm.bluek.json`. The source
code is unchanged; only a project name is added. No SVN commands are performed. Any normally exported project is supported,
including README, BluePlay resources, positions and saved test state.

## User behavior and browser requirements

The link opens a new BlueK tab or window directly during the click. The
inf-schule page must remain open until the transfer completes. Afterwards,
BlueK works independently and normal browser drafts support reload. A copied
launch URL alone cannot transfer a project. The source page displays a useful
error if the download, popup or transfer fails; the JSON file remains available
for ordinary download and import.

Both pages must retain their opener relationship. The helper deliberately uses
`window.open` without `noopener`/`noreferrer`; do not replace this with a plain
`target="_blank"` link. An incompatible `Cross-Origin-Opener-Policy` can sever
the relationship. Public response headers checked on 2026-10-24 for inf-schule.de,
bluek.online and beta.bluek.online contained no COOP header; this does not replace
acceptance on a real published chapter or school browsers. See the browser
references for [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
and [window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open).

## Local preview

Start BlueK normally and serve the prepared example from a different origin:

```sh
npm run dev -- --host 127.0.0.1
```

In another terminal, from the repository root:

```sh
python3 -m http.server 5195 --bind 127.0.0.1 --directory integrations/inf-schule
```

Open `http://127.0.0.1:5195/example.html`. This standalone preview explicitly
sets `data-bluek-target="http://127.0.0.1:5173/"` on its script include. This
local target is only for BlueK's example; inf-schule's central script include
selects the hosted target once. Neither relative project links nor the sender
script need changing before SVN commits. Local inf-schule origins on localhost,
127.0.0.1 and [::1] can also transfer directly to hosted BlueK on any port.

`npm run test:handoff` exercises the actual central script/example in Chromium
and WebKit. Fixture routes simulate separate inf-schule origins; no live files
are modified and BlueK API requests are blocked. Actual evidence and remaining
acceptance are recorded in the [regression checklist](regression-checklist.md).

## Transfer contract

The launch URL contains only `import=inf-schule` and `sender=<source origin>`.
It contains no project data or project URL. BlueK immediately removes these
parameters, so reload restores the browser draft rather than starting another
transfer. Fragments and additional parameters are rejected. Offline builds
disable the receiver; normal main, beta and development builds share it without
an extra build flag.

The `sender` parameter routes readiness; it grants no trust by itself. BlueK
accepts only the exact opener window and matching message origin. Allowed
origins are exactly https://inf-schule.de, https://www.inf-schule.de,
https://dev.inf-schule.de and HTTP(S) loopback hosts localhost, 127.0.0.1 and [::1]. The sender likewise checks the
exact child window and target origin. Synthetic message events are ignored;
no wildcard target origin is used. This trusts the scripts running on these
origins and does not offer arbitrary websites an import API.

The sender installs its listener before opening BlueK, fetches JSON only from
its own origin and rejects redirects. BlueK sends one `bluek:handoff:ready`;
the sender responds with `bluek:handoff:project` containing the parsed JSON.
BlueK replies with `bluek:handoff:result` (`loaded`, `cancelled` or `error`). A
failed download sends `bluek:handoff:cancel`. Envelopes use `version: 1`; BlueK
rejects unexpected types, versions and fields. Both sides clean up listeners
and time out after 30 seconds. Each launch consumes at most one project.

The ordinary project parser validates data before replacement. Restored drafts
use the normal replacement confirmation, and edits or project changes during
a delayed transfer are kept. ProjectWorkspace owns import/autosave/runtime
coordination; the transport owns only window communication. There is no token
service, retry loop, special project format or API upload size limit.
