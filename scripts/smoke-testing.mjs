import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { rolldown } from "rolldown";
const module = async (path) => {
  const b = await rolldown({ input: path });
  const { output } = await b.generate({ format: "esm" });
  await b.close();
  return import(
    "data:text/javascript;base64," +
      Buffer.from(output[0].code).toString("base64")
  );
};
const { LocalRuntimeClient } = await module(
  "frontend/src/localRuntimeClient.ts",
);
const { RuntimeHost } = await module("frontend/src/runtimeHost.ts");
vm.runInThisContext(
  await fs.readFile("frontend/public/kotlite/bluek-kotlite-browser.js", "utf8"),
);
const session = globalThis["bluek-kotlite-browser"].bluekCreateKotliteSession;
class Worker {
  host = new RuntimeHost(session);
  postMessage(c) {
    setTimeout(
      () => this.host.dispatch(c.id, c, (data) => this.onmessage?.({ data })),
      0,
    );
  }
  terminate() {}
}
const client = new LocalRuntimeClient(() => new Worker());
const file = (name, source) => ({
  id: name,
  fileName: name + ".kt",
  kind: "class",
  revision: 1,
  source,
});
const hund = file(
  "Hund",
  "class Hund { var alter=0; val remainingLifeYears:Int get()=90-alter; fun geburtstag(){alter++}; fun wieAlt(): Int = alter; fun self(): Hund = this }",
);
const template = file(
  "HundTest",
  `import kotlin.test.*
class HundTest {
    @BeforeTest fun setUp() { }
    @Test fun existingTest() { assertTrue(true) }
    fun helper() = "kept"
}`,
);
const apiTest = file(
  "ApiTest",
  `import kotlin.test.*
class ApiTest {
    @Test fun allAssertions() {
        val text: String? = "Hund"
        val value = assertNotNull(actual=text, message="not null")
        assertEquals(expected="Hund", actual=value, message="text")
        assertEquals(expected=4, actual=text.length)
        assertTrue(actual=value.length == 4, message="length")
        assertFalse(actual=value.isEmpty(), message="empty")
        assertNull(actual=null, message="null")
        assertNotEquals(illegal=0.0, actual=-0.0, message="signed zero")
        assertEquals(expected=Double.NaN, actual=Double.NaN)
        assertFalse(-0.0 < 0.0)
        assertFalse(-0.0 > 0.0)
        assertTrue(-0.0 <= 0.0)
        assertTrue(-0.0 >= 0.0)
        assertFalse(Double.NaN < 0.0)
        assertFalse(Double.NaN > 0.0)
        assertFalse(Double.NaN <= 0.0)
        assertFalse(Double.NaN >= 0.0)
        try { fail(message="explicit failure") }
        catch (e: AssertionError) { assertEquals("explicit failure", e.message) }
    }
    @Ignore @Test fun ignored() { fail() }
}`,
);
const compile = async (files) => {
  const r = await client.compile(files, 1);
  assert.deepEqual(
    r.diagnostics.filter((d) => d.severity === "error"),
    [],
  );
  return r;
};
const execute = async (c) => {
  const r = await client.execute(c);
  assert.notEqual(r.kind, "error", r.display);
  return r;
};
// Empty marked classes support state transfer and recording before they contain @Test methods.
const emptyState = {
  ...file("EmptyState", "import kotlin.test.*\nclass EmptyState"),
  isTestClass: true,
};
const snapshotClass = file(
  "CapturedValue",
  "class CapturedValue(val value: Int)",
);
const mutatorClass = file(
  "Mutator",
  "class Mutator(h: Hund) { init { h.geburtstag() } }",
);
await compile([hund, snapshotClass, mutatorClass, emptyState]);
assert.equal(
  client.getSnapshot().classes.find((c) => c.name === "EmptyState").testing
    .methods.length,
  0,
);
const firstDog = await execute({
  op: "create",
  className: "Hund",
  name: "firstDog",
  args: [],
});
await execute({
  op: "invoke",
  objectId: firstDog.objectId,
  name: "geburtstag",
  args: [],
});
await execute({
  op: "create",
  className: "CapturedValue",
  name: "capturedValue",
  args: ["firstDog.alter"],
});
const discardedMutator = await execute({
  op: "create",
  className: "Mutator",
  name: "unusedMutator",
  args: ["firstDog"],
});
await execute({
  op: "remove",
  objectId: discardedMutator.objectId,
  name: "unusedMutator",
});
await execute({
  op: "invoke",
  objectId: firstDog.objectId,
  name: "self",
  args: [],
});
await execute({ op: "bind", objectId: firstDog.objectId, name: "sameDog" });
let orderedStateSource;
for (let round = 0; round < 2; round++) {
  const state = await execute({
    op: "testing",
    action: "fixtureSource",
    className: "EmptyState",
  });
  orderedStateSource = state.generatedSource;
  assert.doesNotMatch(orderedStateSource, /unusedMutator/);
  assert.match(
    orderedStateSource,
    /Mutator\(firstDog\)/,
    "Removing an unused name must retain constructor side effects",
  );
  await compile([
    hund,
    snapshotClass,
    mutatorClass,
    { ...emptyState, source: state.generatedSource },
  ]);
  await execute({ op: "fixture", className: "EmptyState" });
  assert.equal(
    (await execute({ op: "eval", code: "firstDog.alter" })).display,
    "2",
  );
  assert.equal(
    (await execute({ op: "eval", code: "capturedValue.value" })).display,
    "1",
  );
  assert.equal(
    (await execute({ op: "eval", code: "firstDog === sameDog" })).display,
    "true",
  );
}
await execute({ op: "testing", action: "begin", className: "EmptyState" });
await execute({ op: "eval", code: "capturedValue.value" });
await execute({ op: "testing", action: "assert", value: "1" });
orderedStateSource = (
  await execute({
    op: "testing",
    action: "recordSource",
    value: "orderedState",
  })
).generatedSource;
await compile([
  hund,
  snapshotClass,
  mutatorClass,
  { ...emptyState, source: orderedStateSource },
]);
await execute({ op: "tests", className: "EmptyState" });
assert.equal(client.getSnapshot().testing.cases[0].status, "passed");

