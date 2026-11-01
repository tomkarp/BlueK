import fs from "node:fs";
import path from "node:path";
import { compile } from "svelte/compiler";

const sourceRoot = path.resolve("frontend/src");

function svelteFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? svelteFiles(entryPath)
      : entry.name.endsWith(".svelte")
        ? [entryPath]
        : [];
  });
}

const files = svelteFiles(sourceRoot);
const errors = [];

for (const filename of files) {
  try {
    const result = compile(fs.readFileSync(filename, "utf8"), {
      filename,
      generate: false,
      runes: true,
    });
    if (!result.metadata.runes) {
      errors.push(`${path.relative(process.cwd(), filename)}: not compiled in runes mode`);
    }
  } catch (error) {
    errors.push(
      `${path.relative(process.cwd(), filename)}: ${error.code ?? "compile error"}: ${error.message}`,
    );
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Svelte Runes check passed: ${files.length} components.`);
}
