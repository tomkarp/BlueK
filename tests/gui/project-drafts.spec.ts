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

test("GUI-129 leaving BlueK warns only when project changes have not been explicitly saved", async ({
  page,
}) => {
  await load(page);
  const dispatchBeforeUnload = () =>
    page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });

  expect(await dispatchBeforeUnload()).toBe(false);
  await page.getByLabel("Project name").fill("Unsaved change");
  expect(await dispatchBeforeUnload()).toBe(true);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("dialog", { name: "Save", exact: true })
      .getByRole("button", { name: /^Download BlueK project file/ })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe("Unsaved change.bluek");
  expect(await dispatchBeforeUnload()).toBe(false);
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
  duplicate.on("dialog", (dialog) => dialog.accept());
  await duplicate.reload();
  await expect
    .poll(() => saved(duplicate).then((p) => p?.files[0].source))
    .toContain("88");
  page.on("dialog", (dialog) => dialog.accept());
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

test("GUI-154 replacing a non-empty project asks first and can be cancelled", async ({
  page,
}) => {
  await load(page, project("Current work"));
  await edit(page, "class Hund { val age = 42 }");

  let prompt = "";
  let replace = false;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") {
      await dialog.accept();
      return;
    }
    prompt = dialog.message();
    if (replace) await dialog.accept();
    else await dialog.dismiss();
  });
  await page.goto(link(project("Incoming project")));
  await expect(page.getByLabel("Project name")).toHaveValue("Current work");
  await expect
    .poll(() => saved(page).then((p) => p?.files[0].source))
    .toContain("42");
  expect(prompt).toContain("recovery copy");

  replace = true;
  await page.goto(link(project("Incoming project")));
  await expect(page.getByLabel("Project name")).toHaveValue("Incoming project");
  await expect
    .poll(() => saved(page).then((p) => p?.files[0].source))
    .toBe("class Hund { val age = 1 }");
});

test("GUI-122 a fresh tab automatically restores only the newest abandoned copy", async ({
  page,
  context,
}) => {
  await load(page, project("Dogs A"));
  await edit(page, "class Hund { val age = 123 }");
  const second = await context.newPage();
  await load(second, project("Dogs B"));
  await edit(second, "class Hund { val age = 456 }");
  await Promise.all([page.close(), second.close()]);

  const fresh = await context.newPage();
  await fresh.goto("/");
  await expect(fresh.getByLabel("Project name")).toHaveValue("Dogs B");
  expect((await saved(fresh)).files[0].source).toContain("456");
  await expect(fresh.locator(".project-recovery-notice")).toHaveCount(0);
  const remaining = await fresh.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith("bluek.project-draft.v1.")),
  );
  expect(remaining).toHaveLength(1);
});

test("GUI-123 migrates the old autosave and ignores corrupt drafts", async ({
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
  await expect(page.getByLabel("Project name")).toHaveValue("Old autosave");
  await expect(page.getByRole("button", { name: "Hund", exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("bluek.current-project.v1")),
  ).toBeNull();
  const fresh = await context.newPage();
  await load(fresh, project("From link"));
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
  await page.getByRole("button", { name: "New", exact: true }).click();
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
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const open = page.getByRole("dialog", { name: "Open", exact: true });
  await expect(open.getByRole("tab", { name: /^Restore/ })).toHaveCount(0);
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
  const notice = page.locator(".project-recovery-notice");
  await expect(notice).toContainText(
    "Your changes could not be kept for recovery because BlueK's local storage is full",
  );
  await expect(notice).toContainText(/This project needs about \d+\.\d MB\./);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Save", exact: true })
      .getByRole("button", { name: "Download BlueK project file" }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");

  // The warning stays until it is closed, and further edits with the same
  // reason do not bring it back.
  await notice.getByRole("button", { name: "Close storage warning" }).click();
  await expect(notice).toHaveCount(0);
  await page.getByRole("button", { name: "Hund", exact: true }).dblclick();
  await page.keyboard.type("// changed\n");
  await page.keyboard.press("Escape");
  await expect(notice).toHaveCount(0);
});

test("GUI-125 blocked storage and other storage errors name their reason", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
  });
  await page.goto(link(project("Blocked")));
  const notice = page.locator(".project-recovery-notice");
  await expect(notice).toContainText(
    "this browser does not allow the page to store data, for example in private browsing",
  );

  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new TypeError("Disk unavailable");
    };
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto(link(project("Failing")));
  await expect(notice).toContainText(
    "Your changes could not be saved in this browser (TypeError: Disk unavailable).",
  );
});

test("GUI-126 browser restart automatically restores the newest project only", async ({
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
    await expect(fresh.getByLabel("Project name")).toHaveValue("Before closing B");
    await expect
      .poll(() => saved(fresh).then((p) => p?.files[0].source))
      .toContain("456");
    await expect(fresh.getByRole("tab", { name: /^Restore/ })).toHaveCount(0);
  } finally {
    await browser.close();
    await rm(directory, { recursive: true, force: true });
  }
});
