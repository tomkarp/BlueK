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
  console.log("share server smoke test passed");
} finally {
  child.kill("SIGTERM");
  await rm(directory, { recursive: true, force: true });
}
