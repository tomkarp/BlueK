import { test, expect, type Page } from "@playwright/test";

const labels = {
  interactive: "Interactive calls",
  codepad: "Codepad executions",
  main: "Starting main",
};
const files = [
  {
    fileName: "Counter.kt",
    kind: "class",
    source: `class Counter(val initial: Int = 0) {
    init { println("constructed") }
    val observed: Int get() { println("inspected"); return initial }
    fun speak() { println("method") }
    fun silent() {}
    fun echo(text: String) { println(text) }
    companion object { fun hello() { println("companion") } }
  }`,
  },
  {
    fileName: "Program.kt",
    kind: "functions",
    source:
      'fun hello() { println("function") }\nfun main() { println("main") }',
  },
];
const terminal = (page: Page) => page.locator(".terminal-output pre");
async function load(
  page: Page,
  sourceFiles = files,
  compile = true,
  bluePlay = false,
) {
  const payload = {
    format: "bluek-project",
    version: 1,
    files: sourceFiles,
    ...(bluePlay ? { library: { id: "blueplay", version: 1 } } : {}),
  };
  await page.goto(
    "/#bluek=p1." + Buffer.from(JSON.stringify(payload)).toString("base64url"),
  );
  await expect(page.getByLabel("Codepad input", { exact: true })).toBeEnabled();
  if (compile) {
    await page.getByRole("button", { name: "Compile", exact: true }).click();
    await expect(page.getByLabel("Ready", { exact: true })).toBeVisible();
  }
}
async function evaluate(page: Page, code: string) {
  const input = page.getByLabel("Codepad input", { exact: true });
  const entries = page.locator(".codepad-entry");
  const count = await entries.count();
  await input.fill(code);
  await input.press("Enter");
  await expect(entries).toHaveCount(count + 1);
  await expect(entries.last().locator(".codepad-error")).toHaveCount(0);
}
async function settings(
  page: Page,
  enabled: Partial<Record<keyof typeof labels, boolean>>,
) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  for (const [key, value] of Object.entries(enabled)) {
    await dialog
      .getByLabel(labels[key as keyof typeof labels], { exact: true })
      .setChecked(value!);
  }
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
}
async function seed(page: Page) {
  await evaluate(page, 'println("OLD")');
  await expect(terminal(page)).toContainText("OLD");
  if (
    await page
      .getByLabel("Split terminal to the right", { exact: true })
      .count()
  )
    await page
      .getByLabel("Split terminal to the right", { exact: true })
      .click();
}
async function menu(page: Page, selector: string, name: RegExp) {
  await page.locator(selector).dispatchEvent("contextmenu", {
    button: 2,
    bubbles: true,
    clientX: 180,
    clientY: 180,
  });
  await page.locator(".popup").getByRole("button", { name }).click();
}

