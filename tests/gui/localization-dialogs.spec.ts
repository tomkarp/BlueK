import { test, expect } from "@playwright/test";

test("GUI-130 native confirmations localize; switching back preserves edited code and undo", async ({
  page,
}) => {
  const source = "class Counter {}";
  const project = {
    format: "bluek-project",
    version: 1,
    projectName: "Keep my name",
    files: [
      { fileName: "Counter.kt", kind: "class", source },
      { fileName: "Tools.kt", kind: "functions", source: "fun helper() = 1" },
    ],
  };
  await page.goto(
    "/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"),
  );
  await expect(page.getByLabel("Project name")).toHaveValue("Keep my name");
  await page.getByRole("button", { name: "Counter", exact: true }).dblclick();
  const content = page.locator(".editor-dialog .cm-content");
  await content.click();
  const mod = await page.evaluate(() =>
    /Mac/.test(navigator.platform) ? "Meta" : "Control",
  );
  await page.keyboard.press(mod + "+End");
  await page.keyboard.insertText("\n// Preserve this edit");
  await expect(content).toContainText("Preserve this edit");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(content).toContainText("Preserve this edit");
  await expect(page.locator(".classcard small")).toHaveText("«functions»");
  await page
    .getByRole("button", { name: "Neues Projekt", exact: true })
    .click();
  let message = "";
  page.once("dialog", async (dialog) => {
    message = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: /Leeres Projekt/ }).click();
  await expect
    .poll(() => message)
    .toBe("Das aktuelle Projekt enthält Daten. Ersetzen?");
  await expect(page.getByLabel("Projektname")).toHaveValue("Keep my name");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Compile", exact: true }),
  ).toBeVisible();
  await expect(content).toContainText("Preserve this edit");
  await content.click();
  await page.keyboard.press(mod + "+z");
  await expect(content).not.toContainText("Preserve this edit");
  expect(
    await page.evaluate(() => localStorage.getItem("bluek-language")),
  ).toBe("en");
});

test("GUI-130 unavailable language storage reads default to English", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === "bluek-language")
        throw new DOMException("Blocked", "SecurityError");
      return get.call(this, key);
    };
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("en");
});

test("GUI-130 browser locale fallback handles regions, unsupported languages and blocked storage", async ({
  browser,
}) => {
  for (const scenario of [
    { locale: "de-AT", expected: "Kompilieren", saved: null, blocked: false },
    { locale: "fr-FR", expected: "Compile", saved: null, blocked: false },
    { locale: "de-DE", expected: "Compile", saved: "en", blocked: false },
    {
      locale: "de-DE",
      expected: "Kompilieren",
      saved: "invalid",
      blocked: false,
    },
    { locale: "de-DE", expected: "Kompilieren", saved: null, blocked: true },
  ]) {
    const context = await browser.newContext({ locale: scenario.locale });
    const page = await context.newPage();
    await page.addInitScript(({ saved, blocked }) => {
      if (saved) localStorage.setItem("bluek-language", saved);
      if (blocked) {
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (key === "bluek-language")
            throw new DOMException("Blocked", "SecurityError");
          return original.call(this, key);
        };
      }
    }, scenario);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: scenario.expected, exact: true }),
    ).toBeVisible();
    await context.close();
  }
});
