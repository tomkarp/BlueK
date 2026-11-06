import { expect, test } from "@playwright/test";

const project = {
  format: "bluek-project",
  version: 1,
  files: [{
    fileName: "Probe.kt",
    kind: "class",
    source: [
      "class Probe : Base() {",
      "    val measure = 1",
      "    fun read(): Int = measure",
      "    fun use() {",
      "        val probe = Probe()",
      "        probe.",
      "    }",
      ...Array.from({ length: 35 }, (_, index) => `    fun method${String(index).padStart(2, "0")}() {}`),
      "}",
    ].join("\n"),
  }, {
    fileName: "Base.kt",
    kind: "class",
    source: "open class Base { fun reset() {} }",
  }],
};

for (const { platform, shortcut } of [
  { platform: "MacIntel", shortcut: "Meta+Period" },
  { platform: "Win32", shortcut: "Control+Space" },
]) {
  test(`GUI-164 opens Kotlin suggestions with ${shortcut} on ${platform}`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 760 });
    await page.addInitScript((platform) => {
      Object.defineProperty(navigator, "platform", { value: platform });
      localStorage.setItem("bluek-language", "en");
    }, platform);
    await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"));
    await page.getByRole("button", { name: "Probe", exact: true }).dblclick();
    await page.addStyleTag({ content: ".editor-dialog:not(.maximized) { height: 420px !important; }" });

    const editor = page.locator(".editor-dialog");
    const content = editor.locator(".cm-content");
    const line = content.locator(".cm-line").filter({ hasText: /^\s*probe\.$/ });
    const suggestions = page.getByRole("listbox");
    const measure = suggestions.getByRole("option", { name: "val measure: Int", exact: true });
    await line.click();
    await page.keyboard.press("End");

    await page.keyboard.press(shortcut);
    await expect(measure).toBeVisible();
    await expect(suggestions.getByRole("option", { name: "fun read(): Int", exact: true })).toBeVisible();
    await expect(suggestions.getByRole("option", { name: "fun use()", exact: true })).toBeVisible();
    const list = page.locator(".cm-tooltip-autocomplete ul");
    const tooltipBounds = await page.locator(".cm-tooltip-autocomplete").boundingBox();
    if (!tooltipBounds) throw new Error("Suggestions tooltip has no visible bounds.");
    expect(tooltipBounds.y + tooltipBounds.height).toBeLessThanOrEqual(760);
    expect(await page.locator(".cm-tooltip-autocomplete").evaluate((element) => element.closest(".editor-dialog"))).toBeNull();
    const lastMethod = suggestions.getByRole("option", { name: "fun method34()", exact: true });
    const bounds = await list.boundingBox();
    if (!bounds) throw new Error("Suggestions list has no visible bounds.");
    await page.mouse.move(bounds.x + 20, bounds.y + 20);
    await page.mouse.wheel(0, 2000);
    await expect(lastMethod).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(suggestions).toHaveCount(0);
    await expect(content).toBeFocused();

    await page.keyboard.type("res");
    await page.keyboard.press(shortcut);
    const resetOption = suggestions.getByRole("option", { name: /fun reset\(\).*Inherited from Base/ });
    await expect(resetOption).toBeVisible();
    const inheritedDetail = resetOption.locator(".cm-completionDetail");
    await expect(inheritedDetail).toHaveText("Inherited from Base");
    await expect(inheritedDetail).toHaveCSS("color", "rgb(153, 153, 153)");
    expect(await page.getByRole("option", { name: /fun reset\(\).*Inherited from Base/ }).count()).toBe(1);
    await expect(page.locator(".cm-completionInfo")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");

    await page.keyboard.press(shortcut);
    await expect(measure).toBeVisible();
    const scrollBounds = await list.boundingBox();
    if (!scrollBounds) throw new Error("Suggestions list has no visible bounds.");
    await page.mouse.move(scrollBounds.x + 20, scrollBounds.y + 20);
    await page.mouse.wheel(0, 2000);
    await lastMethod.click();
    await expect(content).toContainText("probe.method34");
  });
}

test("GUI-164 BluePlay constructor completion inserts editable parameters", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel" });
    localStorage.setItem("bluek-language", "en");
  });
  const bluePlayProject = {
    format: "bluek-project",
    version: 1,
    library: { id: "blueplay", version: 1 },
    files: [{
      fileName: "App.kt",
      kind: "class",
      source: ["class App {", "    fun use() {", "        val world = World()", "    }", "}"].join("\n"),
    }],
  };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(bluePlayProject)).toString("base64url"));
  await page.getByRole("button", { name: "App", exact: true }).dblclick();
  const editor = page.locator(".editor-dialog");
  const content = editor.locator(".cm-content");
  const line = content.locator(".cm-line").filter({ hasText: "val world = World()" });
  await line.click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Meta+Period");
  const option = page.getByRole("option", { name: "World(width: Int, height: Int, cellSize: Int)", exact: true });
  await expect(option).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("10");
  await expect(content).toContainText("World(10, height, cellSize)");
});