test("GUI-139 Terminal settings default off, persist independently and translate with the code tip", async ({
  page,
}) => {
  await load(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  for (const label of Object.values(labels))
    await expect(dialog.getByLabel(label, { exact: true })).not.toBeChecked();
  await expect(dialog.locator(".settings-hint code")).toHaveText(
    'print("\\u000C")',
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await seed(page);
  await evaluate(page, 'println("APPENDED")');
  await expect(terminal(page)).toHaveText("OLD\nAPPENDED\n");
  await settings(page, { interactive: true, main: true });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    dialog.getByLabel(labels.interactive, { exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByLabel(labels.codepad, { exact: true }),
  ).not.toBeChecked();
  await expect(dialog.getByLabel(labels.main, { exact: true })).toBeChecked();
  await dialog.getByLabel("Language", { exact: true }).selectOption("de");
  const german = page.getByRole("dialog", {
    name: "Einstellungen",
    exact: true,
  });
  await expect(
    german.getByLabel(
      "Interaktiven Aufrufen",
      { exact: true },
    ),
  ).toBeChecked();
  await expect(german.locator(".settings-hint")).toContainText(
    "löscht die Konsole im Kotlin-Code",
  );
  await page.setViewportSize({ width: 800, height: 600 });
  await german
    .getByRole("button", { name: "Schließen", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    german.getByRole("button", { name: "Schließen", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: test.info().outputPath("terminal-settings-de.png"),
  });
  await page.setViewportSize({ width: 390, height: 520 });
  const bounds = await german.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(520);
  for (const checkbox of await german.locator('input[type="checkbox"]').all()) {
    expect((await checkbox.boundingBox())!.width).toBeGreaterThanOrEqual(12);
  }
  await german
    .getByRole("button", { name: "Schließen", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    german.getByRole("button", { name: "Schließen", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: test.info().outputPath("terminal-settings-mobile-de.png"),
  });
  await german.getByRole("button", { name: "Schließen", exact: true }).click();
});

test("GUI-139 Codepad clearing keeps new streaming output, input, history and explicit code clearing", async ({
  page,
}) => {
  await load(page);
  await seed(page);
  await settings(page, { codepad: true });
  await evaluate(page, "42");
  await expect(terminal(page)).toHaveText("");
  await expect(page.locator(".codepad-entry")).toHaveCount(2);
  await evaluate(page, 'println("NEW"); hello()');
  await expect(terminal(page)).toHaveText("NEW\nfunction\n");
  const input = page.getByLabel("Codepad input", { exact: true });
  await input.fill('println("Prompt"); val reply = readln(); println(reply)');
  await input.press("Enter");
  await expect(terminal(page)).toHaveText("Prompt\n");
  const terminalInput = page.locator(".terminal-window input");
  await terminalInput.fill("Ada");
  await terminalInput.press("Enter");
  await expect(terminal(page)).toHaveText("Prompt\nAda\nAda\n");
  await expect(input).toBeEnabled();
  await settings(page, { codepad: false });
  await evaluate(page, 'print("\\u000C"); println("FROM CODE")');
  await expect(terminal(page)).toHaveText("FROM CODE\n");
});

test("GUI-139 Interactive clearing covers constructors, methods, functions, companions and menu main", async ({
  page,
}) => {
  await load(page);
  await seed(page);
  await settings(page, { interactive: true });
  await menu(page, '.classcard[aria-label="Counter"]', /^Counter\(/);
  const create = page.locator(".create-object-dialog");
  await expect(terminal(page)).toContainText("OLD");
  await create.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(terminal(page)).toContainText("OLD");
  await menu(page, '.classcard[aria-label="Counter"]', /^Counter\(/);
  await create.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator(".bench .object")).toHaveCount(1);
  await expect(terminal(page)).toHaveText("constructed\n");
  await seed(page);
  await menu(page, ".bench .object", /speak\(/);
  await expect(terminal(page)).toHaveText("method\n");
  await menu(page, ".bench .object", /silent\(/);
  await expect(terminal(page)).toHaveText("");
  await seed(page);
  await menu(page, '.classcard[aria-label="Program"]', /hello\(/);
  await expect(terminal(page)).toHaveText("function\n");
  await seed(page);
  await menu(page, '.classcard[aria-label="Counter"]', /hello\(/);
  await expect(terminal(page)).toHaveText("companion\n");
  await seed(page);
  await menu(page, '.classcard[aria-label="Program"]', /main\(/);
  await expect(terminal(page)).toHaveText("main\n");
  await seed(page);
  await page.getByRole("button", { name: "Start main", exact: true }).click();
  await expect(terminal(page)).toContainText("OLD\nmain\n");
});

test("GUI-139 Confirmed interactive calls clear only after argument validation and preserve inspection output", async ({
  page,
}) => {
  await load(page);
  await menu(page, '.classcard[aria-label="Counter"]', /^Counter\(/);
  await page
    .locator(".create-object-dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(page.locator(".bench .object")).toHaveCount(1);
  await seed(page);
  await settings(page, { interactive: true });
  await menu(page, ".bench .object", /echo\(/);
  const dialog = page.locator(".method-dialog");
  await expect(terminal(page)).toContainText("OLD");
  await expect(dialog.getByRole("button", { name: "Invoke", exact: true })).toBeDisabled();
  await expect(dialog).toBeVisible();
  await expect(terminal(page)).toContainText("OLD");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(terminal(page)).toContainText("OLD");
  await page.locator(".bench .object").dblclick();
  await expect(terminal(page)).toContainText("OLD\ninspected\n");
  await page
    .locator(".inspect-window")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await menu(page, ".bench .object", /echo\(/);
  await dialog.getByLabel("text: String", { exact: true }).fill('"CONFIRMED"');
  await dialog.getByRole("button", { name: "Invoke", exact: true }).click();
  await expect(terminal(page)).toHaveText("CONFIRMED\n");
});

test("GUI-139 Start main clears after selection, keyboard starts and new runtime errors survive", async ({
  page,
}) => {
  await load(page, [
    ...files,
    {
      fileName: "Other.kt",
      kind: "functions",
      source:
        'fun main() { println("before error"); throw IllegalArgumentException("NEW ERROR") }',
    },
  ]);
  await seed(page);
  await settings(page, { main: true });
  await page.getByRole("button", { name: "Start main", exact: true }).click();
  const chooser = page.getByRole("dialog", {
    name: "Choose main",
    exact: true,
  });
  await expect(terminal(page)).toContainText("OLD");
  await chooser.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(terminal(page)).toContainText("OLD");
  await page.keyboard.press("ControlOrMeta+Enter");
  await chooser
    .getByRole("button", { name: "Program.kt — main()", exact: true })
    .click();
  await expect(terminal(page)).toHaveText("main\n");
  await seed(page);
  await page.getByRole("button", { name: "Start main", exact: true }).click();
  await chooser
    .getByRole("button", { name: "Other.kt — main()", exact: true })
    .click();
  await expect(terminal(page)).toContainText("before error");
  await expect(terminal(page)).toContainText("NEW ERROR");
  await expect(terminal(page)).not.toContainText("OLD");
});

test("GUI-139 Codepad compile failure retains output; successful compile-on-demand then clears", async ({
  page,
}) => {
  await load(
    page,
    [{ fileName: "Broken.kt", kind: "class", source: "class Broken {}" }],
    false,
  );
  await seed(page);
  await settings(page, { codepad: true });
  const editor = page.locator(".editor-dialog .cm-content");
  await evaluate(page, 'println("RETAIN")');
  await page.getByRole("button", { name: "Broken", exact: true }).dblclick();
  await editor.fill('class Broken { val n: Int = "wrong" }');
  await page.keyboard.press("Escape");
  const input = page.getByLabel("Codepad input", { exact: true });
  await input.fill('println("MUST NOT RUN")');
  await input.press("Enter");
  await expect(page.locator(".editor-diagnostics")).toContainText(
    "Expected type",
  );
  await expect(terminal(page)).toHaveText("RETAIN\n");
  await editor.fill("class Broken {}");
  await page.keyboard.press("Escape");
  await evaluate(page, 'println("COMPILED")');
  await expect(terminal(page)).toHaveText("COMPILED\n");
});

test("GUI-139 Invalid and blocked settings storage falls back safely and permits page-local changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "bluek-terminal-auto-clear",
      '{"interactive":"true","codepad":true,"main":1}',
    );
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "bluek-terminal-auto-clear")
        throw new DOMException("Storage blocked", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await load(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(
    dialog.getByLabel(labels.interactive, { exact: true }),
  ).not.toBeChecked();
  await expect(
    dialog.getByLabel(labels.codepad, { exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByLabel(labels.main, { exact: true }),
  ).not.toBeChecked();
  await dialog.getByLabel(labels.main, { exact: true }).check();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await seed(page);
  await page.getByRole("button", { name: "Start main", exact: true }).click();
  await expect(terminal(page)).toHaveText("main\n");
});

test("GUI-139 BluePlay ticks keep output with all auto-clear options enabled", async ({
  page,
}) => {
  await load(
    page,
    [
      {
        fileName: "Game.kt",
        kind: "class",
        source: `class Game : World(80, 60, 1) {
    var count = 0
    override fun act() { count++; println("tick $count") }
  }`,
      },
      {
        fileName: "Main.kt",
        kind: "functions",
        source: 'fun main() { println("game"); Game().show() }',
      },
    ],
    true,
    true,
  );
  await settings(page, { interactive: true, codepad: true, main: true });
  await page.getByRole("button", { name: "Start main", exact: true }).click();
  const world = page.getByRole("dialog", {
    name: "BluePlay – World",
    exact: true,
  });
  await expect(world).toBeVisible();
  await page.getByLabel("Split terminal to the right", { exact: true }).click();
  await world.getByRole("button", { name: "Act once", exact: true }).click();
  await expect(terminal(page)).toHaveText("game\ntick 1\n");
  await world.getByRole("button", { name: "Act once", exact: true }).click();
  await expect(terminal(page)).toHaveText("game\ntick 1\ntick 2\n");
});
