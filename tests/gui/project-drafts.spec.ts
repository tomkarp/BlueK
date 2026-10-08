import { test, expect, chromium, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const project = (name: string) => ({
  format: "bluek-project",
  version: 1,
  projectName: name,
  files: [
    {
      fileName: "Hund.kt",
      kind: "class",
      source: "class Hund { val age = 1 }",
    },
  ],
});
const link = (payload: unknown) =>
  "/#bluek=p1." + Buffer.from(JSON.stringify(payload)).toString("base64url");
const draftId = (page: Page) =>
  page.evaluate(() => sessionStorage.getItem("bluek.tab-draft.v1"));
const saved = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          "bluek.project-draft.v1." +
            sessionStorage.getItem("bluek.tab-draft.v1"),
        ) || "{}",
      ).project,
  );
async function load(page: Page, payload = project("Dogs")) {
  await page.goto(link(payload));
  await expect(
    page.getByRole("button", { name: "Hund", exact: true }),
  ).toBeVisible();
  await expect.poll(() => saved(page)).toBeTruthy();
}
async function edit(page: Page, source: string) {
  await page.getByRole("button", { name: "Hund", exact: true }).dblclick();
  const editor = page.locator(".editor-dialog .cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);
  await page
    .locator(".editor-dialog")
    .getByRole("button", { name: "Close editor", exact: true })
    .click();
  await expect
    .poll(() => saved(page).then((p) => p?.files[0].source))
    .toBe(source);
}

test("GUI-120 multiple tabs keep independent edits and reload their own draft", async ({
  page,
  context,
}) => {
  await load(page, project("Dogs A"));
  const second = await context.newPage();
  await load(second, project("Dogs B"));
  const firstId = await draftId(page),
    secondId = await draftId(second);
  expect(firstId).not.toBe(secondId);
  await edit(page, "class Hund { val age = 10 }");
  await edit(page, "class Hund { val age = 11 }");
  await edit(second, "class Hund { val age = 21 }");
  await edit(second, "class Hund { val age = 22 }");
  await page.getByLabel("Project name").fill("Dogs A changed");
  await expect
    .poll(() => saved(page).then((p) => p?.projectName))
    .toBe("Dogs A changed");
  const savedTime = (tab: Page) =>
    tab.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            "bluek.project-draft.v1." +
              sessionStorage.getItem("bluek.tab-draft.v1"),
          ) || "{}",
        ).updatedAt,
    );
  const firstSavedTime = await savedTime(page),
    secondSavedTime = await savedTime(second);
  await Promise.all([page.reload(), second.reload()]);
  await expect(page.getByLabel("Project name")).toHaveValue("Dogs A changed");
  await expect(second.getByLabel("Project name")).toHaveValue("Dogs B");
  expect((await saved(page)).files[0].source).toContain("11");
  expect((await saved(second)).files[0].source).toContain("22");
  expect(await draftId(page)).toBe(firstId);
  expect(await draftId(second)).toBe(secondId);
  await expect.poll(() => savedTime(page)).toBe(firstSavedTime);
  await expect.poll(() => savedTime(second)).toBe(secondSavedTime);
  await expect(page.locator(".project-recovery-notice")).toHaveCount(0);
  await expect(second.locator(".project-recovery-notice")).toHaveCount(0);
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) =>
      k.startsWith("bluek.project-draft.v1."),
    ),
  );
  expect(keys).toHaveLength(2);
  // Each session stores a pointer, not a second copy of the source.
  const session = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(session).not.toContain("class Hund");
});

