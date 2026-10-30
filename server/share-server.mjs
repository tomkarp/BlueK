import { createServer } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { createFeedbackService } from "./feedback.mjs";
import { createAccounts } from "./accounts.mjs";
import { HttpError, json, body, record } from "./http.mjs";
import {
  validateProject,
  validateProgram,
  maxProjectBytes,
} from "./project-validation.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databasePath =
  process.env.BLUEK_SHARE_DB ||
  resolve(projectRoot, "server/data/projects.sqlite");
const anonymousPublicationDays = 7;
const accountPublicationDays = 30;
const trustedPublicationDays = 365;
const accountQuota = 5 * 1024 * 1024;
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const validCode = (code) =>
  /^[a-z0-9]{12}$/.test(code) || /^(?:[a-z]{4,6}-){2,3}[a-z]{4,6}$/.test(code);
const origins = new Set(
  (
    process.env.BLUEK_API_ORIGINS ||
    "https://bluek.online,https://beta.bluek.online,http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((item) => item.trim()),
);
await mkdir(dirname(databasePath), { recursive: true });
const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.pragma("secure_delete = ON");
const accounts = createAccounts(database);
// Additive, transactional migration: old payloads and their original deadlines
// are unchanged. Reserve every existing identifier BEFORE any expiry cleanup.
database.transaction(() => {
  database.exec(`CREATE TABLE IF NOT EXISTS projects (
    code TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
    size_bytes INTEGER NOT NULL, project_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS projects_expires_at ON projects(expires_at);
  CREATE TABLE IF NOT EXISTS public_codes (
    code TEXT PRIMARY KEY, blocked INTEGER NOT NULL DEFAULT 0,
    owner_id TEXT REFERENCES accounts(id) ON DELETE SET NULL
  );
  INSERT OR IGNORE INTO public_codes(code) SELECT lower(code) FROM projects;
  CREATE TABLE IF NOT EXISTS private_projects (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL, updated_at INTEGER NOT NULL, revision INTEGER NOT NULL,
    project_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS private_owner ON private_projects(owner_id);
  CREATE TRIGGER IF NOT EXISTS delete_account_publications BEFORE DELETE ON accounts BEGIN
    DELETE FROM projects WHERE code IN (SELECT code FROM public_codes WHERE owner_id = OLD.id);
  END;
  `);
})();
const feedback = await createFeedbackService(database);
function cleanup() {
  const now = Date.now();
  database.transaction(() => {
    database
      .prepare(
        "UPDATE public_codes SET owner_id = NULL WHERE code IN (SELECT code FROM projects WHERE expires_at <= ?)",
      )
      .run(new Date(now).toISOString());
    database
      .prepare("DELETE FROM projects WHERE expires_at <= ?")
      .run(new Date(now).toISOString());
    accounts.cleanup();
  })();
  // Do not retain expired payloads indefinitely in a WAL. Operator backups must
  // follow the same documented finite retention; identifier tombstones contain no content.
  database.pragma("wal_checkpoint(PASSIVE)");
}
function publicRecord(code) {
  if (!validCode(code)) throw new HttpError(400, "invalid-code");
  const reservation = database
    .prepare("SELECT * FROM public_codes WHERE code = ?")
    .get(code);
  if (reservation?.blocked) throw new HttpError(451, "publication-blocked");
  const row = database
    .prepare("SELECT * FROM projects WHERE code = ?")
    .get(code);
  if (!row)
    throw new HttpError(
      reservation ? 410 : 404,
      reservation ? "expired" : "missing",
    );
  if (Date.parse(row.expires_at) <= Date.now())
    throw new HttpError(410, "expired");
  return row;
}
function usage(id) {
  return database.prepare(`SELECT
    COALESCE((SELECT SUM(length(CAST(project_json AS BLOB))) FROM private_projects WHERE owner_id = ?), 0) +
    COALESCE((SELECT SUM(size_bytes) FROM projects JOIN public_codes USING (code) WHERE owner_id = ? AND expires_at > ?), 0) AS bytes`).get(id, id, new Date().toISOString()).bytes;
}
function checkQuota(id, delta) {
  const used = usage(id);
  if (delta > 0 && used + delta > accountQuota) throw new HttpError(413, "quota", { used, limit: accountQuota });
}
function storePublic(payload, user) {
  return database.transaction(() => {
    const text = JSON.stringify(payload);
    if (user) checkQuota(user.id, Buffer.byteLength(text));
    for (let attempt = 0; attempt < 30; attempt++) {
      const code = Array.from(
        { length: 12 },
        () => alphabet[randomInt(alphabet.length)],
      ).join("");
      if (
        database.prepare("SELECT 1 FROM public_codes WHERE code = ?").get(code)
      )
        continue;
      const createdAt = new Date();
      const expiresInDays = user
        ? (user.trusted ? trustedPublicationDays : accountPublicationDays)
        : anonymousPublicationDays;
      const expiresAt = new Date(
        createdAt.getTime() + expiresInDays * 86400000,
      ).toISOString();
      database
        .prepare("INSERT INTO public_codes(code, owner_id) VALUES (?, ?)")
        .run(code, user?.id || null);
      database
        .prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?)")
        .run(
          code,
          createdAt.toISOString(),
          expiresAt,
          Buffer.byteLength(text),
          text,
        );
      return { code, expiresAt, expiresInDays };
    }
    throw new HttpError(503, "busy");
  })();
}
async function handle(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const path = url.pathname;
  // Technical reports keep their separate 10 MiB limit and outbox behavior.
  if (await feedback.handle(request, response, path)) return;
  const origin = request.headers.origin;
  response.setHeader("Vary", "Origin");
  if (origin && !origins.has(origin)) throw new HttpError(403, "origin");
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-bluek-request, if-match",
    });
    response.end();
    return;
  }
  if (request.method === "GET" && path === "/api/health")
    return json(response, 200, { ok: true });
  const account = await accounts.handle(request, response, path);
  if (account !== null) return json(response, 200, account);

  if (path === "/api/storage" && request.method === "GET") {
    const user = accounts.session(request);
    return json(response, 200, { used: usage(user.id), limit: accountQuota, trusted: !!user.trusted,
      publications: database.prepare("SELECT projects.code, projects.expires_at AS expiresAt, projects.size_bytes AS size, projects.project_json AS payload FROM projects JOIN public_codes USING (code) WHERE owner_id = ? AND expires_at > ? ORDER BY created_at DESC").all(user.id, new Date().toISOString()).map(({ payload, ...row }) => {
        const value = JSON.parse(payload);
        const program = value.format === "bluek-program";
        return { ...row, name: (program ? value.project : value).projectName || "", program };
      }) });
  }
  const ownedPublication = path.match(/^\/api\/owned-publications\/([a-z0-9-]+)$/);
  if (ownedPublication && request.method === "DELETE") {
    const user = accounts.session(request);
    accounts.requireWrite(request);
    database.transaction(() => {
      const code = ownedPublication[1].toLowerCase();
      if (!database.prepare("SELECT 1 FROM public_codes WHERE code = ? AND owner_id = ?").get(code, user.id)) throw new HttpError(404, "missing");
      database.prepare("DELETE FROM projects WHERE code = ?").run(code);
      database.prepare("UPDATE public_codes SET owner_id = NULL WHERE code = ?").run(code);
    })();
    return json(response, 200, { ok: true });
  }
  const privateMatch = path.match(
    /^\/api\/private-projects(?:\/([a-f0-9-]+))?$/,
  );
  if (privateMatch) {
    const user = accounts.session(request);
    const id = privateMatch[1];
    if (request.method === "GET" && !id)
      return json(response, 200, {
        projects: database
          .prepare(
            "SELECT id, name, updated_at AS updatedAt, revision FROM private_projects WHERE owner_id = ? ORDER BY updated_at DESC",
          )
          .all(user.id),
      });
    const existing = id
      ? database
          .prepare(
            "SELECT * FROM private_projects WHERE id = ? AND owner_id = ?",
          )
          .get(id, user.id)
      : null;
    if (id && !existing) throw new HttpError(404, "private-missing");
    if (request.method === "GET" && existing)
      return json(response, 200, {
        project: JSON.parse(existing.project_json),
        revision: existing.revision,
      });
    accounts.requireWrite(request);
    if (request.method === "DELETE" && existing) {
      database
        .prepare("DELETE FROM private_projects WHERE id = ? AND owner_id = ?")
        .run(id, user.id);
      return json(response, 200, { ok: true });
    }
    if (request.method === "PATCH" && existing) {
      const input = await body(request, 4096);
      accounts.session(request);
      const name = typeof input?.name === "string" ? input.name.trim() : "";
      if (!name || name.length > 120) throw new HttpError(400, "private-name");
      const revision = Number(request.headers["if-match"]);
      const now = Date.now();
      const project = JSON.parse(existing.project_json);
      project.projectName = name;
      const serialized = JSON.stringify(project);
      const changed = database.transaction(() => {
        checkQuota(user.id, Buffer.byteLength(serialized) - Buffer.byteLength(existing.project_json));
        return database
        .prepare(
          "UPDATE private_projects SET name = ?, updated_at = ?, revision = revision + 1, project_json = ? WHERE id = ? AND owner_id = ? AND revision = ?",
        )
        .run(name, now, serialized, id, user.id, revision);
      })();
      if (!changed.changes) throw new HttpError(409, "conflict");
      return json(response, 200, {
        id,
        name,
        updatedAt: now,
        revision: revision + 1,
      });
    }
    if (
      (request.method === "POST" && !id) ||
      (request.method === "PUT" && existing)
    ) {
      const project = validateProject(await body(request, maxProjectBytes));
      accounts.session(request); // Awaited upload may outlive session/logout/block.
      const name = (project.projectName || "").slice(0, 200);
      const now = Date.now();
      const serialized = JSON.stringify(project);
      if (existing) {
        const revision = Number(request.headers["if-match"]);
        const changed = database.transaction(() => {
          checkQuota(user.id, Buffer.byteLength(serialized) - Buffer.byteLength(existing.project_json));
          return database
          .prepare(
            "UPDATE private_projects SET name = ?, updated_at = ?, revision = revision + 1, project_json = ? WHERE id = ? AND owner_id = ? AND revision = ?",
          )
          .run(name, now, serialized, id, user.id, revision);
        })();
        if (!changed.changes) throw new HttpError(409, "conflict");
        return json(response, 200, { id, revision: revision + 1 });
      }
      const newId = randomUUID();
      database.transaction(() => {
        checkQuota(user.id, Buffer.byteLength(serialized));
        database.prepare("INSERT INTO private_projects VALUES (?, ?, ?, ?, 1, ?)")
          .run(newId, user.id, name, now, serialized);
      })();
      return json(response, 201, { id: newId, revision: 1 });
    }
    throw new HttpError(405, "method");
  }
  if (
    request.method === "POST" &&
    ["/api/projects", "/api/programs"].includes(path)
  ) {
    const program = path.endsWith("/programs");
    const payload = await body(
      request,
      maxProjectBytes + (program ? 16384 : 0),
    );
    const user = accounts.session(request, false);
    const publication = program
      ? validateProgram(payload, !!user?.trusted)
      : validateProject(payload, true, !!user?.trusted);
    // Expired/revoked optional cookies do not disable anonymous publication.
    // An account block protects authenticated/private access, not anonymous identity.
    return json(response, 201, storePublic(publication, user));
  }
  const publicMatch = path.match(/^\/api\/(projects|programs)\/([^/]+)$/);
  if (request.method === "GET" && publicMatch) {
    const row = publicRecord(publicMatch[2].toLowerCase());
    const payload = JSON.parse(row.project_json);
    const program = payload?.format === "bluek-program";
    if (publicMatch[1] === "programs") {
      if (!program) throw new HttpError(409, "project");
      return json(response, 200, {
        program: payload,
        expiresAt: row.expires_at,
      });
    }
    if (program && payload.allowBlueK === false)
      throw new HttpError(403, "developer-disabled");
    return json(response, 200, {
      project: program ? payload.project : payload,
      expiresAt: row.expires_at,
    });
  }
  throw new HttpError(404, "not-found");
}
export function createShareServer() {
  const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      if (response.headersSent) {
        response.end();
        return;
      }
      if (error instanceof HttpError) {
        if (error.details.retryAfter)
          response.setHeader("Retry-After", String(error.details.retryAfter));
        json(response, error.status, {
          error: error.message,
          ...error.details,
        });
      } else {
        console.error("BlueK API request failed:", error.code || error.name);
        json(response, 500, { error: "server" });
      }
    });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanup();
  const server = createShareServer();
  const port = Number(process.env.BLUEK_SHARE_PORT || 8787);
  const host = process.env.BLUEK_SHARE_HOST || "127.0.0.1";
  server.listen(port, host, () =>
    console.log(`BlueK API listening on http://${host}:${port}`),
  );
  const timer = setInterval(cleanup, 3600000);
  timer.unref();
  const stop = () => {
    clearInterval(timer);
    server.close(async () => {
      await feedback.close();
      database.close();
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
