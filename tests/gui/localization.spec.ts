import { test, expect, type Page } from "@playwright/test";

const payload = {
  format: "bluek-project",
  version: 1,
  projectName: "Mein Projekt",
  files: [
    {
      fileName: "Counter.kt",
      kind: "class",
      source: "class Counter { var value = 0; fun increment() { value++ } }",
    },
    {
      fileName: "StateTest.kt",
      kind: "class",
      source:
        "import kotlin.test.*\nclass StateTest { val counter = Counter()\n@BeforeTest fun setUp() { counter.increment() } }",
    },
  ],
  defaultTestClass: "StateTest",
};
const link =
  "/#bluek=p1." + Buffer.from(JSON.stringify(payload)).toString("base64url");
async function german(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Language", { exact: true }).selectOption("de");
  await expect(
    page.getByRole("dialog", { name: "Einstellungen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
}

test("GUI-130 browser language sets default; explicit choice persists, source and live state survive", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "de-DE" });
  const page = await context.newPage();
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Kompilieren", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page.getByLabel("Sprache", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Compile", exact: true }),
  ).toBeVisible();
  const input = page.getByLabel("Codepad input", { exact: true });
  await page.getByRole("button", { name: "Compile", exact: true }).click();
  await page.getByRole("button", { name: "Load state", exact: true }).click();
  await expect(page.locator(".bench .object")).toHaveCount(1);
  await german(page);
  await expect(page.locator(".bluek")).toHaveAttribute("lang", "de");
  await expect(page.locator(".bench .object")).toHaveCount(1);
  await expect(page.locator(".bench .object")).toContainText("counter");
  await expect(
    page.getByRole("button", { name: "Kompilieren", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Codepad-Eingabe", { exact: true })
    .fill("counter.value");
  await page.getByLabel("Codepad-Eingabe", { exact: true }).press("Enter");
  await expect(page.locator(".codepad-entry").last()).toContainText("1");
  await expect(page.locator(".codepad-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Counter", exact: true }).dblclick();
  await expect(page.locator(".editor-dialog .cm-content")).toContainText(
    payload.files[0].source,
  );
  await page.locator(".editor-dialog .cm-content").click();
  await page.keyboard.press(
    await page.evaluate(() =>
      /Mac/.test(navigator.platform) ? "Meta+f" : "Control+f",
    ),
  );
  await expect(page.getByPlaceholder("Suchen", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "weiter", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Kompilieren", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("bluek-language")),
  ).toBe("de");
  await expect(
    page.getByRole("button", { name: "Counter", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByRole("button", { name: "Kompilieren", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("GUI-130 German help, transfer and test-state actions work in small viewports", async ({
  page,
}) => {
  await page.goto(link);
  await german(page);
  await page.getByRole("button", { name: "Kompilieren", exact: true }).click();
  await page
    .getByRole("button", { name: "Zustand laden", exact: true })
    .click();
  await expect(page.locator(".bench .object")).toHaveCount(1);
  await expect(page.locator(".test-panel")).toHaveCount(0);
  await page.locator(".sidebar-testing summary").click();
  await expect(
    page.getByRole("button", { name: "Alles testen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hilfe", exact: true }).click();
  const help = page.getByRole("dialog", { name: "BlueK-Hilfe", exact: true });
  const nav = help.getByRole("navigation", { name: "Hilfeabschnitte" });
  const titles = [
    "Schnelleinstieg",
    "Objekte & Codepad",
    "Projekte & Speichern",
    "Gespeicherter Zustand",
    "Testen",
    "Kotlin-Kompatibilität",
    "BluePlay",
    "Tastenkürzel",
    "Fehlerbehebung",
  ];
  await page.setViewportSize({ width: 800, height: 600 });
  const bounds = await help.boundingBox();
  for (const title of titles) {
    await nav.getByRole("button", { name: title, exact: true }).click();
    await expect(
      help.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(await help.boundingBox()).toEqual(bounds);
  }
  await nav.getByRole("button", { name: "Testen", exact: true }).click();
  await expect(help.locator("pre")).toContainText(
    "assertEquals(1, counter.value)",
  );
  await page.screenshot({ path: "test-results/help-german.png" });
  await help.getByRole("button", { name: "Schließen", exact: true }).click();
  await page
    .getByRole("button", { name: "Speichern / Exportieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Vollständigen Projektlink kopieren",
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Zustand speichern", exact: true })
    .click();
  await expect(page.locator(".test-source-editor .cm-content")).toContainText(
    "val counter",
  );
  await expect(
    page.getByRole("button", { name: "Abbrechen", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/state-german.png" });
});

test("GUI-130 compiler and runtime diagnostics stay English in German UI", async ({
  page,
}) => {
  await page.goto(link);
  await german(page);
  const input = page.getByLabel("Codepad-Eingabe", { exact: true });
  await input.fill("missingName");
  await input.press("Enter");
  await expect(page.locator(".codepad-error")).toContainText(
    /not found|Unresolved|undeclared|Unknown/i,
  );
  await input.fill('throw IllegalArgumentException("Keep this text")');
  await input.press("Enter");
  await expect(page.locator(".codepad-error").last()).toContainText(
    "IllegalArgumentException",
  );
  await expect(page.locator(".codepad-error").last()).toContainText(
    "Keep this text",
  );
  await page.goto(
    "/#bluek=p1." +
      Buffer.from(
        JSON.stringify({
          ...payload,
          files: [
            {
              fileName: "Broken.kt",
              kind: "class",
              source: 'class Broken { val answer: Int = "wrong" }',
            },
          ],
        }),
      ).toString("base64url"),
  );
  await page.getByRole("button", { name: "Kompilieren", exact: true }).click();
  await expect(page.locator(".editor-diagnostics")).toContainText(
    /type|String|Int/i,
  );
  await expect(page.locator(".editor-diagnostics")).toContainText(
    "Expected type is `Int`, but actual type is `String`",
  );
});

test("GUI-130 invalid or unavailable storage falls back to English; switching still works", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("bluek-language", "xx");
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "bluek-language")
        throw new DOMException("Storage blocked", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Compile", exact: true }),
  ).toBeVisible();
  await german(page);
  await expect(
    page.getByRole("button", { name: "Kompilieren", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Compile", exact: true }),
  ).toBeVisible();
});

test("GUI-130 complete translated paragraphs and Kotlin class names", async ({
  page,
}) => {
  await page.goto(link);
  await german(page);
  await page.getByRole("button", { name: "Neue Datei", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Open Class", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Abstract Class", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Data Class", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Offene Klasse", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("button", { name: "Hilfe", exact: true }).click();
  const help = page.getByRole("dialog", { name: "BlueK-Hilfe", exact: true });
  await expect(
    help.getByRole("heading", { name: "Bearbeiten", exact: true }),
  ).toBeVisible();
  await expect(help.locator(".localized-text strong").first()).toHaveText(
    "Neues Projekt",
  );
  await help
    .getByRole("navigation")
    .getByRole("button", { name: "Testen", exact: true })
    .click();
  await expect(
    help.getByRole("heading", { name: "Assertions", exact: true }),
  ).toBeVisible();
  await expect(
    help
      .locator(".localized-text code")
      .filter({ hasText: "assertEquals(expected, actual)" }),
  ).toBeVisible();
});

test("GUI-130 BluePlay reference translates explanations and preserves signatures", async ({
  page,
}) => {
  await page.goto("/");
  await german(page);
  await page
    .getByRole("button", { name: "Neues Projekt", exact: true })
    .click();
  await page.getByRole("button", { name: /^BluePlay-Vorlage/ }).click();
  await page.locator('.classcard[aria-label="World"]').dblclick();
  const api = page.getByRole("dialog", { name: "World API", exact: true });
  await expect(api).toContainText(
    "Ein Zellraster mit Akteuren und Hintergrund.",
  );
  await expect(
    api.getByRole("heading", { name: "Konstruktoren", exact: true }),
  ).toBeVisible();
  await expect(api).toContainText(
    "Erzeugt ein Zellraster; cellSize wird in Pixeln angegeben.",
  );
  await expect(api.locator("code").first()).toContainText("World(");
  await expect(api).toContainText("fun addObject");
});