test("GUI-164 BluePlay member types resolve once constructor arguments are valid", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel" });
    localStorage.setItem("bluek-language", "en");
  });
  const bluePlayProject = {
    format: "bluek-project",
    version: 1,
    library: { id: "blueplay", version: 1 },
    files: [{
      fileName: "App.kt",
      kind: "class",
      source: ["class App {", "    fun use() {", "        val world = World(5, 20, 10)", "        world.", "    }", "}"].join("\n"),
    }],
  };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(bluePlayProject)).toString("base64url"));
  await page.getByRole("button", { name: "App", exact: true }).dblclick();
  const content = page.locator(".editor-dialog .cm-content");
  await content.locator(".cm-line").filter({ hasText: "world." }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Meta+Period");
  await expect(page.getByRole("option", { name: "var background: Image", exact: true })).toBeVisible();
});

test("GUI-164 inherited BluePlay members keep their declaring type", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel" });
    localStorage.setItem("bluek-language", "en");
  });
  const bluePlayProject = {
    format: "bluek-project",
    version: 1,
    library: { id: "blueplay", version: 1 },
    files: [{
      fileName: "Defender.kt",
      kind: "class",
      source: [
        "class Defender : Actor() {",
        "    fun use() {",
        "        val defender = Defender()",
        "        defender.",
        "    }",
        "}",
      ].join("\n"),
    }],
  };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(bluePlayProject)).toString("base64url"));
  await page.getByRole("button", { name: "Defender", exact: true }).dblclick();
  const content = page.locator(".editor-dialog .cm-content");
  await content.locator(".cm-line").filter({ hasText: "defender." }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Meta+Period");
  const inheritedOption = page.getByRole("option", { name: /var x: Int.*Inherited from Actor/ });
  await expect(inheritedOption).toBeVisible();
  await expect(inheritedOption.locator(".cm-completionDetail")).toHaveText("Inherited from Actor");
  await expect(page.locator(".cm-completionInfo")).toHaveCount(0);
});

test("GUI-164 help analyzes edits made after the last compile", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel" });
    localStorage.setItem("bluek-language", "en");
  });
  const staleSourceProject = {
    format: "bluek-project",
    version: 1,
    files: [{ fileName: "Probe.kt", kind: "class", source: "class Probe {}" }],
  };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(staleSourceProject)).toString("base64url"));
  await page.getByRole("button", { name: "Compile", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Ready", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Probe", exact: true }).dblclick();
  const content = page.locator(".editor-dialog .cm-content");
  await content.fill([
    "class Probe {",
    "    val newest = 2",
    "    fun use() {",
    "        val probe = Probe()",
    "        probe.",
    "    }",
    "}",
  ].join("\n"));
  await content.locator(".cm-line").filter({ hasText: "probe." }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Meta+Period");
  await expect(page.getByRole("option", { name: "val newest: Int", exact: true })).toBeVisible();
});

test("GUI-164 overloaded project constructors insert their parameter list", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel" });
    localStorage.setItem("bluek-language", "en");
  });
  const constructorProject = {
    format: "bluek-project",
    version: 1,
    files: [{
      fileName: "Choice.kt",
      kind: "class",
      source: [
        "class Choice(val name: String, val count: Int) {",
        "    constructor(name: String) : this(name, 0)",
        "    fun use() {",
        "        val choice = Choice()",
        "    }",
        "}",
      ].join("\n"),
    }],
  };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(constructorProject)).toString("base64url"));
  await page.getByRole("button", { name: "Choice", exact: true }).dblclick();
  const content = page.locator(".editor-dialog .cm-content");
  const line = content.locator(".cm-line").filter({ hasText: "val choice = Choice()" });
  await line.click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Meta+Period");
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options).toHaveCount(2);
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await page.keyboard.type('"Ada"');
  await expect(content).toContainText('Choice("Ada")');
});

test("GUI-164 method completion inserts and selects an overload's parameters", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel" });
    localStorage.setItem("bluek-language", "en");
  });
  const methodProject = {
    format: "bluek-project",
    version: 1,
    files: [{
      fileName: "Painter.kt",
      kind: "class",
      source: [
        "class Painter {",
        "    fun draw(x: Int, y: Int) {}",
        "    fun draw(x: Int, y: Int, color: String) {}",
        "    fun use() {",
        "        val painter = Painter()",
        "        painter.dr",
        "    }",
        "}",
      ].join("\n"),
    }],
  };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(methodProject)).toString("base64url"));
  await page.getByRole("button", { name: "Painter", exact: true }).dblclick();
  const content = page.locator(".editor-dialog .cm-content");
  const line = content.locator(".cm-line").filter({ hasText: "painter.dr" });
  await line.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Meta+Period");
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options).toHaveCount(2);
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await page.keyboard.type("1");
  await expect(content).toContainText("painter.draw(1, y, color)");
});
