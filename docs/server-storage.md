# Accounts, private storage and public copies

Step 1 implementation for BlueK/bluek.online. Local work never requires an
account or an API connection. Svelte and the browser interpreter remain the
only maintained editor/runtime. The optional
[inf-schule handoff](inf-schule-handoff.md) imports editorial JSON directly from
its trusted opener without using this service. There is no inf-schule build.
See [deployment](deployment.md) for the operator cutover and
[regression evidence](regression-checklist.md) for tests actually run.

## Local work and links

Downloadable project JSON is the recommended personal backup. Browser drafts,
local JSON, BlueJ import/export, HTML exports, the offline IDE, BluePlay,
formatter, examples and help remain local/static capabilities. Server storage
is convenience without an availability or retention guarantee; data loss is
possible. The twelve-month inactivity cleanup is not a minimum retention promise.

New links contain only a public identifier: `/?p=<code>` for an editable copy,
`/?run=<code>` for a player. README/state flags use `&readme=1&state=1`.
The stored program envelope preserves the selected main and player options.
“Open in BlueK” from a published player references the same public copy, subject
to `allowBlueK`. From a local HTML export it opens the home page; download/import
JSON to transfer the project. It never constructs a content URL.

Existing `#bluek=p1.…`, `#bluek=d1.…`, `#run=p1.…` and `#run=d1.…` links remain
readable during an explicitly accepted transition. They cannot be centrally
moderated and may contain custom media. **No shutdown date has been agreed.**
`legacyContentLinks.ts` is the common compatibility gate for IDE and player.
When the operator ends the transition, disable that gate, remove its decode
paths/fixtures, and publish a migration notice. No UI or export encoder remains.
Existing `/bluek/<words>`, `/run/<words>` and `/load/<words>` paths remain readable;
Pages uses `404.html` for these legacy paths. A legacy path may have HTTP 404 at
the document level even though its browser application opens successfully.

## Accounts and sessions

Registration is open and usernames are pseudonyms. The operator may manually mark an
account as trusted after personal review; this is not a formal identity verification.
To request trusted access, users may contact karp@fmsg-speyer.de with their
username and background. Accounts have no email, password reset, recovery question
or manual identity-recovery workflow. The registration UI explains
irrecoverable password loss and unique BlueK passwords; password-manager
`username`, `current-password` and `new-password` autocomplete is supported.
Usernames are case-insensitive ASCII letters/digits/period/underscore/hyphen,
3–32 characters. An authenticated user can change their username after
confirming the current password; the normalized name must be unique. The
account ID, projects and sessions stay the same. Passwords contain 10–128
JavaScript UTF-16 code units; they are never trimmed, silently truncated,
logged or stored in plaintext.

An authenticated user can permanently delete their account after confirming
the current password. This removes the account, its private projects, sessions
and login-attempt record. Deleting an account also deletes its published copies and clears their ownership
association; reserved identifiers remain unavailable for reuse.

