import { test, expect, type Page } from "@playwright/test";
const fixture = `import kotlin.test.*
class HundTest {
    val hund1: Hund = Hund()

    @BeforeTest fun setUp() {
        hund1.geburtstag()
    }
}`;
const fixtureWithOtherMethods = fixture.replace(
  "class HundTest {",
  'class HundTest {\n    @Test fun existingTest() { assertTrue(true) }\n    fun helper() = "kept"',
);
const payload = (source = fixture) => ({
  format: "bluek-project",
  version: 1,
  files: [
    {
      fileName: "Hund.kt",
      kind: "class",
      source:
        "class Hund { var alter=0; fun geburtstag(){alter++}; fun wieAlt(): Int = alter }",
    },
    { fileName: "HundTest.kt", kind: "class", testTarget: "Hund.kt", source },
  ],
  cardPositions: {
    "Hund.kt": { x: 80, y: 40 },
    "HundTest.kt": { x: 108, y: 165 },
  },
});
async function load(page: Page, project = payload()) {
  await page.goto(
    "/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"),
  );
  await page.getByRole("button", { name: "Compile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Compile", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".classcard.uncompiled")).toHaveCount(0);
}
async function menu(page: Page, name: string) {
  const card = page.getByRole("button", { name, exact: true });
  if (
    await card.evaluate((element) =>
      element.classList.contains("attached-test"),
    )
  ) {
    const bounds = await card.boundingBox();
    await page.mouse.click(bounds!.x + bounds!.width - 10, bounds!.y + 10, {
      button: "right",
    });
  } else {
    await card.click({ button: "right" });
  }
  return page.locator(".popup");
}
async function expandTesting(page: Page) {
  await page.locator(".sidebar-testing summary").click();
}
test("GUI-118 project links optionally load the default state and open README", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const project = {
    ...payload(),
    defaultTestClass: "HundTest",
    readme: "# Hunde\nEin gespeicherter Zustand.",
  };
  const link =
    "/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url");
  await page.goto(link);
  await expect(page.getByLabel("Codepad input")).toBeEnabled();
  await expect(page.locator(".bench .object")).toHaveCount(0);
  await expect(page.locator(".classcard.uncompiled")).toHaveCount(2);

  let prompted = "";
  page.on("dialog", (dialog) => {
    prompted = dialog.defaultValue();
    void dialog.dismiss();
  });
  const copiedLink = () =>
    prompted ||
    page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  await page.getByRole("button", { name: "Save / Export" }).click();
  const save = page.getByRole("dialog", { name: "Save / Export" });
  const stateOptions = save.getByLabel(
    "Load default test class state with the link",
  );
  await expect(stateOptions).toHaveCount(1);
  await expect(stateOptions).not.toBeChecked();
  await stateOptions.check();
  await expect(
    save.getByRole("group", { name: "When opening a link:" }),
  ).toBeVisible();
  // Link options stay beside the two links; the three file exports span the full list.
  await page.setViewportSize({ width: 800, height: 700 });
  const choiceBounds = await save
    .locator(".project-choice-list button")
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        width: button.getBoundingClientRect().width,
        left: button.getBoundingClientRect().left,
      })),
    );
  expect(Math.abs(choiceBounds[0].width - choiceBounds[1].width)).toBeLessThan(1);
  const listBounds = await save.locator(".project-choice-list").boundingBox();
  for (const box of choiceBounds.slice(2)) {
    expect(Math.abs(box.width - listBounds!.width)).toBeLessThan(1);
    expect(box.width).toBeGreaterThan(choiceBounds[0].width);
  }
  expect(new Set(choiceBounds.map((box) => box.left)).size).toBe(1);
  const optionsBounds = await save
    .getByRole("group", { name: "When opening a link:" })
    .boundingBox();
  expect(optionsBounds!.x).toBeGreaterThan(
    choiceBounds[0].left + choiceBounds[0].width,
  );
  const cancelBounds = await save
    .getByRole("button", { name: "Cancel", exact: true })
    .boundingBox();
  expect(cancelBounds!.y + cancelBounds!.height).toBeLessThanOrEqual(700);
  await page.screenshot({ path: "test-results/project-link-state-option.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await save.getByRole("button", { name: "Copy Full Project Link" }).click();
  await expect.poll(copiedLink).toContain("&state=1");
  const stateLink = await copiedLink();
  expect(stateLink).not.toContain("readme=1");
  await page.goto("about:blank");
  await page.goto(stateLink);
  await expect(page.locator(".bench .object")).toContainText("hund1:");
  await expect(page.locator(".classcard.uncompiled")).toHaveCount(0);
  await expect(page.locator(".test-panel, .editor-dialog")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "README.md" })).toHaveCount(0);
  await invoke(page, "wieAlt");
  await expect(page.locator(".result-value")).toHaveText("1 : Int");
  await page
    .locator(".result-dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();

  // Both link options can be combined; they are sender preferences, not project state.
  await page.getByRole("button", { name: "Save / Export" }).click();
  await stateOptions.first().check();
  await save.getByLabel("Open README.md with the link").first().check();
  prompted = "";
  await save.getByRole("button", { name: "Copy Full Project Link" }).click();
  await expect.poll(copiedLink).toContain("&readme=1&state=1");
  const bothLink = await copiedLink();
  await page.goto("about:blank");
  await page.goto(bothLink);
  await expect(page.locator(".bench .object")).toContainText("hund1:");
  await expect(
    page.getByRole("dialog", { name: "README.md" }).locator(".cm-md-h1"),
  ).toHaveText("Hunde");
  await expect(page.locator(".test-panel, .editor-dialog")).toHaveCount(0);
});

