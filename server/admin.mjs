// Operator-only local CLI. Access is protected by OS/SSH permissions to the API
// host and database, with no public admin registration or browser credential.
import Database from "better-sqlite3";
import { resolve } from "node:path";
const [command, target] = process.argv.slice(2);
const commands = [
  "inspect",
  "block",
  "unblock",
  "accounts",
  "block-account",
  "unblock-account",
];
if (
  !commands.includes(command) ||
  (!["accounts"].includes(command) && !target)
) {
  console.error(
    "Usage: node server/admin.mjs inspect CODE|block CODE|unblock CODE|accounts|block-account USERNAME|unblock-account USERNAME",
  );
  process.exit(1);
}
const db = new Database(
  process.env.BLUEK_SHARE_DB || resolve("server/data/projects.sqlite"),
  { fileMustExist: true },
);
db.pragma("foreign_keys = ON");
try {
  if (command === "accounts")
    console.log(
      JSON.stringify(
        db
          .prepare(
            "SELECT id, username, blocked, last_used_at FROM accounts ORDER BY username",
          )
          .all(),
        null,
        2,
      ),
    );
  else if (command === "inspect") {
    const row = db
      .prepare(
        "SELECT code, expires_at, project_json FROM projects WHERE code = ? AND expires_at > ?",
      )
      .get(target.toLowerCase(), new Date().toISOString());
    if (!row) throw new Error("Publication missing or expired.");
    console.log(
      JSON.stringify(
        {
          code: row.code,
          expiresAt: row.expires_at,
          payload: JSON.parse(row.project_json),
        },
        null,
        2,
      ),
    );
  } else if (command.endsWith("-account")) {
    db.transaction(() => {
      const user = db
        .prepare("SELECT id FROM accounts WHERE username = ?")
        .get(target.toLowerCase());
      if (!user) throw new Error("Account not found.");
      const blocked = command === "block-account" ? 1 : 0;
      db.prepare("UPDATE accounts SET blocked = ? WHERE id = ?").run(
        blocked,
        user.id,
      );
      if (blocked)
        db.prepare("DELETE FROM sessions WHERE account_id = ?").run(user.id);
    })();
  } else if (
    !db
      .prepare("UPDATE public_codes SET blocked = ? WHERE code = ?")
      .run(command === "block" ? 1 : 0, target.toLowerCase()).changes
  )
    throw new Error("Publication not found.");
} finally {
  db.close();
}