// A typed Codepad declaration can be exposed with its existing name without redeclaring it.
await compile([hund, emptyState]);
await execute({ op: "eval", code: "val codepadDog: Hund = Hund()" });
const codepadReference = client
  .getSnapshot()
  .references.find((ref) => ref.name === "codepadDog");
await execute({
  op: "bind",
  objectId: codepadReference.objectId,
  name: "codepadDog",
});
const codepadState = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "EmptyState",
});
await compile([hund, { ...emptyState, source: codepadState.generatedSource }]);
await execute({ op: "fixture", className: "EmptyState" });
assert.ok(
  client
    .getSnapshot()
    .references.some((ref) => ref.name === "codepadDog" && ref.onBench),
);

// Reassigning a Codepad reference cannot silently produce an invalid generated val field.
await compile([hund, emptyState]);
await execute({ op: "eval", code: "var changingDog = Hund()" });
await execute({ op: "eval", code: "changingDog = Hund()" });
await execute({
  op: "bind",
  objectId: client
    .getSnapshot()
    .references.find((ref) => ref.name === "changingDog").objectId,
  name: "changingDog",
});
const reassignedState = await client.execute({
  op: "testing",
  action: "fixtureSource",
  className: "EmptyState",
});
assert.equal(reassignedState.kind, "error");
assert.match(reassignedState.display, /reference cannot be reassigned/);

// Loading remains valid, but flattening a shadowed setup must not offer a corrupt replay.
await compile([
  hund,
  file(
    "ShadowState",
    `import kotlin.test.*\nclass ShadowState {
    val h = Hund()
    @BeforeTest fun prepare() { val h = Hund(); this.h.geburtstag() }
}`,
  ),
]);
await execute({ op: "fixture", className: "ShadowState" });
assert.equal(client.getSnapshot().testing.canCapture, false);
assert.match(
  client.getSnapshot().testing.captureError,
  /shadows a state property/,
);

