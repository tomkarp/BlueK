import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
const defaultDatabase = resolve(projectRoot, "server/data/projects.sqlite");
const defaultWordList = resolve(projectRoot, "data/share-words-en.txt");
const port = Number(process.env.BLUEK_SHARE_PORT || 8787);
const host = process.env.BLUEK_SHARE_HOST || "127.0.0.1";
const databasePath = process.env.BLUEK_SHARE_DB || defaultDatabase;
const wordListPath = process.env.BLUEK_SHARE_WORDS || defaultWordList;
const ttlMs = 30 * 24 * 60 * 60 * 1000;
const maxBodyBytes = 10 * 1024 * 1024;
const wordCount = 3;

await mkdir(dirname(databasePath), { recursive: true });
const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    code TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    project_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS projects_expires_at ON projects (expires_at);
`);
const deleteExpired = database.prepare("DELETE FROM projects WHERE expires_at <= ?");
const insertProject = database.prepare("INSERT INTO projects (code, created_at, expires_at, size_bytes, project_json) VALUES (?, ?, ?, ?, ?)");
const selectProject = database.prepare("SELECT expires_at, project_json FROM projects WHERE code = ?");

const words = (await readFile(wordListPath, "utf8")).split(/\r?\n/).map((word) => word.trim()).filter((word) => /^[a-z]{4,6}$/.test(word));
if (words.length < 100) throw new Error("The BlueK share word list is unexpectedly small.");

function cleanup() { deleteExpired.run(new Date().toISOString()); }
function projectCode() {
  const selected = [];
  for (let index = 0; index < wordCount; index += 1) selected.push(words[randomInt(words.length)]);
  return selected.join("-");
}
function validProject(value) {
  return value && typeof value === "object" && value.format === "bluek-project" && value.version === 1 && Array.isArray(value.files) && value.files.length > 0 && value.files.every((file) => file && typeof file.fileName === "string" && /^[-A-Za-z0-9_.]+\.kt$/.test(file.fileName) && typeof file.source === "string");
}
function validCode(value) { return typeof value === "string" && /^(?:[a-z]{4,6}-){2,3}[a-z]{4,6}$/.test(value); }
function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "content-length": Buffer.byteLength(body) });
  response.end(body);
}
async function requestBody(request) {
  let total = 0;
  const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBodyBytes) throw new Error("Project is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function storeProject(project) {
  const projectJson = JSON.stringify(project);
  const sizeBytes = Buffer.byteLength(projectJson);
  if (sizeBytes > maxBodyBytes) throw new Error("Project is too large.");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMs);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = projectCode();
    try {
      insertProject.run(code, createdAt.toISOString(), expiresAt.toISOString(), sizeBytes, projectJson);
      return { code, expiresAt: expiresAt.toISOString() };
    } catch (error) {
      if (error?.code !== "SQLITE_CONSTRAINT_PRIMARYKEY") throw error;
    }
  }
  throw new Error("Could not allocate a project code.");
}
async function handle(request, response) {
  cleanup();
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" });
    response.end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, { ok: true });
  if (request.method === "POST" && url.pathname === "/api/projects") {
    try {
      const project = JSON.parse(await requestBody(request));
      if (!validProject(project)) return json(response, 400, { error: "Invalid BlueK project." });
      return json(response, 201, storeProject(project));
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : "Invalid request." });
    }
  }
  const match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (request.method === "GET" && match) {
    if (!validCode(match[1])) return json(response, 400, { error: "Invalid project code." });
    const record = selectProject.get(match[1]);
    if (!record || Date.parse(record.expires_at) <= Date.now()) return json(response, 404, { error: "Project not found or expired." });
    try { return json(response, 200, { project: JSON.parse(record.project_json), expiresAt: record.expires_at }); }
    catch { return json(response, 404, { error: "Project not found or expired." }); }
  }
  return json(response, 404, { error: "Not found." });
}
export function createShareServer() {
  return createServer((request, response) => { handle(request, response).catch((error) => json(response, 500, { error: error instanceof Error ? error.message : "Server error." })); });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createShareServer();
  server.listen(port, host, () => console.log(`BlueK share API listening on http://${host}:${port}`));
  const stop = () => { database.close(); server.close(() => undefined); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => cleanup(), 60 * 60 * 1000).unref();
}
