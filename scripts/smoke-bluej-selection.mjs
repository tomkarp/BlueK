import assert from "node:assert/strict";
import { rolldown } from "rolldown";
import { strToU8 } from "fflate";
const b = await rolldown({ input: "frontend/src/blueJImport.ts" });
const { output } = await b.generate({ format: "esm" });
await b.close();
const { blueJProjects, blueJProjectFromEntries } = await import(
  "data:text/javascript;base64," +
    Buffer.from(output[0].code).toString("base64")
);
const entry = (path, text) => ({ path, bytes: strToU8(text) });
const entries = [
  entry("course/unit2/demo/package.bluej", ""),
  entry("course/unit2/demo/Dog.kt", "class Dog"),
  entry("course/unit2/demo/README.TXT", "Dogs"),
  entry("course/unit1/demo/package.bluej", ""),
  entry("course/unit1/demo/Cat.kt", "class Cat"),
  entry("course/unit1/demo/README.TXT", "Cats"),
  entry("__MACOSX/course/package.bluej", ""),
  entry(".hidden/Hidden.kt", "class Hidden"),
];
assert.deepEqual(
  blueJProjects(entries).map((x) => x.root),
  ["course/unit1/demo/", "course/unit2/demo/"],
);
assert.throws(() => blueJProjectFromEntries(entries), /several BlueJ projects/);
assert.throws(() => blueJProjectFromEntries(entries, "missing/"), /not found/);
const p = blueJProjectFromEntries(entries, "course/unit2/demo/");
assert.deepEqual(
  p.files.map((x) => x.fileName),
  ["Dog.kt"],
);
assert.equal(p.readme, "Dogs");
assert.equal(
  blueJProjectFromEntries(entries.slice(0, 3)).files[0].fileName,
  "Dog.kt",
);
assert.deepEqual(
  blueJProjects([
    entry("Outer/package.bluej", ""),
    entry("Outer/A.kt", "class A"),
    entry("Outer/sub/package.bluej", ""),
    entry("Outer/sub/B.kt", "class B"),
  ]).map((x) => x.root),
  ["Outer/"],
);
assert.deepEqual(
  blueJProjects([
    entry("Collection/package.bluej", ""),
    entry("Collection/one/package.bluej", ""),
    entry("Collection/one/A.kt", "class A"),
  ]).map((x) => x.root),
  ["Collection/one/"],
);
assert.equal(
  blueJProjectFromEntries([entry("A.kt", "class A")]).files[0].fileName,
  "A.kt",
);
assert.deepEqual(
  blueJProjects([
    entry("one/A.kt", "class A"),
    entry("two/B.kt", "class B"),
  ]).map((x) => x.root),
  ["one/", "two/"],
);
assert.equal(
  blueJProjectFromEntries([
    entry("x\\package.bluej", ""),
    entry("x\\A.kt", "class A"),
  ]).files[0].fileName,
  "A.kt",
);
console.log(
  "BlueJ selection passed: independent roots, explicit choice, isolation, single-project fallback, nested packages, hidden metadata and Windows paths.",
);