// Obsolete generated marker comments are removed without touching string contents or authored comments.
const legacyState = file(
  "LegacyState",
  `import kotlin.test.*\nclass LegacyState {
    // BlueK fixture begin
    val h = Hund()
    @BeforeTest fun prepare() { h.geburtstag() }
    // BlueK fixture end
    // Keep this explanation.
    @Test fun kept() { assertEquals(1, h.alter); assertEquals("// BlueK fixture begin", "// BlueK fixture begin") }
}`,
);
await compile([hund, legacyState]);
await execute({ op: "fixture", className: "LegacyState" });
const legacyCapture = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "LegacyState",
});
assert.doesNotMatch(
  legacyCapture.generatedSource,
  /^\s*\/\/ BlueK fixture (begin|end)/m,
);
assert.match(legacyCapture.generatedSource, /Keep this explanation/);
assert.match(legacyCapture.generatedSource, /"\/\/ BlueK fixture begin"/);
await compile([
  hund,
  { ...legacyState, source: legacyCapture.generatedSource },
]);
await execute({ op: "tests", className: "LegacyState" });
assert.equal(client.getSnapshot().testing.cases[0].status, "passed");

// Aliased/qualified setup annotations and accessors must be replaced as complete declarations.
for (const annotation of ["@Prep()", "@kotlin.test.BeforeTest"]) {
  const aliasState = file(
    "AliasState",
    `import kotlin.test.*\nimport kotlin.test.BeforeTest as Prep
class AliasState {
    private val h: Hund = Hund()\n        get() = field
    ${annotation} public fun prepare() { this.h.geburtstag() }
    @Test fun kept() { assertEquals(1, h.alter) }
}`,
  );
  await compile([hund, aliasState]);
  await execute({ op: "fixture", className: "AliasState" });
  const source = (
    await execute({
      op: "testing",
      action: "fixtureSource",
      className: "AliasState",
    })
  ).generatedSource;
  assert.doesNotMatch(
    source,
    /private val|public fun prepare|@Prep\(\)|@kotlin.test.BeforeTest/,
  );
  await compile([hund, { ...aliasState, source }]);
  await execute({ op: "tests", className: "AliasState" });
  assert.equal(client.getSnapshot().testing.cases[0].status, "passed");
}

// Raw string indentation also survives first-time saving into a brand-new class.
const rawText = file("RawText", "class RawText(val text: String)");
await compile([rawText]);
await execute({
  op: "create",
  className: "RawText",
  name: "rawText",
  args: ['"""first\nsecond"""'],
});
const firstTimeRaw = (
  await execute({
    op: "testing",
    action: "fixtureSource",
    className: "RawState",
  })
).generatedSource;
await compile([rawText, file("RawState", firstTimeRaw)]);
await execute({ op: "fixture", className: "RawState" });
assert.equal(
  (await execute({ op: "eval", code: "rawText.text" })).display,
  "first\nsecond",
);

await compile([hund, template]);
const object = await execute({
  op: "create",
  className: "Hund",
  name: "hund1",
  args: [],
});
await execute({
  op: "invoke",
  objectId: object.objectId,
  name: "geburtstag",
  args: [],
});
await execute({
  op: "invoke",
  objectId: object.objectId,
  name: "wieAlt",
  args: [],
});
await execute({
  op: "inspectGet",
  objectId: object.objectId,
  property: "remainingLifeYears",
});
let generated = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "HundTest",
});
assert.match(generated.generatedSource, /val hund1: Hund = Hund\(\)/);
assert.equal(generated.replacesFixture, true);
assert.doesNotMatch(generated.generatedSource, /lateinit/);
assert.doesNotMatch(generated.generatedSource, /hund1 = Hund\(\)/);
assert.doesNotMatch(generated.generatedSource, /BlueK fixture/);
assert.match(generated.generatedSource, /hund1\.geburtstag\(\)/);
assert.match(generated.generatedSource, /hund1\.wieAlt\(\)/);
assert.doesNotMatch(
  generated.generatedSource,
  /val result\d+ = hund1\.wieAlt\(\)/,
);
assert.doesNotMatch(generated.generatedSource, /remainingLifeYears/);
assert.doesNotMatch(generated.generatedSource, /`geburtstag`/);
assert.match(generated.generatedSource, /fun existingTest\(\)/);
assert.match(generated.generatedSource, /fun helper\(\)/);
const fixture = { ...template, source: generated.generatedSource };
await compile([hund, fixture]);
await execute({ op: "fixture", className: "HundTest" });
const restoredForExplicitGet = client
  .getSnapshot()
  .references.find((r) => r.name === "hund1" && r.onBench);
