import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "bluek-share-test-"));
const databasePath = join(directory, "projects.sqlite");
const port = 18787;
const child = spawn(process.execPath, ["server/share-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, BLUEK_SHARE_PORT: String(port), BLUEK_SHARE_DB: databasePath },
  stdio: ["ignore", "pipe", "inherit"],
});
try {
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const project = { format: "bluek-project", version: 1, files: [{ fileName: "Hund.kt", kind: "class", source: "class Hund {}" }] };
  const saved = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(project) });
  if (saved.status !== 201) throw new Error(`Save failed with HTTP ${saved.status}`);
  const savedBody = await saved.json();
  if (!/^(?:[a-z]{4,6}-){2}[a-z]{4,6}$/.test(savedBody.code)) throw new Error("The generated project code has the wrong shape.");
  const loaded = await fetch(`${base}/api/projects/${savedBody.code}`);
  const loadedBody = await loaded.json();
  if (loaded.status !== 200 || JSON.stringify(loadedBody.project) !== JSON.stringify(project)) throw new Error("The stored project did not round-trip.");
  const missing = await fetch(`${base}/api/projects/aaaa-bbbb-cccc-dddd`);
  if (missing.status !== 404) throw new Error(`Missing project returned HTTP ${missing.status}`);
  const program = {
    format: "bluek-program", version: 1, mainFile: "Game.kt", blueKUrl: "https://bluek.de/",
    project: { ...project, library: { id: "blueplay", version: 1 }, files: [{ fileName: "Game.kt", kind: "functions", source: "fun main() { World(160, 80, 1).show() }" }] },
    allowDownload: false, allowBlueK: true, showProjectName: false, autoRun: true, showControls: false, showSpeed: true,
  };
  const saveProgram = value => fetch(`${base}/api/programs`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value),
  });
  const programSaved = await saveProgram(program);
  assert.equal(programSaved.status, 201);
  const receipt = await programSaved.json();
  assert.match(receipt.code, /^(?:[a-z]{4,6}-){2}[a-z]{4,6}$/);
  assert.ok(Math.abs(Date.parse(receipt.expiresAt) - Date.now() - 30 * 24 * 60 * 60 * 1000) < 5000);
  const programLoaded = await fetch(`${base}/api/programs/${receipt.code}`);
  assert.equal(programLoaded.status, 200);
  assert.deepEqual((await programLoaded.json()).program, program);
  // A runnable export opens as its project unless "Open in BlueK" is disabled.
  const editable = await fetch(`${base}/api/projects/${receipt.code}`);
  assert.equal(editable.status, 200);
  assert.deepEqual((await editable.json()).project, program.project);
  const blocked = await (await saveProgram({ ...program, allowBlueK: false })).json();
  assert.equal((await fetch(`${base}/api/programs/${blocked.code}`)).status, 200);
  const refused = await fetch(`${base}/api/projects/${blocked.code}`);
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).error, "This program does not allow opening in BlueK.");
  // A project code is not playable; the distinct status lets the player offer the project.
  const notProgram = await fetch(`${base}/api/programs/${savedBody.code}`);
  assert.equal(notProgram.status, 409);
  assert.match((await notProgram.json()).error, /belongs to an editable BlueK project/);
  const missingProgram = await fetch(`${base}/api/programs/aaaa-bbbb-cccc`);
  assert.equal(missingProgram.status, 404);
  assert.equal((await missingProgram.json()).error, "Program not found or expired.");
  assert.equal((await fetch(`${base}/api/programs/Not-A-Code`)).status, 400);
  for (const invalid of [
    { ...program, mainFile: "Missing.kt" }, { ...program, allowDownload: "false" },
    { ...program, blueKUrl: "javascript:alert(1)" }, { ...program, autoRun: false, showControls: false },
    { ...program, showProjectName: "no" }, { ...program, showSpeed: "yes" }, { ...program, version: 2 },
  ]) assert.equal((await saveProgram(invalid)).status, 400);
  const database = new Database(databasePath);
  database.prepare("UPDATE projects SET expires_at = ? WHERE code = ?").run("2020-01-01T00:00:00.000Z", receipt.code);
  assert.equal((await fetch(`${base}/api/programs/${receipt.code}`)).status, 404, "Expired programs cannot be played");
  assert.equal((await fetch(`${base}/api/projects/${receipt.code}`)).status, 404, "Expired programs cannot be opened in BlueK");
  assert.equal(database.prepare("SELECT code FROM projects WHERE code = ?").get(receipt.code), undefined, "Expired programs are removed");
  database.close();
  console.log("share server smoke test passed (projects, programs, options, editable programs, blocked/project-code statuses, 30-day expiry)");
} finally {
  child.kill("SIGTERM");
  await rm(directory, { recursive: true, force: true });
}