Passwords use random 16-byte salts and asynchronous Node scrypt (`N=32768`,
`r=8`, `p=3`, 64-byte keys, `scrypt-v1` encoding). This is a documented minimum
profile from the [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
Node 22 provides it without a new authentication platform; see
[Node crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).
At most four password derivations run simultaneously (temporary 503 when busy).
The operator must measure latency and capacity on the deployment host.

Login failures are tracked persistently by normalized target username, not IP.
Failed attempts introduce waits of 1, 2, 4, 8, 16, then at most 30 seconds.
Requests during the wait cannot extend it. After fifteen minutes without a
failed password check, the history resets; successful login clears it. Concurrent
checks for the same username are serialized/rejected. Password-change guesses
use the same protection. There is no permanent failure lock or school-IP ban,
and no CAPTCHA dependency. Automated sustained attacks can still disrupt access;
operators should monitor failures and consider a target-specific CAPTCHA if
needed. Account blocking is a separate explicit operator action. See the
[OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling).

Sessions use random 32-byte tokens; SQLite holds their SHA-256 hashes only.
Production cookies use the `__Host-` prefix, Path=/, no Domain, HttpOnly, Secure
and SameSite=Lax, preventing sibling-domain cookie shadowing. Local HTTP tests
use a separate unprefixed cookie name. Sessions
expire after seven days absolutely or one day without authenticated API use.
Login rotates the browser's session; logout revokes it server-side. Password
change requires the current password and a valid session, revokes every session,
and issues a replacement for the current browser. Blocking an account revokes
its sessions. No token is stored in Local Storage. Private APIs check account,
session and owner on every request and recheck after awaited uploads.

The API uses exact Origin allowlists and credentialed CORS, never `*`.
Authenticated writes require `X-BlueK-Request: 1`; JSON requests and custom
headers force a preflight from other origins. Production `bluek.online`, beta
and the shared API endpoints are HTTPS and same-site; beta currently reaches
`/api` through its own host, while a later Pages build uses `api.bluek.online`.
No third-party cookie dependency is required there. Optional genuinely
cross-site deployments need an explicit
Origin and `SameSite=None; Secure` and may still be blocked by browser policy.
Do not allow `null` or arbitrary sibling origins for accounts.

Authenticated use updates account activity. Public reads never do. On startup
and hourly, accounts last used over twelve calendar months ago may be deleted
with private projects, sessions and owned public copies.

## Storage and publication

`/api/private-projects` provides authenticated list/create; `/<uuid>` provides
owner-only get/update/delete and name-only rename. Updates and renames require
`If-Match` with the previous revision, returning 409 for competing changes.
Renaming updates both the account-list name and the embedded project name. The
UI offers saving a new copy instead of overwriting a competing project update.
Server responses do not overwrite local edits made during a pending load. A
failed save is an error and recommends a JSON backup.

`POST /api/projects` and `/api/programs` publish a separate immutable copy, with
or without login. Anonymous copies expire after seven days; copies published
with a regular signed-in account expire after 30 days; trusted-account copies
expire after 365 days. Reads do not extend deadlines. An account has a 5 MiB
quota for serialized private projects, including embedded media and Base64
overhead. Published copies do not count toward account quota and cannot be
managed by regular users. Administrators can inspect, block, unblock, or delete
active copies in the admin interface. Ownership remains attached to publication
records for admin search, including after expiry or administrative deletion;
expired/deleted payloads are unavailable. Account deletion removes its active
copies and clears the association. Anonymous uploads remain outside
this quota; there is no global quota or publication-frequency limit. Monitor
disk capacity.

Project JSON is limited to **1,048,576 UTF-8 bytes**, including embedded media and
Base64 overhead. This applies to private saves and public copies, not local
files or technical feedback (still 10 MiB). The service bounds request bodies
and checks serialized nested project size; program envelopes have up to 16 KiB
of additional bounded metadata. The UI checks and explains project size before
upload. Unknown fields are rejected in project/program/file/library/resource
records, closing alternative media and external-resource fields.

New public copies from anonymous and regular accounts accept no custom media resources. Trusted accounts can publish embedded custom media. BluePlay's versioned
built-in images/sounds come from the static library, without re-uploading them.
If a project carries exact standard copies, the UI verifies their full data
and sends library references; direct API uploads are independently checked
against `server/standard-media.json` SHA-256 values and normalized in the new
copy only. The manifest is generated with the static standard-media modules by
`build:standard-images` and must be deployed with the API. Custom data under a
standard filename is still rejected. Both UI and server
name rejected resource paths, including a project nested in a program. The
local/private original is not modified or silently stripped. Ordinary BluePlay
drawing remains available; source is not scanned with a content regex.

New identifiers have twelve cryptographically random characters from
`23456789abcdefghjkmnpqrstuvwxyz` (case-insensitive, ambiguous characters omitted).
Allocation reserves the code transactionally and retries collisions. The small
`public_codes` tombstone table persists forever; content does not. Expiry cleanup
clears the optional owner association, leaving only the code and block flag. Codes are
never allocated from this table again, including after expiry or administrative
blocking. The migration reserves all existing codes before cleanup.

Every public get checks the deadline even before hourly physical cleanup;
410 means expired, 404 unknown, 451 operator-blocked, 403 developer view disabled,
409 project code opened as player, 400 invalid code. Both project and program
routes use the same blocking check. Content is not archived indefinitely. The
API uses `no-store` and cannot retract a copy someone already downloaded/opened.
There is no anonymous secret deletion key; authenticated owners may delete their own copies.
Anonymous authorship cannot prove who posted a copy.

## Operator actions

The operator CLI is protected by the API host's OS and SSH permissions.
There is no public admin registration or admin token bundled in the frontend. In `/opt/bluek-share` or `/opt/bluek-beta-share`, the CLI reads
`BLUEK_SHARE_DB` from the corresponding running systemd service. An explicit
environment variable takes precedence. A local checkout defaults to
`server/data/projects.sqlite`. The operator needs OS access to the service's
process environment and read/write access to its database and SQLite WAL files.
If the service is stopped or access is denied, start it and use an appropriately
privileged account, or explicitly set the database path while running as the
service user. The CLI never creates a missing database. The production database
is `/var/lib/bluek/projects.sqlite`; beta uses its separate database under
`/opt/bluek-beta-share/data/`.

For example, on the server:

```sh
cd /opt/bluek-share
node server/admin.mjs inspect 7m4kr9wp3x6d
node server/admin.mjs block 7m4kr9wp3x6d
node server/admin.mjs accounts
node server/admin.mjs block-account username
node server/admin.mjs trust-account username
node server/admin.mjs untrust-account username
node server/admin.mjs grant-admin username
node server/admin.mjs revoke-admin username
node server/admin.mjs list-publications username
node server/admin.mjs delete-account username
```

`grant-admin` and `revoke-admin` are the only ways to change the admin role;
trusted status alone grants no admin rights. The role is checked against the
current database account on every admin request, so revocation applies to
existing sessions immediately. Web actions cannot target administrator accounts;
use the CLI for them. Blocking an account revokes its sessions. The account
dialog opens a separate admin-only window to search accounts and active publications,
change trust or block status, delete non-admin accounts, inspect public project
contents and media without executing code, and block or unblock public links.
Private project content is never exposed by this view. Account and publication lists are paginated in groups of 100 and can be narrowed
by username or code.

The account tab reports the number of accounts and the serialized bytes stored
in private projects and public copies, with a breakdown by content type. This
is project-payload storage, not the SQLite file size or backup size. Per-account
storage shows private project bytes, bytes in owned public copies, and their
sum. The account list can be sorted by username, private storage, public-copy
storage, or attributed total, largest first. Private bytes match the 5 MiB
account quota; public copies never count toward it. Anonymous copies are
included in the overall total without an account attribution; expired payloads
are included only while they remain in the projects table awaiting cleanup.

The account tab also accepts up to 500 usernames in one trust action. The web
interface splits pasted text on whitespace, commas or semicolons, ignores duplicates, and
reports newly trusted, already trusted, missing, and administrator accounts.
The server validates every name and applies the batch in one transaction; each
newly trusted account receives its own audit record.

CLI mutations and web admin actions create an audit record with time, actor ID,
action and target ID or publication code, not passwords or project content.
The interface displays up to 100 records, resolving existing account IDs to
usernames. Records older than 90 days are removed during startup/hourly cleanup;
backups follow the operator's retention policy. Deleting an account removes its
name from this display, but its ID can remain in the audit until expiry.

`unblock` and `unblock-account` reverse administrative blocks. Inspect outputs
JSON for review without executing student code; it refuses expired payloads.
`inspect` includes the associated username while the account exists. Account deletion
removes its private projects, sessions and published payloads; it cannot recall
copies already downloaded. Revoking trust affects new publications only.
Account blocks prevent private access and authenticated use; they do
not automatically block every public copy or prevent a person publishing
anonymously. No public gallery or registration approval exists. Expiry and
moderation do not prevent re-uploading. Technical feedback remains a separate
service; see [feedback](feedback.md).