test("GUI-121 an opener-copied session forks the live draft; reopening a link starts fresh", async ({
  page,
}) => {
  await load(page);
  await edit(page, "class Hund { val age = 77 }");
  const originalId = await draftId(page);
  const popupEvent = page.waitForEvent("popup");
  await page.evaluate(() => window.open("/", "_blank"));
  const duplicate = await popupEvent;
  await expect(
    duplicate.getByRole("button", { name: "Hund", exact: true }),
  ).toBeVisible();
  await expect.poll(() => draftId(duplicate)).not.toBe(originalId);
  await expect
    .poll(() => saved(duplicate).then((p) => p?.files[0].source))
    .toContain("77");
  await edit(duplicate, "class Hund { val age = 88 }");
  expect((await saved(page)).files[0].source).toContain("77");
  await duplicate.reload();
  await expect
    .poll(() => saved(duplicate).then((p) => p?.files[0].source))
    .toContain("88");
  await page.goto(link(project("Dogs")));
  await page.waitForURL((url) => !url.hash);
  await expect(
    page.getByRole("button", { name: "Hund", exact: true }),
  ).toBeVisible();
  await expect.poll(() => draftId(page)).toBe(originalId);
  await expect
    .poll(() => saved(page).then((p) => p?.files[0].source))
    .toContain("age = 1");
});

test("GUI-122 closed tabs stay in Recent work; fresh startup shows a dismissible notice and restores full project data", async ({
  page,
  context,
}) => {
  const payload = {
    ...project("Dogs A"),
    readme: "# Dogs",
    defaultTestClass: "StateTest",
    files: [
      ...project("Dogs A").files,
      {
        fileName: "StateTest.kt",
        kind: "class",
        isTestClass: true,
        source:
          "import kotlin.test.*\nclass StateTest { val dog: Hund = Hund() }",
      },
    ],
    cardPositions: { "Hund.kt": { x: 111, y: 123 } },
    resources: [{ path: "images/dog.png", data: "data:image/png;base64,AAAA" }],
  };
  await load(page, payload);
  const firstId = await draftId(page);
  const second = await context.newPage();
  await load(second, project("Dogs B"));
  await Promise.all([page.close(), second.close()]);
  const fresh = await context.newPage();
  await fresh.goto("/");
  await expect(fresh.locator(".classcard")).toHaveCount(0);
  const notice = fresh.locator(".project-recovery-notice");
  await expect(notice).toContainText("You have saved projects. Open / Import");
  await fresh
    .getByRole("button", { name: "Dismiss saved projects notice" })
    .click();
  await expect(notice).toHaveCount(0);
  await fresh
    .getByRole("button", { name: "Open / Import", exact: true })
    .click();
  const open = fresh.getByRole("dialog", { name: "Open / Import" });
  await expect(open.locator(".recent-project")).toHaveCount(2);
  await expect(open.locator(".recent-project").first()).toContainText("Dogs B");
  await fresh.setViewportSize({ width: 700, height: 500 });
  const cancel = await open
    .getByRole("button", { name: "Cancel", exact: true })
    .boundingBox();
  expect(cancel!.y + cancel!.height).toBeLessThanOrEqual(500);
  await fresh.screenshot({ path: "test-results/recent-projects.png" });
  await open.getByRole("button", { name: /^Dogs A/ }).click();
  await expect(open).toHaveCount(0);
  await expect(fresh.getByLabel("Project name")).toHaveValue("Dogs A");
  expect(await draftId(fresh)).toBe(firstId);
  const restored = await saved(fresh);
  expect(restored.defaultTestClass).toBe("StateTest");
  expect(restored.readme).toBe("# Dogs");
  expect(restored.cardPositions["Hund.kt"]).toEqual({ x: 111, y: 123 });
  expect(restored.resources).toEqual(payload.resources);
  await expect(fresh.locator(".project-recovery-notice")).toHaveCount(0);
  // Choosing a draft still owned by another live tab gives an independent copy.
  const another = await context.newPage();
  await another.goto("/");
  await another.getByRole("button", { name: "Open / Import" }).click();
  await another
    .getByRole("dialog", { name: "Open / Import" })
    .getByRole("button", { name: /^Dogs A/ })
    .click();
  await expect(another.getByLabel("Project name")).toHaveValue("Dogs A");
  expect(await draftId(another)).not.toBe(firstId);
});

