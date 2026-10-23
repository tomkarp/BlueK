import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { backupDatabase } from "../server/backup-database.mjs";

const directory = await mkdtemp(join(tmpdir(), "bluek-db-backup-"));
try {
  const sourcePath = join(directory, "source.sqlite");
  const backupDirectory = join(directory, "backups");
  const source = new Database(sourcePath);
  source.exec("CREATE TABLE entries (value TEXT NOT NULL)");
  source.prepare("INSERT INTO entries VALUES (?)").run("preserved");
  source.close();

  const backupPath = await backupDatabase(sourcePath, backupDirectory);
  const backup = new Database(backupPath, {
    readonly: true,
    fileMustExist: true,
  });
  assert.equal(
    backup.prepare("SELECT value FROM entries").pluck().get(),
    "preserved",
  );
  backup.close();
  assert.equal((await stat(backupPath)).mode & 0o777, 0o600);
  assert.equal((await stat(backupDirectory)).mode & 0o777, 0o700);
  console.log("SQLite backup is consistent and private.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