await execute({
  op: "get",
  objectId: restoredForExplicitGet.objectId,
  property: "remainingLifeYears",
});
const formattedCapture = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "HundTest",
});
assert.equal(formattedCapture.generatedSource.match(/@BeforeTest/g).length, 1);
assert.match(formattedCapture.generatedSource, /hund1\.remainingLifeYears/);
assert.doesNotMatch(
  formattedCapture.generatedSource,
  /val result\d+ = hund1\.remainingLifeYears/,
);
assert.equal(formattedCapture.replacesFixture, true);
await compile([hund, fixture]);
await execute({ op: "fixture", className: "HundTest" });
const restored = client
  .getSnapshot()
  .references.find((r) => r.name === "hund1" && r.onBench);
assert.ok(restored);
assert.equal(
  (await execute({ op: "get", objectId: restored.objectId, property: "alter" }))
    .display,
  "1",
);
await execute({ op: "testing", action: "begin", className: "HundTest" });
await execute({
  op: "invoke",
  objectId: restored.objectId,
  name: "geburtstag",
  args: [],
});
assert.equal(
  (
    await execute({
      op: "invoke",
      objectId: restored.objectId,
      name: "wieAlt",
      args: [],
    })
  ).display,
  "2",
);
await execute({ op: "testing", action: "assert", value: "2" });
generated = await execute({
  op: "testing",
  action: "recordSource",
  className: "HundTest",
  value: "geburtstag",
});
assert.match(generated.generatedSource, /@Test/);
assert.match(generated.generatedSource, /fun geburtstag\(\)/);
assert.doesNotMatch(generated.generatedSource, /`geburtstag`|`wieAlt`/);
assert.match(generated.generatedSource, /assertEquals\(2, result\d+\)/);
const portableRecordedSource = generated.generatedSource;
await compile([hund, { ...template, source: generated.generatedSource }]);
await execute({ op: "tests", className: "HundTest" });
assert.deepEqual(
  client.getSnapshot().testing.cases.map((c) => c.status),
  ["passed", "passed"],
);
await compile([hund, fixture]);
await execute({ op: "fixture", className: "HundTest" });
const restored2 = client
  .getSnapshot()
  .references.find((r) => r.name === "hund1");
