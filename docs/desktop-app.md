# BlueK desktop app

The desktop app is a Tauri shell around the maintained Svelte IDE. The browser
and single-file offline versions remain supported. Desktop-only file access
stays in `frontend/src/desktopFiles.ts`; project validation and ownership remain
in `ProjectWorkspace`. The desktop build uses the same local-only feature mode
as the offline HTML edition, so account, cloud-save, project-sharing and
publication controls are hidden.

## Local macOS development

Install Xcode Command Line Tools, Rust stable, and Node.js 22, then run:

```sh
npm ci
npm run desktop:dev
```

Build a local `.app` and DMG with `npm run desktop:mac`. Local builds are
unsigned unless a Developer ID identity and Apple notarization credentials are
configured. The Windows target is prepared with `npm run desktop:windows` and
the `desktop-build.yml` workflow; it must be built on a Windows runner.

## Project files

New project downloads use `.bluek`; their contents remain JSON. The importer
continues to accept historical `.bluek.json` and plain `.json` projects. The
desktop installer registers `.bluek` with the operating system. Opening a file
in a running app is forwarded to the focused window. If that window already has
a project, BlueK asks whether to replace it or open the file in a new window.
Creating a project in a non-empty window offers the same choice. The chosen
template is transferred to the new window without another selection step. An empty
window opens or creates projects directly. Save writes to the opened `.bluek`
path; Save for a new project uses the native save dialog. Browser exports
remain downloads.

The app tracks changes since the current project was loaded or explicitly
saved. Closing the Tauri window or quitting with changes opens Save / Close
without saving / Continue working. Save updates the opened file or asks for a
destination. The online and offline browser editions use the same change
tracking and already
ask through the browser's native `beforeunload` prompt. Browsers do not allow a
page to replace that prompt with its own Save / Discard dialog.

Desktop window behavior follows one lifecycle:

| Action | Result |
| --- | --- |
| Red close button, File → Close Window or Cmd-W | Close only that window; ask about unsaved changes first. |
| New → template → New window | Create the already selected template in a separate window. |
| Open a file in a non-empty window | Choose replace, new window or cancel once. |
| Open a file while the app has no windows | Create a window and consume the queued file path after startup. |
| Click the Dock icon after the last window closed | Open a normal window. |

`Window.onCloseRequested` in the Tauri SDK completes an accepted close using
`Window.destroy`; both close and destroy permissions are required. Keep this
single close-request hook rather than adding separate frontend key handlers.
Run `npm run test:desktop-lifecycle` for the SDK/permission and transfer checks;
these helper checks do not replace native macOS interaction checks.

Native file reads are limited to project-sized text payloads (64 MB). Saves
write a temporary file in the destination folder and atomically replace the
project. Project JSON is still validated by the existing project loader.

## Signing and release setup

