import { test, expect } from "@playwright/test";

test("file cards follow Kotlin declarations instead of the saved creation kind", async ({ page }) => {
  const project = { format: "bluek-project", version: 1, files: [
    { fileName: "Hauptprogramm.kt", kind: "class", source: "fun main() { println(\"ok\") }" },
  ] };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"));
  const card = page.getByRole("button", { name: "Hauptprogramm", exact: true });
  await expect(card.locator("small")).toHaveText("«functions»");
  await page.getByRole("button", { name: "Compile", exact: true }).click();
  await card.click({ button: "right" });
  await expect(page.locator(".popup").getByRole("button", { name: "main()", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await card.dblclick();
  const editor = page.locator(".editor-dialog .cm-content");
  await editor.click();
  const mod = await page.evaluate(() => /Mac/.test(navigator.platform) ? "Meta" : "Control");
  await page.keyboard.press(mod + "+a");
  await page.keyboard.insertText("class Hauptprogramm {}");
  await expect(card.locator("small")).toHaveCount(0);
});

test("a functions file can be renamed from its card", async ({ page }) => {
  const project = { format: "bluek-project", version: 1, files: [
    { fileName: "Tools.kt", source: "fun helper() = 1" },
  ] };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"));
  const card = page.getByRole("button", { name: "Tools", exact: true });
  await expect(card.locator("small")).toHaveText("«functions»");
  await card.click({ button: "right" });
  page.once("dialog", dialog => dialog.accept("Helpers"));
  await page.locator(".popup").getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("button", { name: "Helpers", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Compile", exact: true }).click();
  await page.getByRole("button", { name: "Helpers", exact: true }).click({ button: "right" });
  await expect(page.locator(".popup").getByRole("button", { name: /helper\(\)/ })).toBeVisible();
});

test("a class-card rename asks once and updates constructor references", async ({ page }) => {
  const project = { format: "bluek-project", version: 1, files: [
    { fileName: "Target.kt", source: "class Target {}" },
    { fileName: "Calls.kt", source: "fun makeTarget() = Target()" },
  ] };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"));
  const card = (name: string) => page.getByRole("button", { name, exact: true });
  const dialogs: string[] = [];
  page.on("dialog", async dialog => {
    const type = dialog.type();
    dialogs.push(type);
    if (type === "prompt") await dialog.accept("RenamedTarget");
    else await dialog.accept();
  });

  await expect(card("Calls").locator("small")).toHaveText("«functions»");
  await card("Target").click({ button: "right" });
  await page.locator(".popup").getByRole("button", { name: "Rename class", exact: true }).click();
  await expect(card("RenamedTarget")).toBeVisible();
  await card("Calls").click();
  await page.waitForTimeout(200);
  expect(dialogs).toEqual(["prompt", "confirm"]);

  await card("Calls").dblclick();
  await expect(page.locator(".editor-dialog .cm-content")).toContainText("RenamedTarget()");
  await card("Compile").click();
  await expect(page.getByRole("progressbar", { name: "Ready" })).toBeVisible();
  expect(dialogs).toEqual(["prompt", "confirm"]);
});

test("renaming Main preserves all BluePlay card positions, including after reload", async ({ page }) => {
  const project = { format: "bluek-project", version: 1, library: { id: "blueplay", version: 1 }, files: [
    { fileName: "Main.kt", source: "fun main() {}" },
    { fileName: "Scene.kt", source: "class Scene : World() {}" },
    { fileName: "ActorChild.kt", source: "class ActorChild : Actor() {}" },
    { fileName: "Other.kt", source: "class Other {}" },
  ] };
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"));
  const card = (name: string) => page.getByRole("button", { name, exact: true });
  await expect(card("Main").locator("small")).toHaveText("«functions»");
  const names = ["BluePlayFunctions", "World", "Actor", "Image", "Scene", "ActorChild", "Other"];
  const position = async (name: string) => card(name).evaluate(el => ({ left: (el as HTMLElement).style.left, top: (el as HTMLElement).style.top }));
  const original = await Promise.all(["Main", ...names].map(position));
  const rename = async (from: string, to: string) => {
    await card(from).click({ button: "right" });
    page.once("dialog", dialog => dialog.accept(to));
    await page.locator(".popup").getByRole("button", { name: "Rename", exact: true }).click();
    await expect(card(to)).toBeVisible();
  };
  await rename("Main", "Start");
  expect(await Promise.all(["Start", ...names].map(position))).toEqual(original);
  await rename("Start", "Main");
  expect(await Promise.all(["Main", ...names].map(position))).toEqual(original);
  await rename("Main", "Start");
  await expect.poll(async () => page.evaluate(() => Object.values(localStorage).some(value => value.includes('"Start.kt"')))).toBe(true);
  const stored = await page.evaluate(() => Object.values(localStorage).flatMap(value => {
    try { const item = JSON.parse(value); return item?.project?.files ? [item.project] : item?.files ? [item] : []; }
    catch { return []; }
  }).find(item => item.files.some((file: { fileName: string }) => file.fileName === "Start.kt")));
  expect(stored).toBeDefined();
  for (const [index, name] of ["Start", ...names].entries())
    expect(stored.cardPositions[`${name}.kt`]).toEqual({ x: parseFloat(original[index].left), y: parseFloat(original[index].top) });
  await page.reload();
  await expect(card("Start")).toBeVisible();
  expect(await Promise.all(["Start", ...names].map(position))).toEqual(original);
});