test("GUI-123 migrates the old autosave, ignores corrupt drafts and has no recovery hint on explicit links", async ({
  page,
  context,
}) => {
  await context.addInitScript((payload) => {
    if (!localStorage.getItem("seeded")) {
      localStorage.setItem("bluek.current-project.v1", JSON.stringify(payload));
      localStorage.setItem("bluek.project-draft.v1.broken", "{");
      localStorage.setItem("seeded", "1");
    }
  }, project("Old autosave"));
  await page.goto("/");
  await expect(page.locator(".project-recovery-notice")).toBeVisible();
  await expect(page.locator(".classcard")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("bluek.current-project.v1")),
  ).toBeNull();
  await page.getByRole("button", { name: "Open / Import" }).click();
  const open = page.getByRole("dialog", { name: "Open / Import" });
  await expect(open.locator(".recent-project")).toHaveCount(1);
  await open.getByRole("button", { name: /^Old autosave/ }).click();
  await expect(
    page.getByRole("button", { name: "Hund", exact: true }),
  ).toBeVisible();
  const fresh = await context.newPage();
  await load(fresh, project("From link"));
  await expect(fresh.locator(".project-recovery-notice")).toHaveCount(0);
});

test("GUI-124 project replacement updates the same tab draft and an empty project clears the default test class", async ({
  page,
}) => {
  await load(page, {
    ...project("Original"),
    defaultTestClass: "StateTest",
    files: [
      ...project("Original").files,
      {
        fileName: "StateTest.kt",
        kind: "class",
        isTestClass: true,
        source: "import kotlin.test.*\nclass StateTest {}",
      },
    ],
  });
  const originalId = await draftId(page);
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("dialog", { name: "Create New Project" })
    .getByRole("button", { name: /^Empty Project/ })
    .click();
  await expect(page.locator(".classcard")).toHaveCount(0);
  expect(await draftId(page)).toBe(originalId);
  await page.getByLabel("Project name").fill("New blank project");
  await expect
    .poll(() => saved(page).then((p) => p?.projectName))
    .toBe("New blank project");
  expect(await saved(page)).not.toHaveProperty("defaultTestClass");
  await page.getByRole("button", { name: "Open / Import" }).click();
  const open = page.getByRole("dialog", { name: "Open / Import" });
  await expect(open.locator(".recent-project")).toHaveCount(1);
  await expect(open.getByRole("button", { name: /^Original/ })).toHaveCount(0);
  await expect(
    open.getByRole("button", { name: /^New blank project/ }),
  ).toBeVisible();
});

