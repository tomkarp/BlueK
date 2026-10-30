// Operator-only local CLI. Access is protected by OS/SSH permissions to the API
// host and database, with no public admin registration or browser credential.
import Database from "better-sqlite3";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adminDatabasePath } from "./admin-database.mjs";
const [command, target] = process.argv.slice(2);
const commands = [
  "inspect",
  "block",
  "unblock",
  "accounts",
  "block-account",
  "unblock-account",
  "list-publications",
  "delete-account",
  "trust-account",
  "untrust-account",
];
if (
  !commands.includes(command) ||
  (!["accounts"].includes(command) && !target)
) {
  console.error(
    "Usage: node server/admin.mjs inspect CODE|block CODE|unblock CODE|accounts|block-account USERNAME|unblock-account USERNAME|trust-account USERNAME|untrust-account USERNAME|list-publications USERNAME|delete-account USERNAME",
  );
  process.exit(1);
}
const db = new Database(
  adminDatabasePath(resolve(dirname(fileURLToPath(import.meta.url)), ".."), process.env.BLUEK_SHARE_DB),
  { fileMustExist: true },
);
db.pragma("foreign_keys = ON");
try {
  if (command === "accounts")
    console.log(
      JSON.stringify(
        db
          .prepare(
            "SELECT id, username, blocked, trusted, last_used_at FROM accounts ORDER BY username",
          )
          .all(),
        null,
        2,
      ),
    );
  else if (command === "inspect") {
    const row = db
      .prepare(
        "SELECT projects.code, expires_at, project_json, accounts.username AS owner FROM projects LEFT JOIN public_codes USING (code) LEFT JOIN accounts ON accounts.id = public_codes.owner_id WHERE projects.code = ? AND expires_at > ?",
      )
      .get(target.toLowerCase(), new Date().toISOString());
    if (!row) throw new Error("Publication missing or expired.");
    console.log(
      JSON.stringify(
        {
          code: row.code,
          expiresAt: row.expires_at,
          owner: row.owner,
          payload: JSON.parse(row.project_json),
        },
        null,
        2,
      ),
    );
  } else if (command === "list-publications") {
    const user = db.prepare("SELECT id FROM accounts WHERE username = ?").get(target.toLowerCase());
    if (!user) throw new Error("Account not found.");
    console.log(JSON.stringify(db.prepare("SELECT projects.code, projects.expires_at AS expiresAt, projects.size_bytes AS size, public_codes.blocked FROM projects JOIN public_codes USING (code) WHERE owner_id = ? AND expires_at > ? ORDER BY created_at DESC").all(user.id, new Date().toISOString()), null, 2));
  } else if (command.endsWith("-account")) {
    db.transaction(() => {
      const user = db
        .prepare("SELECT id FROM accounts WHERE username = ?")
        .get(target.toLowerCase());
      if (!user) throw new Error("Account not found.");
      if (command === "delete-account") {
        db.prepare("DELETE FROM accounts WHERE id = ?").run(user.id);
        db.prepare("DELETE FROM login_attempts WHERE username = ?").run(target.toLowerCase());
        return;
      }
      if (command === "trust-account" || command === "untrust-account") {
        db.prepare("UPDATE accounts SET trusted = ? WHERE id = ?").run(command === "trust-account" ? 1 : 0, user.id);
        return;
      }
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
