import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { flowStateCases } from "./flow-state-cases.mjs";
const reference = process.argv.includes("--reference"),
  audit = process.argv.includes("--audit");
const selected = process.argv
  .filter((x) => x.startsWith("only="))
  .flatMap((x) => x.slice(5).split(","));
const cases = selected.length
  ? flowStateCases.filter((c) => selected.includes(c.id))
  : flowStateCases;
const results = [];
let api;
if (!reference) {
  vm.runInThisContext(
    await readFile(
      process.env.BLUEK_BUNDLE ??
        new URL(
          "../frontend/public/kotlite/bluek-kotlite-browser.js",
          import.meta.url,
        ),
      "utf8",
    ),
  );
  api = globalThis["bluek-kotlite-browser"];
} else
  console.log(
    spawnSync("kotlinc", ["-version"], { encoding: "utf8" }).stderr.trim(),
  );
const directory = reference
  ? await mkdtemp(join(tmpdir(), "bluek-flow-state-"))
  : null;
try {
  for (const c of cases) {
    let accepted,
      message = "",
      output = null;
    if (reference) {
      for (const [name, source] of Object.entries(c.files))
        await writeFile(join(directory, name), source);
      const built = spawnSync(
        "kotlinc",
        [...Object.keys(c.files), "-include-runtime", "-d", "app.jar"],
        { cwd: directory, encoding: "utf8", timeout: 60000 },
      );
      assert.notEqual(
        built.status,
        null,
        `${c.id}: compiler failed or timed out`,
      );
      accepted = built.status === 0;
      message = built.stderr;
      if (accepted) {
        const run = spawnSync("java", ["-jar", "app.jar"], {
          cwd: directory,
          encoding: "utf8",
          timeout: 10000,
        });
        assert.equal(run.status, 0, `${c.id}: ${run.stderr}`);
        output = run.stdout;
      }
      for (const name of Object.keys(c.files)) await rm(join(directory, name));
    } else {
      const session = api.bluekCreateKotliteSession();
      const loaded = await new Promise((resolve) => {
        const r = JSON.parse(
          session.startLoadProject(
            Object.keys(c.files),
            Object.values(c.files),
            null,
            0,
            () => {},
            (v) => resolve(JSON.parse(v)),
          ),
        );
        if (r.kind === "error") resolve(r);
      });
      accepted = loaded.kind !== "error";
      message = loaded.display;
      if (!audit && !c.valid) {
        assert.equal(loaded.phase, "analysis", c.id);
        assert.ok(
          loaded.diagnostics.some((d) => d.severity === "error"),
          c.id,
        );
        assert.equal(session.takeOutput(), "", c.id);
      }
      if (accepted && c.valid) {
        const run = await new Promise((resolve) => {
          const r = JSON.parse(
            session.startMain(
              "Main.kt",
              () => {},
              (v) => resolve(JSON.parse(v)),
            ),
          );
          if (r.kind === "error") resolve(r);
        });
        output = run.kind === "error" ? run.display : session.takeOutput();
      }
    }
    results.push({ id: c.id, accepted, message, output });
    if (!audit) {
      assert.equal(accepted, c.valid, `${c.id}: ${message}`);
      if (c.valid) assert.equal(output, c.output, c.id);
    }
    console.log(
      `${c.id}: ${accepted ? "accepted" : "rejected"}${!audit ? " OK" : ""}${accepted !== c.valid ? " DIFFERENCE" : ""}${accepted && c.valid && output !== c.output ? " RUNTIME DIFFERENCE" : ""}`,
    );
  }
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
if (audit)
  await writeFile(
    new URL(
      `../.cache/flow-state-${reference ? "reference" : "bluek"}.json`,
      import.meta.url,
    ),
    JSON.stringify(results, null, 2),
  );
console.log(
  `${reference ? "Kotlin/JVM" : "BlueK"} flow-state ${audit ? "audit" : "regression"} completed: ${results.length} cases.`,
);