test("GUI-125 unavailable storage reports the limitation and leaves editing and export usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.goto(link(project("Unsaved")));
  await expect(
    page.getByRole("button", { name: "Hund", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".project-recovery-notice")).toContainText(
    "could not be saved",
  );
  await page.getByRole("button", { name: "Save / Export" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Save / Export" })
      .getByRole("button", { name: "Export Project JSON" }),
  ).toBeEnabled();
});

test("GUI-126 browser restart keeps multiple projects in the persistent profile", async ({
  baseURL,
}) => {
  const directory = await mkdtemp(path.join(tmpdir(), "bluek-draft-profile-"));
  let browser = await chromium.launchPersistentContext(directory, {
    baseURL,
    headless: true,
  });
  try {
    const first = await browser.newPage(),
      second = await browser.newPage();
    await load(first, project("Before closing A"));
    await load(second, project("Before closing B"));
    await edit(first, "class Hund { val age = 123 }");
    await edit(second, "class Hund { val age = 456 }");
    await browser.close();
    browser = await chromium.launchPersistentContext(directory, {
      baseURL,
      headless: true,
    });
    const fresh = await browser.newPage();
    await fresh.goto("/");
    await expect(fresh.locator(".project-recovery-notice")).toBeVisible();
    await expect(fresh.locator(".classcard")).toHaveCount(0);
    await fresh.getByRole("button", { name: "Open / Import" }).click();
    const open = fresh.getByRole("dialog", { name: "Open / Import" });
    await expect(open.locator(".recent-project")).toHaveCount(2);
    await open.getByRole("button", { name: /^Before closing A/ }).click();
    await expect
      .poll(() => saved(fresh).then((p) => p?.files[0].source))
      .toContain("123");
    await fresh.getByRole("button", { name: "Open / Import" }).click();
    await fresh
      .getByRole("dialog", { name: "Open / Import" })
      .getByRole("button", { name: /^Before closing B/ })
      .click();
    await expect
      .poll(() => saved(fresh).then((p) => p?.files[0].source))
      .toContain("456");
  } finally {
    await browser.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("GUI-127 saved projects can be deleted individually, with cancel and cross-tab updates", async ({
  page,
  context,
}) => {
  await load(page, project("Delete me"));
  const removeId = await draftId(page);
  const other = await context.newPage();
  await load(other, project("Keep me"));
  await other.getByRole("button", { name: "Open / Import" }).click();
  await page.getByRole("button", { name: "Open / Import" }).click();
  const open = page.getByRole("dialog", { name: "Open / Import" });
  const remove = open.getByRole("button", {
    name: "Delete saved project Delete me",
    exact: true,
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await remove.click();
  await expect(open.locator(".recent-project")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(open.locator(".recent-project")).toHaveCount(1);
  await expect(
    other
      .getByRole("dialog", { name: "Open / Import" })
      .locator(".recent-project"),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      (id) => localStorage.getItem("bluek.project-draft.v1." + id),
      removeId,
    ),
  ).toBeNull();
  await expect(open.getByRole("button", { name: /^Keep me/ })).toBeVisible();
  await open.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hund", exact: true }),
  ).toBeVisible();
  // Merely closing the unchanged tab must not resurrect the saved copy.
  await page.close();
  expect(
    await other.evaluate(
      (id) => localStorage.getItem("bluek.project-draft.v1." + id),
      removeId,
    ),
  ).toBeNull();
});

test("GUI-128 Delete all removes saved projects, keeps settings and requires confirmation", async ({
  page,
  context,
}) => {
  await load(page, project("One"));
  const second = await context.newPage();
  await load(second, project("Two"));
  await page.evaluate(() => localStorage.setItem("bluek.test-setting", "keep"));
  const fresh = await context.newPage();
  await fresh.goto("/");
  await expect(fresh.locator(".project-recovery-notice")).toBeVisible();
  await fresh.getByRole("button", { name: "Open / Import" }).click();
  const open = fresh.getByRole("dialog", { name: "Open / Import" });
  const removeAll = open.getByRole("button", {
    name: "Delete all saved projects",
  });
  await expect(removeAll.locator("svg")).toBeVisible();
  fresh.once("dialog", (dialog) => dialog.dismiss());
  await removeAll.click();
  await expect(open.locator(".recent-project")).toHaveCount(2);
  fresh.once("dialog", (dialog) => dialog.accept());
  await removeAll.click();
  await expect(open.locator(".recent-project")).toHaveCount(0);
  await expect(fresh.locator(".project-recovery-notice")).toHaveCount(0);
  const storage = await fresh.evaluate(() => ({
    keys: Object.keys(localStorage),
    setting: localStorage.getItem("bluek.test-setting"),
  }));
  expect(
    storage.keys.filter((key) => key.startsWith("bluek.project-draft.v1.")),
  ).toHaveLength(0);
  expect(storage.setting).toBe("keep");
  await Promise.all([page.close(), second.close()]);
  await fresh.reload();
  await expect(fresh.locator(".project-recovery-notice")).toHaveCount(0);
  await fresh.getByRole("button", { name: "Open / Import" }).click();
  await expect(
    fresh
      .getByRole("dialog", { name: "Open / Import" })
      .locator(".recent-project"),
  ).toHaveCount(0);
});
