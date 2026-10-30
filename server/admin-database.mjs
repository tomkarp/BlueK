import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Installed CLIs query the corresponding running service. This avoids guessing
// a production path or accidentally administering the other database.
const installations = new Map([
  ["/opt/bluek-share", "bluek-share"],
  ["/opt/bluek-beta-share", "bluek-beta-share"],
]);

export function adminDatabasePath(root, configured, dependencies = {}) {
  if (configured) return configured;
  const service = installations.get(root);
  if (!service) return resolve(dependencies.cwd || process.cwd(), "server/data/projects.sqlite");
  const getPid = dependencies.getPid || (name => execFileSync("systemctl", ["show", name, "--property=MainPID", "--value"], { encoding: "utf8" }));
  const readFile = dependencies.readFile || readFileSync;
  let pid;
  let environment;
  try {
    pid = getPid(service).trim();
    if (!/^[1-9]\d*$/.test(pid)) throw new Error("service is not running");
    environment = readFile(`/proc/${pid}/environ`, "utf8");
  } catch (error) {
    throw new Error(`Cannot read the running ${service} service configuration; start the service and use an account with access, or set BLUEK_SHARE_DB explicitly.`, { cause: error });
  }
  const database = environment.split("\0").find(item => item.startsWith("BLUEK_SHARE_DB="))?.slice("BLUEK_SHARE_DB=".length);
  if (!database) throw new Error(`BLUEK_SHARE_DB is not set in the running ${service} service; set it explicitly to select the database.`);
  return resolve(root, database);
}
