import { test, expect, type Locator, type Page } from "@playwright/test";

const halfMaximize = "Maximize editor above the object bench and Codepad";
const restoreHalf = "Restore editor to window";

async function loadEditors(page: Page, count = 1) {
  const names = ["Alpha", "Beta", "Gamma"];
  const payload = {
    format: "bluek-project",
    version: 1,
    files: names.map((name) => ({
      fileName: `${name}.kt`, kind: "class", source: `class ${name} {}`,
    })),
    cardPositions: Object.fromEntries(names.map((name, i) => [
      `${name}.kt`, { x: 80 + i * 260, y: 20 },
    ])),
  };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(payload)).toString("base64url"));
  await expect(page.getByLabel("Codepad input")).toBeEnabled();
  for (const name of names.slice(0, count)) {
    await page.getByRole("button", { name, exact: true }).dblclick();
  }
}

async function drag(page: Page, target: Locator, dx: number, dy: number) {
  const box = await target.boundingBox();
  if (!box) throw new Error("Drag target is not visible");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

async function expectCanvasFrame(page: Page) {
  const canvas = await page.locator(".panels>.canvas").boundingBox();
  expect(await page.locator(".editor-dialog").boundingBox()).toEqual(canvas);
  await expect(page.locator(".editor-dialog")).toHaveCSS("border-radius", "9px");
  await expect(page.locator(".editor-dialog")).toHaveCSS("border-top-color", "rgb(170, 170, 170)");
}

async function windowFrames(page: Page) {
  return page.locator(".editor-dialog").evaluateAll((editors) => editors.map((editor) => ({
    label: editor.getAttribute("aria-label"),
    rect: editor.getBoundingClientRect().toJSON(),
  })));
}

test("GUI-157 canvas frame, splitters and single-pane controls remain usable", async ({ page }) => {
  await loadEditors(page);
  await page.getByRole("button", { name: halfMaximize, exact: true }).click();
  await expectCanvasFrame(page);
  await expect(page.locator(".editor-resize-handle")).toHaveCount(0);

  const before = (await page.locator(".editor-dialog").boundingBox())!;
  await drag(page, page.getByRole("separator", { name: "Resize upper and lower panes" }), 0, -150);
  expect((await page.locator(".editor-dialog").boundingBox())!.height).toBeLessThan(before.height - 50);
  await expectCanvasFrame(page);

  await page.getByRole("button", { name: "Collapse object bench", exact: true }).click();
  await expect(page.locator(".bench")).toBeHidden();
  await expect(page.locator(".object-bench-status")).toBeHidden();
  await expect(page.getByLabel("Codepad input")).toBeVisible();
  const expandBench = page.getByRole("button", { name: "Expand object bench", exact: true });
  expect((await expandBench.boundingBox())!.x).toBe((await page.locator(".lower").boundingBox())!.x);
  await expandBench.click();

  await page.getByRole("button", { name: "Collapse Codepad", exact: true }).click();
  await expect(page.locator(".codepad")).toHaveCount(0);
  await expect(page.locator(".object-bench-status")).toBeVisible();
  const expandCodepad = page.getByRole("button", { name: "Expand Codepad", exact: true });
  const toggle = (await expandCodepad.boundingBox())!, lower = (await page.locator(".lower").boundingBox())!;
  expect(toggle.x + toggle.width).toBe(lower.x + lower.width - 8);
  await expandCodepad.click();

  await drag(page, page.getByRole("separator", { name: "Resize object bench and codepad" }), -1000, 0);
  await expect(page.locator(".bench")).toHaveCSS("width", "120px");
  expect((await page.locator(".current-element").boundingBox())!.width).toBe(1);
  const status = (await page.locator(".object-bench-status").boundingBox())!;
  for (const button of await page.locator(".fixture-actions button").all()) {
    const bounds = (await button.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(status.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(status.x + status.width + 1);
  }
  await expectCanvasFrame(page);
});

test("GUI-157 existing tabs and selection are restored after half maximization", async ({ page }) => {
  await loadEditors(page, 3);
  await drag(page, page.locator(".editor-header"), 80, 60);
  const before = await windowFrames(page);
  await page.getByRole("button", { name: halfMaximize, exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page.getByRole("tab", { name: /Alpha.kt/ }).click();
  await expect(page.locator(".cm-content")).toContainText("class Alpha");
  await page.getByRole("button", { name: restoreHalf, exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await expect(page.getByRole("tab", { name: /Gamma.kt/ })).toHaveAttribute("aria-selected", "true");
  expect(await windowFrames(page)).toEqual(before);

  await page.getByRole("button", { name: halfMaximize, exact: true }).click();
  await page.getByLabel("Close Beta.kt", { exact: true }).click();
  await page.getByLabel("Close Gamma.kt", { exact: true }).click();
  await expectCanvasFrame(page);
  await page.getByRole("button", { name: restoreHalf, exact: true }).click();
  expect(await windowFrames(page)).toEqual([{ label: "Editor: Alpha.kt", rect: before[0].rect }]);
});

test("GUI-157 separate windows restore their frames and keep closed tabs closed", async ({ page }) => {
  await loadEditors(page, 3);
  await page.getByRole("button", { name: "Ungroup editor tabs", exact: true }).click();
  const gamma = page.getByRole("dialog", { name: "Editor: Gamma.kt", exact: true });
  await drag(page, gamma.locator("h3"), 100, 80);
  const before = await windowFrames(page);
  await gamma.getByRole("button", { name: halfMaximize, exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page.getByRole("tab", { name: /Alpha.kt/ }).click();
  await page.getByRole("button", { name: restoreHalf, exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(0);
  expect(await windowFrames(page)).toEqual(before);
  expect(await gamma.evaluate((editor) => {
    const lower = document.querySelector(".lower")!.getBoundingClientRect();
    const rect = editor.getBoundingClientRect();
    return document.elementFromPoint(rect.x + 30, lower.y + 20)?.closest(".editor-dialog") === editor;
  })).toBe(true);

  await gamma.getByRole("button", { name: halfMaximize, exact: true }).click();
  await page.getByLabel("Close Beta.kt", { exact: true }).click();
  await page.getByRole("button", { name: restoreHalf, exact: true }).click();
  expect(await windowFrames(page)).toEqual(before.filter((frame) => frame.label !== "Editor: Beta.kt"));
});

test("GUI-157 full maximization and ungrouping leave no temporary layout behind", async ({ page }) => {
  await loadEditors(page, 2);
  await page.getByRole("button", { name: "Ungroup editor tabs", exact: true }).click();
  const before = await windowFrames(page);
  const beta = page.getByRole("dialog", { name: "Editor: Beta.kt", exact: true });
  await beta.getByRole("button", { name: halfMaximize, exact: true }).click();
  await page.getByRole("button", { name: "Maximize editor window", exact: true }).click();
  await expect(page.locator(".editor-dialog")).toHaveClass(/maximized/);
  await page.getByRole("button", { name: "Restore editor window", exact: true }).click();
  expect(await windowFrames(page)).toEqual(before);
  await expect(page.locator(".editor-modal")).not.toHaveClass(/workspace-bound/);

  await beta.getByRole("button", { name: halfMaximize, exact: true }).click();
  await page.getByRole("button", { name: "Ungroup editor tabs", exact: true }).click();
  expect(await windowFrames(page)).toEqual(before);
  await expect(page.locator(".editor-modal")).not.toHaveClass(/workspace-bound/);

  await beta.getByRole("button", { name: halfMaximize, exact: true }).click();
  await page.getByLabel("Close Alpha.kt", { exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expectCanvasFrame(page);
  await page.getByRole("button", { name: restoreHalf, exact: true }).click();
  expect(await windowFrames(page)).toEqual(before.filter((frame) => frame.label === "Editor: Beta.kt"));
});
