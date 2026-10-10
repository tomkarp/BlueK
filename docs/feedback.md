# Private feedback

**Report a problem…** accepts bugs and missing Kotlin support without a user
account. The sidebar, Help, compiler diagnostics and codepad errors open the same
dialog. Reports go to the private
[`tomkarp/BlueK-Feedback`](https://github.com/tomkarp/BlueK-Feedback) repository,
independently of the public source repository.

The header's information button reveals a storage notice on hover, keyboard
focus or click. It describes included data, project opt-in, the BlueK server,
the private GitHub repository, access and retention. The introduction remains
brief; the complete report is available in the expandable data preview.

## Report contents

The form contains a category, title, description, optional expected behavior
and optional contact email. Build revision/channel/time, browser, interface
language, web/offline mode and available diagnostics are included automatically.
A codepad error shortcut also includes its input. Diagnostic context is bounded
to 100 messages of 10,000 characters, and 20,000 characters each for error text
and codepad input. **Included data** shows the complete transmitted JSON.

Project inclusion is unchecked by default. Opting in adds the project snapshot
captured when opening the report, using the normal project export format:
Kotlin files, README, images/sounds, library version, card positions and project
settings. No terminal output, other saved projects, browser storage, URL
queries/hashes or screenshots are collected. Closing retains the draft in
memory only; a successful submission starts a fresh draft next time.

Main, beta and local Vite use their `/api` endpoint. Vite forwards feedback to
the live `https://bluek.de` service by default, without copying its token to the
development machine. `BLUEK_FEEDBACK_PROXY_TARGET` can select a local backend
instead. Pages and offline BlueK use `https://bluek.de/api/feedback`; sending
requires internet. No GitHub credential is bundled in any frontend build.

## Delivery and limits

`server/feedback.mjs` runs in the existing sharing service and uses a separate
`feedback_reports` table in the same SQLite database.

| Endpoint | Purpose |
| --- | --- |
| GET /api/feedback/config | Availability and the 10 MiB request limit |
| POST /api/feedback | Durable receipt, optionally an issue number |
| GET /api/feedback/<UUID> | Receipt status/issue number only; never report content |

The service checks that the repository is private, validates the report and
stores it before acknowledging receipt. A serial worker uploads a gzip JSON
attachment to `reports/<UUID>.json.gz` in that repository, then creates a private
issue with category labels and an attachment link. The issue also includes
description, metadata and diagnostics; very long details remain in the complete
attachment. An included project is under the attachment's `project` key. After
downloading, recover it for import into BlueK with:

```sh
gunzip -c <report>.json.gz | node --input-type=module -e \
  'let s=""; for await (const c of process.stdin) s+=c; const r=JSON.parse(s); if(!r.project) throw new Error("No project attached"); console.log(JSON.stringify(r.project,null,2));' \
  > recovered.bluek.json
```

Outages trigger exponential retries from one minute up to one hour. Pending
reports survive restarts until delivery. Successful delivery removes the local
payload; receipt/deduplication metadata remains for 30 days. Back up SQLite with
its WAL/SHM files and monitor pending reports when credentials expire. The client
briefly polls for an issue number; a slower delivery is confirmed as queued with
a reference, without claiming a GitHub issue already exists.

The worker also checks private-repository access daily, even without reports.
This keeps a non-expiring token in use during long pauses: GitHub can remove
tokens after a year of inactivity. Production uses a non-expiring, restricted
token, so annual manual renewal is not needed.

An unchanged retry reuses its UUID/receipt. Changed contents under an existing
UUID are rejected; the client allocates a new UUID for edited submissions.
Before retrying issue creation, the worker checks recent issue markers for a
lost response. GitHub has no atomic issue idempotency key: an unusually delayed
API response can still require manual deduplication.

Limits: ten requests/address/ten minutes, 100 new reports/hour globally, four
simultaneous uploads. Address hashes are transient in-memory rate-limit data,
not report content. Forwarded addresses are trusted only from loopback (Caddy).
Allowed origins are explicit; origin checks do not authenticate non-browser
clients. Descriptions are fenced to avoid generating mentions/links. Backend
errors never return credentials or GitHub response bodies.

## Server configuration

| Variable | Purpose/default |
| --- | --- |
| BLUEK_FEEDBACK_REPOSITORY | `tomkarp/BlueK-Feedback`, private with Issues enabled |
| BLUEK_FEEDBACK_TOKEN_FILE | Preferred protected token file outside source/deployment directories |
| BLUEK_FEEDBACK_TOKEN | Alternative environment token for local development |
| BLUEK_FEEDBACK_ORIGINS | Comma-separated origins; defaults: main, beta, Pages, localhost/127.0.0.1:5173, `null` for offline files |

Use a fine-grained token limited to **BlueK-Feedback**, with **Issues: read/write**,
**Contents: read/write** (private attachments) and automatic **Metadata: read**.
It must remain server-only: never use a `VITE_*` variable or browser build
definition. The public repository's Actions token/deploy key cannot access this
separate private repository. Create `app-report`, `bug`, `kotlin-support` labels.

Production token: `/etc/bluek/feedback-token`, owner `bluek-share`, mode 600.
Systemd drop-in `/etc/systemd/system/bluek-share.service.d/feedback.conf`:

```ini
[Service]
Environment=BLUEK_FEEDBACK_REPOSITORY=tomkarp/BlueK-Feedback
Environment=BLUEK_FEEDBACK_TOKEN_FILE=/etc/bluek/feedback-token
```

Reload systemd and restart `bluek-share` after token creation/rotation. Without a
token, only feedback is disabled; an explicitly configured unreadable token file
is a configuration error. Existing deployment workflows copy every `server/`
module and preserve `/etc/bluek`/the drop-in. No additional Actions secret is
needed.

## Developer notifications

Watch the private repository. A personal token creates issues as its owner. For
email, enable Watching email and **Include your own updates** in
[GitHub notification settings](https://github.com/settings/notifications).
Watching alone does not guarantee mail for issues created by your own token.
These account settings require the owner's access. The server does not send
email; reporter email is private issue content for a manual reply.

API references: [issues](https://docs.github.com/en/rest/issues/issues#create-an-issue),
[private attachments](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents),
[tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens),
[notifications](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications).