await execute({
  op: "invoke",
  objectId: restored2.objectId,
  name: "geburtstag",
  args: [],
});
generated = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "HundTest",
});
await compile([hund, { ...template, source: generated.generatedSource }]);
await execute({ op: "fixture", className: "HundTest" });
assert.equal(
  (
    await execute({
      op: "get",
      objectId: client.getSnapshot().references.find((r) => r.name === "hund1")
        .objectId,
      property: "alter",
    })
  ).display,
  "2",
);
// Unused return names are omitted, while object returns used by later calls remain bound.
const counter = file(
  "Counter",
  "class Counter { var value=0; fun read():Int=value; fun self():Counter=this; fun increment(){value++} }",
);
const counterTemplate = file(
  "CounterTest",
  "import kotlin.test.*\nclass CounterTest { @BeforeTest fun setUp() {} }",
);
await compile([counter, counterTemplate]);
const counterObject = await execute({
  op: "create",
  className: "Counter",
  name: "counter1",
  args: [],
});
await execute({
  op: "invoke",
  objectId: counterObject.objectId,
  name: "read",
  args: [],
});
await execute({
  op: "invoke",
  objectId: counterObject.objectId,
  name: "self",
  args: [],
});
await execute({
  op: "invoke",
  objectId: counterObject.objectId,
  name: "increment",
  args: [],
});
const counterFixture = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "CounterTest",
});
assert.doesNotMatch(
  counterFixture.generatedSource,
  /val result1 = counter1\.read\(\)/,
);
assert.match(counterFixture.generatedSource, /counter1\.read\(\)/);
assert.match(
  counterFixture.generatedSource,
  /val result2 = counter1\.self\(\)/,
);
assert.match(counterFixture.generatedSource, /result2\.increment\(\)/);
const discarded = await execute({
  op: "create",
  className: "Counter",
  name: "discardedCounter",
  args: [],
});
await execute({
  op: "remove",
  objectId: discarded.objectId,
  name: "discardedCounter",
});
const afterDiscard = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "CounterTest",
});
assert.doesNotMatch(afterDiscard.generatedSource, /discardedCounter/);
const usedButRemoved = await execute({
  op: "create",
  className: "Counter",
  name: "usedButRemoved",
  args: [],
});
await execute({
  op: "invoke",
  objectId: usedButRemoved.objectId,
  name: "read",
  args: [],
});
await execute({
  op: "remove",
  objectId: usedButRemoved.objectId,
  name: "usedButRemoved",
});
const afterUsedRemoval = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "CounterTest",
});
assert.match(
  afterUsedRemoval.generatedSource,
  /val usedButRemoved = Counter\(\)/,
);
assert.match(afterUsedRemoval.generatedSource, /usedButRemoved\.read\(\)/);
await compile([
  counter,
  { ...counterTemplate, source: afterUsedRemoval.generatedSource },
]);
await execute({ op: "fixture", className: "CounterTest" });
assert.equal(
  (
    await execute({
      op: "get",
      objectId: client
        .getSnapshot()
        .references.find((r) => r.name === "counter1").objectId,
      property: "value",
    })
  ).display,
  "1",
);
// Multiline argument text survives capture, restore and another capture unchanged.
const textClass = file("Text", "class Text(val text:String)");
const textTemplate = file(
  "TextTest",
  template.source.replace("HundTest", "TextTest"),
);
await compile([textClass, textTemplate]);
await execute({
  op: "create",
  className: "Text",
  name: "text1",
  args: ['"""erste\nzweite"""'],
});
for (let round = 0; round < 2; round++) {
  const savedText = await execute({
    op: "testing",
    action: "fixtureSource",
    className: "TextTest",
  });
  await compile([
    textClass,
    { ...textTemplate, source: savedText.generatedSource },
  ]);
  await execute({ op: "fixture", className: "TextTest" });
  const text = client.getSnapshot().references.find((r) => r.name === "text1");
  assert.equal(
    (await execute({ op: "get", objectId: text.objectId, property: "text" }))
      .display,
    "erste\nzweite",
  );
}
await execute({ op: "testing", action: "begin", className: "TextTest" });
await execute({
  op: "get",
  objectId: client.getSnapshot().references.find((r) => r.name === "text1")
    .objectId,
  property: "text",
});
await execute({ op: "testing", action: "assert", value: '"erste\\nzweite"' });
const portableTextSource = (
  await execute({
    op: "testing",
    action: "recordSource",
    className: "TextTest",
    value: "textUnchanged",
  })
).generatedSource;
await compile([textClass, file("TextTest", portableTextSource)]);
await execute({ op: "tests" });
assert.deepEqual(
  client.getSnapshot().testing.cases.map((c) => c.status),
  ["passed", "passed"],
);
// Fresh instances, teardown even after setup failure, classification and ignore.
const tests = file(
  "LifeTest",
  `import kotlin.test.*
class LifeTest {
  var counter=0
  @BeforeTest fun before(){ counter++ }
  @AfterTest fun after(){ println("after") }
  @Test fun first(){ assertEquals(1,counter) }
  @Test fun second(){ assertEquals(1,counter) }
  @Test fun wrong(){ assertEquals(9,counter,"age") }
  @Test fun thrown(){ throw IllegalStateException("broken") }
  @Ignore @Test fun ignored(){ fail() }
  @Test fun \`spaces work\`(){ assertTrue(true);assertFalse(false);assertNull(null);assertNotNull("yes");assertNotEquals(illegal=1,actual=2) }
}`,
);
await compile([tests]);
await execute({ op: "tests" });
assert.deepEqual(
  client.getSnapshot().testing.cases.map((c) => c.status),
  ["passed", "passed", "failed", "error", "ignored", "passed"],
);
assert.match(client.getSnapshot().testing.cases[2].errors[0], /age/);
assert.match(client.getSnapshot().testing.cases[2].errors[0], /LifeTest.kt/);
const setupFailure = file(
  "SetupTest",
  'import kotlin.test.*\nclass SetupTest { @BeforeTest fun setup(){ fail("setup") }; @AfterTest fun after(){ fail("cleanup") }; @Test fun body(){ fail("body") } }',
);
await compile([setupFailure]);
await execute({ op: "tests" });
assert.equal(client.getSnapshot().testing.cases[0].errors.length, 2);
assert.doesNotMatch(
  client.getSnapshot().testing.cases[0].errors.join(""),
  /body\)/,
);
for (const source of [
  "import kotlin.test.*\nclass Bad { @Test fun test(a:Int) {} }",
  "import kotlin.test.*\nclass Bad { @BeforeTest @Test fun test() {} }",
  "class Bad { @BeforeAll fun test() {} }",
  "import kotlin.test.*\nclass Bad(val count:Int = 0) { @Test fun test() {} }",
  "import kotlin.test.*\nclass Bad(@Test val count:Int) { @Test fun test() {} }",
  "import kotlin.test.*\nclass Bad { @Test fun `bad.name`() {} }",
  "import kotlin.test.*\nenum class Bad { A; @Test fun test() {} }",
  "import kotlin.test.*\nsealed class Bad { @Test fun test() {} }",
]) {
  const r = await client.compile([file("Bad", source)], 1);
  assert.ok(
    r.diagnostics.some((d) => d.severity === "error"),
    source,
  );
}
// A handwritten fixture can be loaded; saving warns and replaces all properties and setup, preserving methods.
await compile([
  hund,
  file(
    "ManualTest",
    "import kotlin.test.*\nclass ManualTest { private val h = Hund(); @Test fun existing(){ assertEquals(0,h.alter) } }",
  ),
]);
await execute({ op: "fixture", className: "ManualTest" });
const rewrittenManual = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "ManualTest",
});
assert.equal(rewrittenManual.replacesFixture, true);
assert.doesNotMatch(rewrittenManual.generatedSource, /private val h/);
assert.match(rewrittenManual.generatedSource, /fun existing\(\)/);
await compile([hund, file("ManualTest", rewrittenManual.generatedSource)]);
await execute({ op: "fixture", className: "ManualTest" });
await execute({ op: "testing", action: "begin", className: "ManualTest" });
const h = client.getSnapshot().references.find((r) => r.name === "h");
await execute({ op: "invoke", objectId: h.objectId, name: "wieAlt", args: [] });
await execute({ op: "testing", action: "assert", value: "0" });
const manualSource = await execute({
  op: "testing",
  action: "recordSource",
  className: "ManualTest",
  value: "recorded",
});
await compile([hund, file("ManualTest", manualSource.generatedSource)]);
await execute({ op: "tests", className: "ManualTest" });
assert.deepEqual(
  client.getSnapshot().testing.cases.map((c) => c.status),
  ["passed", "passed"],
);
// Import aliases and fully qualified annotations are ordinary Kotlin.
await compile([
  file(
    "AnnotationTest",
    "import kotlin.test.Test as Case\nclass AnnotationTest { @Case fun aliased() {}; @kotlin.test.Test fun qualified() {} }",
  ),
]);
await execute({ op: "tests" });
assert.deepEqual(
  client.getSnapshot().testing.cases.map((c) => c.status),
  ["passed", "passed"],
);
// A suspended run publishes progress and can be stopped. Late replies stay discarded.
await compile([
  file(
    "WaitingTest",
    "import kotlin.test.*\nclass WaitingTest { @Test fun waits(){ readln() }; @Test fun next() {} }",
  ),
]);
const pending = client.execute({ op: "tests" }).catch((e) => e);
await new Promise((resolve) => {
  const off = client.subscribe(() => {
    if (client.getSnapshot().phase === "waitingForInput") {
      off();
      resolve();
    }
  });
});
assert.equal(client.getSnapshot().testing.status, "running");
await client.stop();
assert.equal(client.getSnapshot().testing.status, "aborted");
assert.deepEqual(
  client.getSnapshot().testing.cases.map((c) => c.status),
  ["aborted", "aborted"],
);
await pending;
// Cancel drops drafted assertions and retains actual bench operations.
await compile([hund, fixture]);
await execute({ op: "fixture", className: "HundTest" });
await execute({ op: "testing", action: "begin", className: "HundTest" });
const cancelled = client
  .getSnapshot()
  .references.find((r) => r.name === "hund1");