test("GUI-119 short links carry both options and unavailable state is reported", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const project = {
    ...payload(),
    defaultTestClass: "HundTest",
    readme: "# Hunde",
  };
  await page.route("**/api/projects", async (route) => {
    expect(route.request().postDataJSON().defaultTestClass).toBe("HundTest");
    await route.fulfill({
      json: { code: "green-lamp-river", expiresAt: "2026-11-07" },
    });
  });
  await page.route("**/api/projects/green-lamp-river", (route) =>
    route.fulfill({ json: { project } }),
  );
  page.on("dialog", (dialog) => {
    void dialog.dismiss();
  });
  await page.goto(
    "/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"),
  );
  await page.getByRole("button", { name: "Save / Export" }).click();
  const save = page.getByRole("dialog", { name: "Save / Export" });
  await save
    .getByLabel("Load default test class state with the link")
    .last()
    .check();
  await save.getByRole("button", { name: "Copy Short Link" }).click();
  const shortLink = page.getByRole("button", {
    name: "Complete project link",
    exact: true,
  });
  await expect(shortLink).toContainText("/load/green-lamp-river?state=1");
  await page
    .getByRole("dialog", { name: "Short project link" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Save / Export" }).click();
  await save.getByLabel("Open README.md with the link").last().check();
  await save.getByRole("button", { name: "Copy Short Link" }).click();
  await expect(shortLink).toContainText(
    "/load/green-lamp-river?readme=1&state=1",
  );
  const url = await shortLink.innerText();
  await page.goto(url);
  await expect(page.locator(".bench .object")).toContainText("hund1:");
  await expect(
    page.getByRole("dialog", { name: "README.md" }).locator(".cm-md-h1"),
  ).toHaveText("Hunde");
  await expect(page.locator(".test-panel, .editor-dialog")).toHaveCount(0);

  await page.goto("about:blank");
  await page.goto(
    "/#bluek=p1." +
      Buffer.from(JSON.stringify(payload())).toString("base64url") +
      "&state=1",
  );
  await expect(page.locator(".compiler-dialog")).toContainText(
    "Choose a default test class",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save / Export" }).click();
  await expect(
    save.getByLabel("Load default test class state with the link").first(),
  ).toBeDisabled();
  await expect(
    save.getByLabel("Load default test class state with the link").last(),
  ).toBeDisabled();

  await page.goto("about:blank");
  const failed = {
    ...project,
    files: project.files.map((file) =>
      file.fileName === "HundTest.kt"
        ? {
            ...file,
            source: fixture.replace(
              "hund1.geburtstag()",
              'error("State failed")',
            ),
          }
        : file,
    ),
  };
  await page.goto(
    "/#bluek=p1." +
      Buffer.from(JSON.stringify(failed)).toString("base64url") +
      "&state=1",
  );
  await expect(page.locator(".compiler-dialog")).toContainText("State failed");
  await expect(page.locator(".test-panel, .editor-dialog")).toHaveCount(0);
});
async function invoke(page: Page, method: string) {
  await page
    .locator(".bench .object")
    .filter({ hasText: "hund1:" })
    .click({ button: "right" });
  await page
    .locator(".popup")
    .getByRole("button", { name: new RegExp(`^${method}\\(`) })
    .click();
}
test("GUI-104 create attached test class and move both cards", async ({
  page,
}) => {
  const project = payload();
  project.files = project.files.slice(0, 1);
  await load(page, project);
  const classMenu = await menu(page, "Hund");
  const createTest = classMenu.getByRole("button", {
    name: "Create Test Class",
    exact: true,
  });
  await expect(classMenu.getByRole("button").last()).toHaveText(
    "Create Test Class",
  );
  expect(
    await createTest.evaluate(
      (element) => element.previousElementSibling?.tagName,
    ),
  ).toBe("HR");
  await createTest.click();
  await page
    .getByRole("dialog", { name: "Create Test Class" })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(page.locator(".classcard.test-card")).toContainText("HundTest");
  await expect(page.locator(".classcard.test-card")).not.toContainText(
    "«test»",
  );
  await expect(
    page.getByRole("button", { name: "Compile", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".classcard.uncompiled")).toHaveCount(0);
  const parent = page.getByRole("button", { name: "Hund", exact: true });
  const child = page.getByRole("button", { name: "HundTest", exact: true });
  const a = await parent.boundingBox();
  const b = await child.boundingBox();
  expect(await page.locator(".test-attachment-edge")).toHaveCount(0);
  expect(b!.x - a!.x).toBe(30);
  expect(b!.y).toBeLessThan(a!.y);

  const initialParentLayer = await parent.evaluate((element) =>
    Number(getComputedStyle(element).zIndex),
  );
  await page.mouse.click(a!.x + 10, a!.y + a!.height - 10);
  const raisedParentLayer = await parent.evaluate((element) =>
    Number(getComputedStyle(element).zIndex),
  );
  const testLayer = await child.evaluate((element) =>
    Number(getComputedStyle(element).zIndex),
  );
  expect(raisedParentLayer).toBeGreaterThan(initialParentLayer);
  expect(raisedParentLayer).toBeGreaterThan(testLayer);

  // The attached test card is selectable, but its position follows the class.
  await page.mouse.move(b!.x + b!.width - 10, b!.y + 10);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width + 80, b!.y + 55, { steps: 6 });
  await page.mouse.up();
  const afterTestCardDrag = await child.boundingBox();
  expect(afterTestCardDrag!.x).toBe(b!.x);
  expect(afterTestCardDrag!.y).toBe(b!.y);

  await page.keyboard.press("Escape");
  await page.mouse.move(a!.x + 50, a!.y + 20);
  await page.mouse.down();
  await page.mouse.move(a!.x + 150, a!.y + 60, { steps: 8 });
  await page.mouse.up();
  const c = await parent.boundingBox();
  const d = await child.boundingBox();
  expect(c!.x).toBeGreaterThan(a!.x);
  expect(d!.x - b!.x).toBe(c!.x - a!.x);
  expect(d!.y - b!.y).toBe(c!.y - a!.y);
});
test("GUI-105 save and load test state and record a test with assertion", async ({
  page,
}) => {
  await load(page);
  await (await menu(page, "Hund")).locator(".constructor-menu-item").click();
  await page.getByLabel("Name of instance").fill("hund1");
  await page
    .locator(".create-object-dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(page.locator(".bench .object")).toContainText("hund1:");
  await invoke(page, "geburtstag");
  await (
    await menu(page, "HundTest")
  )
    .getByRole("button", { name: "Save State from Object Bench", exact: true })
    .click();
  const source = page.getByLabel("Generated Kotlin source");
  await expect(source).toHaveCSS("resize", "none");
  await expect(source).toBeVisible();
  await expect(source.locator(".cm-content span").first()).toBeVisible();
  await expect(
    source.getByRole("button", { name: "Format Kotlin file" }),
  ).toBeVisible();
  expect(await source.locator(".cm-content").innerText()).toContain(
    "val hund1: Hund = Hund()",
  );
  expect(await source.locator(".cm-content").innerText()).not.toContain(
    "lateinit",
  );
  const editorContent = source.locator(".cm-content");
  await page.setViewportSize({ width: 800, height: 600 });
  await editorContent.fill(
    `${await editorContent.innerText()}\n${"\n".repeat(40)}`,
  );
  const saveDialog = page.getByRole("dialog", { name: "Save test state" });
  const cancelButton = saveDialog.getByRole("button", {
    name: "Cancel",
    exact: true,
  });
  await expect(cancelButton).toBeVisible();
  const cancelBox = await cancelButton.boundingBox();
  expect(cancelBox).not.toBeNull();
  expect(cancelBox!.y + cancelBox!.height).toBeLessThanOrEqual(600);
  await cancelButton.click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await (
    await menu(page, "HundTest")
  )
    .getByRole("button", { name: "Save State from Object Bench", exact: true })
    .click();
  await expect(source).toBeVisible();
  await editorContent.fill(
    `${await editorContent.innerText()}\n// preview edit`,
  );
  await expect(editorContent).toContainText("// preview edit");
  await page.getByRole("button", { name: "Replace State & Compile" }).click();
  await expect(
    page.getByRole("button", { name: "Compile", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".classcard.uncompiled")).toHaveCount(0);
  // Close editor to leave class card available.
  await page.keyboard.press("Escape");
  await expandTesting(page);
  // Loading a saved state is available from the Tests panel, which opens on demand.
  await page.getByRole("button", { name: "Tests…", exact: true }).click();
  await page.getByRole("button", { name: "Load State", exact: true }).click();
  await expect(page.locator(".bench .object")).toContainText("hund1:");
  await invoke(page, "wieAlt");
  await expect(page.locator(".result-value")).toHaveText("1 : Int");
  await page
    .locator(".result-dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Record Test…", exact: true }).click();
  await expect(page.getByLabel("Test recording")).toBeVisible();
  await invoke(page, "geburtstag");
  await invoke(page, "wieAlt");
  await expect(page.locator(".result-value")).toHaveText("2 : Int");
  await page.getByLabel("Expected Kotlin expression").fill("2");
  await page
    .getByRole("button", { name: "Add Assertion", exact: true })
    .click();
  await page
    .locator(".result-dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByLabel("Test method name").fill("testBirthday");
  await page.getByRole("button", { name: "Finish Recording…" }).click();
  expect(await source.locator(".cm-content").innerText()).toContain(
    "assertEquals(2, result",
  );
  await page.getByRole("button", { name: "Save & Compile" }).click();
  await expect(
    page.getByRole("button", { name: "Compile", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".classcard.uncompiled")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Run All Tests", exact: true })
    .click();
  await expect(page.locator(".test-summary")).toContainText("1 passed");
  await expect(page.locator(".test-result.passed")).toContainText(
    "testBirthday",
  );
  await page.screenshot({ path: "test-results/kotlin-tests-workspace.png" });
});

test("GUI-106 results, failure navigation, individual rerun and cancellation", async ({
  page,
}) => {
  await load(
    page,
    payload(`import kotlin.test.*
class HundTest {
    @Test fun good(){ assertTrue(true) }
    @Test fun bad(){ assertEquals(1,2,"Alter") }
    @Ignore @Test fun later(){ fail() }
}`),
  );
  await expandTesting(page);
  await page
    .getByRole("button", { name: "Run All Tests", exact: true })
    .click();
  await expect(page.locator(".test-summary")).toContainText(
    "1 passed · 1 failed · 1 ignored",
  );
  await page
    .getByRole("button", { name: "failed · HundTest.bad", exact: true })
    .click();
  await expect(page.locator(".test-details")).toContainText(
    "Expected <1> but was <2>",
  );
  await page
    .locator(".test-details")
    .getByRole("button", { name: "Open source" })
    .click();
  await expect(page.locator(".cm-content")).toContainText("assertEquals");
  await page.keyboard.press("Escape");
  await page.getByLabel("Run good", { exact: true }).click();
  await expect(page.locator(".test-summary")).toContainText(
    "1 passed · 0 failed · 0 ignored",
  );
  await page.getByRole("button", { name: "Record Test…", exact: true }).click();
  await expect(page.getByLabel("Test recording")).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel Recording", exact: true })
    .click();
  await expect(page.getByLabel("Test recording")).toHaveCount(0);
});

test("GUI-109 create an independent test class from New File", async ({
  page,
}) => {
  await load(page, {
    ...payload(),
    files: [
      {
        fileName: "Hund.kt",
        kind: "class",
        source: "class Hund",
      },
    ],
    cardPositions: { "Hund.kt": { x: 80, y: 40 } },
  });
  await page.getByRole("button", { name: "New File", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create New Kotlin File" });
  const options = await dialog
    .locator(".new-class-option span")
    .allTextContents();
  expect(options.slice(-2)).toEqual(["Test Class", "Kotlin Functions"]);
  await dialog.getByRole("radio", { name: "Test Class" }).check();
  await dialog.getByLabel("Name").fill("StandaloneTest");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  const card = page.getByRole("button", {
    name: "StandaloneTest",
    exact: true,
  });
  await expect(card).toHaveClass(/test-card/);
  await expect(card).not.toHaveClass(/attached-test/);
  await expect(card).not.toContainText("«test»");
  await expect(page.locator(".classcard.test-card")).toHaveCount(1);
  const stateMenu = await menu(page, "StandaloneTest");
  await expect(stateMenu).toContainText("Run Tests");
  await expect(stateMenu).toContainText("Load State to Object Bench");

  const choose = page.getByRole("button", {
    name: "Choose default test class",
  });
  await expect(choose).toBeEnabled();
  await choose.click();
  await page
    .getByLabel("Default test class selection")
    .selectOption("StandaloneTest");
  await page.getByRole("button", { name: "Use Test Class" }).click();
  await expect(choose).toHaveAttribute(
    "title",
    "Default test class: StandaloneTest",
  );
  await page.getByRole("button", { name: "Compile", exact: true }).click();
  await expect(page.locator(".classcard.uncompiled")).toHaveCount(0);

  await (await menu(page, "Hund")).locator(".constructor-menu-item").click();
  await page.getByLabel("Name of instance").fill("hund1");
  await page
    .locator(".create-object-dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  const save = page.getByRole("button", { name: "Save state" });
  await save.click();
  await expect(
    page.getByRole("dialog", { name: "Save test state" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save & Compile" }).click();
  await expect(page.locator(".editor-dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Load state" }).click();
  await expect(page.locator(".bench .object")).toContainText("hund1:");
});

test("GUI-116 empty attached and independent test classes remain available for recording", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await load(page, payload());
  await page.getByRole("button", { name: "New File", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create New Kotlin File" });
  await dialog.getByRole("radio", { name: "Test Class" }).check();
  await dialog.getByLabel("Name").fill("BlankTest");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expandTesting(page);
  await page.getByRole("button", { name: "Tests…", exact: true }).click();
  const classes = page.getByRole("combobox", {
    name: "Test class",
    exact: true,
  });
  await expect(classes.locator("option")).toHaveText([
    "All test classes",
    "HundTest",
    "BlankTest",
  ]);
  await expect(
    page.getByRole("button", { name: "Record test in HundTest" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record test in BlankTest" }),
  ).toBeVisible();
  await classes.selectOption("BlankTest");
  await page.getByRole("button", { name: "Record Test…", exact: true }).click();
  await expect(page.getByLabel("Test recording")).toBeVisible();
  await (await menu(page, "Hund")).locator(".constructor-menu-item").click();
  await page.getByLabel("Name of instance").fill("hund1");
  await page
    .locator(".create-object-dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save state", exact: true }),
  ).toBeDisabled();
  await invoke(page, "wieAlt");
  await page.getByLabel("Expected Kotlin expression").fill("0");
  await page
    .getByRole("button", { name: "Add Assertion", exact: true })
    .click();
  await page
    .locator(".result-dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByLabel("Test method name").fill("recordedFirstTest");
  await page.getByRole("button", { name: "Finish Recording…" }).click();
  await page.getByRole("button", { name: "Save & Compile" }).click();
  await page.keyboard.press("Escape");
  await classes.selectOption("BlankTest");
  await page
    .locator(".test-panel")
    .getByRole("button", { name: "Run Tests", exact: true })
    .click();
  await expect(page.locator(".test-summary")).toContainText("1 passed");
  await expect(page.locator(".test-result.passed")).toContainText(
    "BlankTest.recordedFirstTest",
  );
  await classes.selectOption("");
  await expect(
    page.getByRole("button", { name: "Record test in HundTest" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record test in BlankTest" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/kotlin-tests-empty-classes.png",
  });
});

test("GUI-117 init-state replacement warns and failed loading reports its error without opening Tests", async ({
  page,
}) => {
  const project = {
    ...payload(`import kotlin.test.*\nclass HundTest {
      val hund1: Hund
      init { hund1 = Hund(); hund1.geburtstag() }
      @Test fun kept() { assertEquals(1, hund1.alter) }
    }`),
    defaultTestClass: "HundTest",
  };
  await load(page, project);
  await page.getByRole("button", { name: "Load state", exact: true }).click();
  await expect(page.locator(".bench .object")).toContainText("hund1:");
  await expect(page.locator(".test-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Save state", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Save test state" });
  await expect(preview.getByRole("alert")).toContainText("all init blocks");
  await preview
    .getByRole("button", { name: "Replace State & Compile" })
    .click();
  await expect(page.locator(".classcard.uncompiled")).toHaveCount(0);
  await page.getByRole("button", { name: "Load state", exact: true }).click();
  await invoke(page, "wieAlt");
  await expect(page.locator(".result-value")).toHaveText("1 : Int");
  await page
    .locator(".result-dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.goto("about:blank");
  await load(page, {
    ...project,
    files: [
      project.files[0],
      {
        ...project.files[1],
        source: `import kotlin.test.*\nclass HundTest { @BeforeTest fun setUp() { error("state failed") } }`,
      },
    ],
  });
  await page.getByRole("button", { name: "Load state", exact: true }).click();
  await expect(page.locator(".compiler-dialog")).toContainText("state failed");
  await expect(
    page.getByRole("dialog", { name: "Exception", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".test-panel")).toHaveCount(0);
});

test("GUI-110 testing actions collapse by default and utility icons move to toolbar", async ({
  page,
}) => {
  await load(page, payload());
  const disclosure = page.locator(".sidebar-testing");
  const toggle = disclosure.locator("summary");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(
    page.getByRole("button", { name: "Run All Tests", exact: true }),
  ).toHaveCount(0);
  await expect(disclosure.getByText(/Alpha-Stadium/)).toBeHidden();
  await toggle.click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(
    disclosure.locator(".sidebar-testing-actions button"),
  ).toHaveCount(2);
  const notice = disclosure.locator(".sidebar-testing-notice");
  await expect(notice).toHaveJSProperty(
    "innerText",
    "Testing is still in\nthe alpha stage.",
  );
  await expect(notice).toBeVisible();
  const isBeforeButtons = await notice.evaluate((element) => {
    const firstButton = element.parentElement!.querySelector("button")!;
    return Boolean(
      element.compareDocumentPosition(firstButton) &
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(isBeforeButtons).toBe(true);
  await expect(
    page.getByRole("button", { name: "Run All Tests", exact: true }),
  ).toBeVisible();
  await toggle.click();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(
    page.getByRole("button", { name: "Run All Tests", exact: true }),
  ).toHaveCount(0);
  await expect(disclosure.getByText(/Alpha-Stadium/)).toBeHidden();

  const toolbar = page.locator(".toolbar-options");
  const download = toolbar.getByRole("button", { name: "Offline Version" });
  const help = toolbar.getByRole("button", { name: "Help", exact: true });
  const settings = toolbar.getByRole("button", {
    name: "Settings",
    exact: true,
  });
  await expect(download).toHaveText("");
  await expect(help).toHaveText("");
  const downloadBox = await download.boundingBox();
  const helpBox = await help.boundingBox();
  const settingsBox = await settings.boundingBox();
  expect(downloadBox?.width).toBe(settingsBox?.width);
  expect(downloadBox?.height).toBe(settingsBox?.height);
  expect(helpBox?.width).toBe(settingsBox?.width);
  expect(helpBox?.height).toBe(settingsBox?.height);
});

test("GUI-111 toolbar button toggles all test classes", async ({ page }) => {
  await load(page, payload());
  const toolbar = page.locator(".toolbar-options");
  const testCard = page.locator(".classcard.test-card");
  const classCard = page.locator(".classcard:not(.test-card)");
  const toggle = toolbar.getByRole("button", { name: "Hide test classes" });
  await expect(toggle.locator(".test-check-row-one")).toHaveCount(1);
  await expect(toggle.locator(".test-check-row-two")).toHaveCount(1);
  const iconPaths = async () =>
    toggle
      .locator(".test-classes-icon path")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  const visibleIconShape = await iconPaths();
  const visibleColor = await toggle.evaluate(
    (button) => getComputedStyle(button).color,
  );
  expect(visibleIconShape).toHaveLength(4);
  await expect(testCard).toBeVisible();
  await expect(classCard).toBeVisible();

  await toggle.click();
  await expect(testCard).toBeHidden();
  await expect(classCard).toBeVisible();
  const hiddenToggle = toolbar.getByRole("button", {
    name: "Show test classes",
  });
  await expect(hiddenToggle.locator(".test-check-row-one")).toHaveCount(1);
  await expect(hiddenToggle.locator(".test-check-row-two")).toHaveCount(1);
  const hiddenIconShape = await hiddenToggle
    .locator(".test-classes-icon path")
    .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  expect(hiddenIconShape).toEqual(visibleIconShape);
  expect(
    await hiddenToggle.evaluate((button) => getComputedStyle(button).color),
  ).not.toBe(visibleColor);
  const showButton = toolbar.getByRole("button", {
    name: "Show test classes",
  });
  await expect(showButton).toBeEnabled();
  await showButton.click();
  await expect(testCard).toBeVisible();
  await toolbar.getByRole("button", { name: "Hide test classes" }).click();
  await expect(testCard).toBeHidden();
});

test("GUI-112 object bench state shortcuts create, reuse and change the default test class", async ({
  page,
}) => {
  await load(page, payload(fixtureWithOtherMethods));
  const actions = page.locator(".status-bar .fixture-actions");
  const save = actions.getByRole("button", { name: "Save state" });
  const loadFixture = actions.getByRole("button", { name: "Load state" });
  const choose = actions.getByRole("button", {
    name: "Choose default test class",
  });
  await expect(actions.locator("button")).toHaveCount(3);
  for (const button of await actions.locator("button").all())
    await expect(button).toHaveText("");
  const widths = await actions
    .locator("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().width),
    );
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  const benchBox = await page.locator(".bench").boundingBox();
  const actionsBox = await actions.boundingBox();
  expect(actionsBox!.y).toBeGreaterThanOrEqual(
    benchBox!.y + benchBox!.height - 1,
  );
  expect(actionsBox!.x).toBeGreaterThan(benchBox!.x + benchBox!.width / 2);
  expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(
    benchBox!.x + benchBox!.width + 1,
  );

  await (await menu(page, "Hund")).locator(".constructor-menu-item").click();
  await page.getByLabel("Name of instance").fill("hund1");
  await page
    .locator(".create-object-dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await invoke(page, "geburtstag");
  await save.click();
  const nameDialog = page.getByRole("dialog", {
    name: "Create test class for state",
  });
  const nameInput = nameDialog.getByLabel("Test class name");
  await expect(nameInput).toHaveValue("StateTest");
  await nameDialog.getByRole("button", { name: "Continue" }).click();
  const source = page.getByLabel("Generated Kotlin source");
  await expect(source).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Save test state" }).getByRole("alert"),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("dialog", { name: "Save test state" })
      .getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  expect(await source.locator(".cm-content").innerText()).toContain(
    "val hund1: Hund = Hund()",
  );
  await page.getByRole("button", { name: "Save & Compile" }).click();
  await expect(
    page.getByRole("button", { name: "StateTest", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".editor-dialog")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("bluek.current-project.v1") || "{}")
            .defaultTestClass,
      ),
    )
    .toBe("StateTest");

  // The remembered state loads after a fresh page without a separate Compile click.
  await page.reload();
  await expect(choose).toHaveAttribute(
    "title",
    "Default test class: StateTest",
  );
  await expect(loadFixture).toBeEnabled();
  await loadFixture.click();
  await expect(page.locator(".test-panel")).toHaveCount(0);
  await expect(page.locator(".bench .object")).toContainText("hund1:");
  await invoke(page, "wieAlt");
  await expect(page.locator(".result-value")).toHaveText("1 : Int");
  await page
    .locator(".result-dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();

  await choose.click();
  await page
    .getByLabel("Default test class selection")
    .selectOption("HundTest");
  await page.getByRole("button", { name: "Use Test Class" }).click();
  await expect(choose).toHaveAttribute("title", "Default test class: HundTest");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("bluek.current-project.v1") || "{}")
            .defaultTestClass,
      ),
    )
    .toBe("HundTest");

  await (
    await menu(page, "HundTest")
  )
    .getByRole("button", { name: "Load State to Object Bench" })
    .click();
  await expect(page.locator(".bench .object")).toContainText("hund1:");
  await expect(page.locator(".test-panel")).toHaveCount(0);

  await save.click();
  const replacementPreview = page.getByRole("dialog", {
    name: "Save test state",
  });
  await expect(replacementPreview.getByRole("alert")).toContainText(
    "all class properties",
  );
  await expect(replacementPreview.getByRole("alert")).toContainText("all");
  await expect(
    replacementPreview.getByRole("button", { name: "Replace State & Compile" }),
  ).toBeVisible();
  const replacementSource = page.getByLabel("Generated Kotlin source");
  const replacementSourceText = await replacementSource
    .locator(".cm-content")
    .innerText();
  expect(replacementSourceText).toContain("fun existingTest()");
  expect(replacementSourceText).toContain("fun helper()");
  expect(replacementSourceText).not.toContain("BlueK fixture");
  await replacementPreview
    .getByRole("button", { name: "Replace State & Compile" })
    .click();
  await expect(page.locator(".editor-dialog")).toHaveCount(0);
});
