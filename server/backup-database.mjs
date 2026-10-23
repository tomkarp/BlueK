import { chmod, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import Database from "better-sqlite3";

const databasePath = process.argv[2];
const backupDirectory = process.argv[3];
export async function backupDatabase(sourcePath, backupDirectory) {
  const outputDirectory = resolve(backupDirectory);
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await chmod(outputDirectory, 0o700);
  const backupPath = resolve(
    outputDirectory,
    `projects-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
  );
  const database = new Database(resolve(sourcePath), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    await database.backup(backupPath);
  } finally {
    database.close();
  }
  await chmod(backupPath, 0o600);

  const retentionCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const name of await readdir(outputDirectory)) {
    if (
      !/^projects-.*\.sqlite$/.test(name) ||
      name === backupPath.split("/").at(-1)
    )
      continue;
    const path = resolve(outputDirectory, name);
    if ((await stat(path)).mtimeMs < retentionCutoff) await unlink(path);
  }
  return backupPath;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("server/backup-database.mjs")
) {
  if (!databasePath || !backupDirectory) {
    throw new Error(
      "Usage: node server/backup-database.mjs DATABASE_PATH BACKUP_DIRECTORY",
    );
  }
  await backupDatabase(databasePath, backupDirectory);
  console.log("Created a restricted SQLite backup before API deployment.");
}