await execute({
  op: "invoke",
  objectId: cancelled.objectId,
  name: "wieAlt",
  args: [],
});
await execute({ op: "testing", action: "assert", value: "1" });
await execute({ op: "testing", action: "cancel" });
const captured = await execute({
  op: "testing",
  action: "fixtureSource",
  className: "HundTest",
});
assert.doesNotMatch(captured.generatedSource, /assertEquals/);
console.log(
  "Testing: discovery, lifecycle, assertions, fixtures both ways, recording, source round-trip and diagnostics passed.",
);
await compile([apiTest]);
await execute({ op: "tests" });
assert.deepEqual(
  client.getSnapshot().testing.cases.map((c) => c.status),
  ["passed", "ignored"],
);

if (process.argv.includes("--jvm")) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const path = await import("node:path");
  const root = path.resolve(".cache/kotlin-test-portability");
  await fs.mkdir(path.join(root, "src/test/kotlin"), { recursive: true });
  await fs.writeFile(
    path.join(root, "settings.gradle.kts"),
    'rootProject.name = "bluek-test-portability"\n',
  );
  await fs.writeFile(
    path.join(root, "build.gradle.kts"),
    `plugins { kotlin("jvm") version "2.2.21" }
repositories { mavenCentral() }
dependencies {
  testImplementation(kotlin("test-junit5"))
  testImplementation("org.junit.jupiter:junit-jupiter:6.0.0")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher:6.0.0")
}
tasks.test { useJUnitPlatform() }
`,
  );
  await fs.writeFile(path.join(root, "src/test/kotlin/Hund.kt"), hund.source);
  await fs.writeFile(
    path.join(root, "src/test/kotlin/HundTest.kt"),
    portableRecordedSource,
  );
  await fs.writeFile(
    path.join(root, "src/test/kotlin/ApiTest.kt"),
    apiTest.source,
  );
  await fs.writeFile(
    path.join(root, "src/test/kotlin/Text.kt"),
    textClass.source,
  );
  await fs.writeFile(
    path.join(root, "src/test/kotlin/TextTest.kt"),
    portableTextSource,
  );
  for (const generatedFile of [
    snapshotClass,
    mutatorClass,
    file("EmptyState", orderedStateSource),
  ]) {
    await fs.writeFile(
      path.join(root, "src/test/kotlin", generatedFile.fileName),
      generatedFile.source,
    );
  }
  const { stdout } = await promisify(execFile)(
    path.resolve("jvm/gradlew"),
    ["-p", root, "clean", "test", "--no-daemon"],
    { maxBuffer: 4 * 1024 * 1024 },
  );
  assert.match(stdout, /BUILD SUCCESSFUL/);
  const xml = await fs.readFile(
    path.join(root, "build/test-results/test/TEST-HundTest.xml"),
    "utf8",
  );
  assert.match(xml, /tests="2"/);
  assert.match(xml, /failures="0"/);
  assert.match(xml, /errors="0"/);
  const apiXml = await fs.readFile(
    path.join(root, "build/test-results/test/TEST-ApiTest.xml"),
    "utf8",
  );
  assert.match(apiXml, /tests="2"/);
  assert.match(apiXml, /skipped="1"/);
  assert.match(apiXml, /failures="0"/);
  assert.match(apiXml, /errors="0"/);
  const textXml = await fs.readFile(
    path.join(root, "build/test-results/test/TEST-TextTest.xml"),
    "utf8",
  );
  assert.match(textXml, /tests="2"/);
  assert.match(textXml, /failures="0"/);
  assert.match(textXml, /errors="0"/);
  const orderedXml = await fs.readFile(
    path.join(root, "build/test-results/test/TEST-EmptyState.xml"),
    "utf8",
  );
  assert.match(orderedXml, /tests="1"/);
  assert.match(orderedXml, /failures="0"/);
  assert.match(orderedXml, /errors="0"/);
  console.log(
    "Exact generated fixture and recorded test passed outside BlueK: Kotlin 2.2.21, kotlin-test-junit5, JUnit Jupiter 6.0.0.",
  );
}