For macOS distribution outside the App Store, enroll in the Apple Developer
Program, create a Developer ID Application certificate and notarize each
release. Apple lists the annual program fee as USD 99 (regional price may
differ). A signed but unnotarized app can still trigger Gatekeeper warnings.
See [Apple's Developer ID](https://developer.apple.com/help/account/certificates/create-developer-id-certificates)
and [notarization guide](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

Windows releases include x64 NSIS `.exe` and `.msi` installers without a code
signature. SmartScreen may warn, and school policies can block installation or
startup. The school IT team may need to approve or deploy the package. See
[Microsoft's SmartScreen guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

Signing credentials are intentionally not included in the repository. The
manual **Build BlueK for macOS (Apple Silicon)** workflow builds an ARM64 DMG
for M1 and newer Macs. Before release credentials are configured, it creates
an ad-hoc signed, non-notarized test artifact that may still trigger Gatekeeper
warnings. For an end-user release without those warnings, first
create a **Developer ID Application** certificate in the Apple Developer
account, install it in Keychain Access, and export its certificate and private
key together as a password-protected `.p12` file. The account holder role is
needed to create that certificate. Then add these GitHub Actions secrets:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64 of the exported `.p12` file |
| `APPLE_CERTIFICATE_PASSWORD` | Password chosen for that `.p12` export |
| `APPLE_SIGNING_IDENTITY` | Full identity shown by `security find-identity -v -p codesigning`, beginning `Developer ID Application:` |
| `APPLE_ID` | Apple Account email |
| `APPLE_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Team ID from the Apple Developer account |

The certificate identity can be checked locally with
`security find-identity -v -p codesigning`. Never commit the `.p12`, its
password, or the app-specific password. The tag-triggered release workflow
requires all six secrets, checks that tag `bluek-v<version>` matches
`src-tauri/tauri.conf.json`, and builds only `aarch64-apple-darwin`. It first
builds unsigned Windows x64 EXE and MSI installers, then builds the signed and
notarized macOS DMG. Once both jobs succeed, it publishes a public GitHub
release whose assets are downloadable without a GitHub account. The workflow
does not rebuild or publish an existing tag when its configuration changes;
use a new version and tag for each release. Windows installers use Tauri's
configured WebView2 bootstrapper mode; first installation may need internet
access to download WebView2 if it is not already installed.

### Keep and rotate release credentials

Keep these items in a password manager or another secure backup:

- `BlueK-Developer-ID.p12`, its export password, and the matching
  `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` GitHub secrets. The `.p12`
  contains the Developer ID certificate and private key. Keep it encrypted
  and restricted; it is the recovery copy if the signing identity must be
  installed again. Do not put it in the repository or an ordinary project
  backup.
- The Apple Account email, Team ID, and exact signing identity. These are
  identifiers, not passwords; record them with the release notes.
- The app-specific Apple password used as `APPLE_PASSWORD`. It can be revoked
  and replaced in the Apple Account if lost or suspected compromised; update
  the GitHub secret at the same time.
- The six repository Actions secret names listed above. GitHub will not show
  their values again, so retain the certificate export and app-specific
  passwords separately in the password manager.

The original `CertificateSigningRequest.certSigningRequest` is not needed for
normal builds or notarization once the certificate has been issued and
imported. It contains no private key and is not a substitute for the `.p12`
backup. It can be deleted after confirming the certificate and private key are
present in Keychain Access and the `.p12` backup is safely stored. Keep the
signing identity in Keychain Access; do not delete it while preparing a backup.

The macOS release depends on an active Apple Developer Program membership and
the six GitHub Actions secrets. If the Developer ID certificate expires or is
revoked, create and export a replacement certificate, update the certificate
and identity secrets, then verify a release build. The app-specific password
can be rotated independently. Windows release builds require no signing
secrets.

### Release a new version

1. Set the new app version in `src-tauri/tauri.conf.json` and commit the
   release changes to `main`.
2. Create and push a tag that exactly matches the version, for example
   `bluek-v0.1.1`. Pushing a matching tag starts the workflow. A successful
   run publishes the release publicly. Do not push a test tag: it can create a
   public release.
3. Check the GitHub Actions run and install the published packages on the
   target platforms. Windows installers are unsigned and may show SmartScreen
   warnings. The Mac package targets Apple Silicon and macOS 12 or later.

Record each release's version/tag, commit, workflow result, asset links, and
installation issues. Keep this runbook and the credential recovery location
accessible to the project maintainer, but never record secret values here.

## Diagnosing native document opening

macOS can deliver `Opened` and `Reopen` before Tauri has created the configured
main window. Queue document paths until `RunEvent::Ready`; creating a window
before that point conflicts with Tauri setup and aborts the process. At Ready,
notify existing frontend listeners without consuming the queued path; startup
IPC consumes it if its listener was not registered yet.

For native reproduction, fully quit BlueK and use Launch Services, rather than
passing a path directly to the executable:

```sh
open --env BLUEK_DESKTOP_TRACE=1 --stderr /tmp/bluek-open.log -a /Applications/BlueK.app example.bluek
```

The optional trace records readiness, startup-path consumption and successful
native reads, without logging project content. The default build is silent.
