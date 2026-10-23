import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";

const project = {
  format: "bluek-project",
  version: 1,
  projectName: "Navigation project",
  files: [
    {
      fileName: "App.kt",
      kind: "functions",
      source: 'fun main() { println("ready") }',
    },
  ],
};
const link =
  "/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url");

for (const locale of ["en", "de"])
  test(`NAV-04 new project explains that examples are temporary (${locale})`, async ({
    page,
  }) => {
    const de = locale === "de";
    await page.addInitScript(
      (value) => localStorage.setItem("bluek-language", value),
      locale,
    );
    await page.goto("/");
    await page
      .getByRole("button", { name: de ? "Neu" : "New", exact: true })
      .click();
    await expect(page.locator(".project-choice-note")).toHaveText(
      de
        ? "Die folgenden Beispiele dienen zum Testen und Vorführen von BlueK. Sie werden später entfernt."
        : "The following examples currently exist to test and demonstrate BlueK. They will be removed in the long run.",
    );
  });

for (const locale of ["en", "de"])
  test(`NAV-01 project actions are separate from account and view controls (${locale})`, async ({
    page,
  }, info) => {
    const de = locale === "de";
    await page.addInitScript(
      (value) => localStorage.setItem("bluek-language", value),
      locale,
    );
    let apiCalls = 0;
    await page.route("**/api/**", (route) => {
      apiCalls++;
      return route.fulfill({ json: { user: null } });
    });
    await page.goto(link);
    const toolbar = page.locator(".toolbar");
    await expect(toolbar.locator(".toolbar-account button")).toContainText(
      de ? "Anmelden" : "Sign in",
    );
    await expect(toolbar.locator(":scope > .toolbar-main-action")).toHaveText(
      de
        ? ["Neu", "Öffnen", "Speichern", "Teilen"]
        : ["New", "Open", "Save", "Share"],
    );
    await expect(toolbar.locator(".toolbar-options button")).toHaveCount(3);
    await expect(toolbar.locator(".toolbar-account")).toContainText(
      de ? "Anmelden" : "Sign in",
    );
    await expect(toolbar.locator(".toolbar-account")).toHaveCSS(
      "border-left-style",
      "solid",
    );
    const projectTitle = toolbar.locator(".project-title");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const [toolbarBounds, titleBounds] = await Promise.all([
      toolbar.boundingBox(),
      projectTitle.boundingBox(),
    ]);
    expect(
      Math.abs(
        titleBounds!.x +
          titleBounds!.width / 2 -
          (toolbarBounds!.x + toolbarBounds!.width / 2),
      ),
    ).toBeLessThan(1);
    await page.setViewportSize({ width: 900, height: 1000 });
    const [titleAtNarrowWidth, leftAction, viewActions] = await Promise.all([
      projectTitle.boundingBox(),
      toolbar.locator(":scope > .toolbar-main-action").last().boundingBox(),
      toolbar.locator(".toolbar-options").boundingBox(),
    ]);
    expect(titleAtNarrowWidth!.x).toBeGreaterThanOrEqual(
      leftAction!.x + leftAction!.width,
    );
    expect(
      titleAtNarrowWidth!.x + titleAtNarrowWidth!.width,
    ).toBeLessThanOrEqual(viewActions!.x);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const sidebar = await page.locator(".sidebar").innerText();
    await toolbar
      .getByRole("button", { name: de ? "Speichern" : "Save", exact: true })
      .click();
    const save = page.getByRole("dialog", {
      name: de ? "Speichern" : "Save",
      exact: true,
    });
    await expect(save.locator(".project-choice-list button")).toHaveCount(4);
    await expect(save).not.toContainText(de ? "veröffentlichen" : "Publish");
    await expect(
      save.getByRole("button", {
        name: de ? /^BlueK-Projektdatei/ : /^Download BlueK project file/,
      }),
    ).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath(`save-${locale}-desktop.png`),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      save.getByRole("button", {
        name: de ? "Abbrechen" : "Cancel",
        exact: true,
      }),
    ).toBeInViewport();
    const saveBounds = await save.boundingBox();
    expect(saveBounds!.x).toBeGreaterThanOrEqual(0);
    expect(saveBounds!.x + saveBounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: info.outputPath(`save-${locale}-mobile.png`),
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await save
      .getByRole("button", {
        name: de ? "Ausführbare Webseite …" : "Runnable webpage …",
        exact: true,
      })
      .click();
    await save.locator(".program-settings summary").click();
    await expect(
      save.getByLabel(de ? "Projektnamen anzeigen" : "Show project name"),
    ).toBeVisible();
    await save
      .getByRole("button", { name: de ? "Zurück" : "Back", exact: true })
      .click();
    await expect(save.locator(".project-choice-list button")).toHaveCount(4);
    await page.keyboard.press("Escape");
    await toolbar
      .getByRole("button", { name: de ? "Teilen" : "Share", exact: true })
      .click();
    const share = page.getByRole("dialog", {
      name: de ? "Teilen" : "Share",
      exact: true,
    });
    await expect(share).toContainText(de ? "sieben Tage" : "seven days");
    await expect(share.getByRole("checkbox")).toHaveCount(0);
    await expect(
      share.getByRole("button", {
        name: de ? "Bearbeitungslink erstellen" : "Create editing link",
      }),
    ).toBeVisible();
    await expect(
      share.getByRole("button", {
        name: de ? "Ausführungslink erstellen" : "Create runnable link",
      }),
    ).toBeVisible();
    await expect(
      share.getByRole("button", { name: /BlueJ|JSON|HTML/ }),
    ).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`share-${locale}-desktop.png`),
    });
    await expect(
      share.getByRole("heading", {
        name: de ? "Programm ausführen" : "Run program",
      }),
    ).toBeVisible();
    await share.locator(".program-settings summary").click();
    await expect(
      share.getByLabel(de ? "Projektnamen anzeigen" : "Show project name"),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await page.locator(".sidebar").innerText()).toBe(sidebar);
    expect(apiCalls).toBe(1);
    await toolbar
      .getByRole("button", { name: de ? "Öffnen" : "Open", exact: true })
      .click();
    const open = page.getByRole("dialog", {
      name: de ? "Öffnen" : "Open",
      exact: true,
    });
    await expect(open.locator('[role="tab"]')).toHaveCount(4);
    await expect(open.locator('[role="tab"]')).toHaveText(
      de
        ? ["Datei", "Konto", "Link", "Wiederherstellen"]
        : ["File", "Account", "Link", "Restore"],
    );
    await expect(open.locator("#open-source-computer")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await open.locator("#open-source-browser").click();
    await expect(open.locator("#open-panel-browser")).toBeVisible();
    const openHeight = await open.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(apiCalls).toBe(1);
    await open.locator("#open-source-account").click();
    await expect(open.locator("#open-panel-account")).toBeVisible();
    expect(
      Math.abs(
        (await open.evaluate(
          (element) => element.getBoundingClientRect().height,
        )) - openHeight,
      ),
    ).toBeLessThan(1);
    await open.locator("#open-source-computer").click();
    await expect(
      open.locator("#open-panel-computer .project-dropzone"),
    ).toBeVisible();
    expect(
      Math.abs(
        (await open.evaluate(
          (element) => element.getBoundingClientRect().height,
        )) - openHeight,
      ),
    ).toBeLessThan(1);
    await open.locator("#open-source-link").click();
    await expect(open.locator("#open-panel-link")).toContainText(
      de ? "12-stellige Kennung" : "12-character code",
    );
    expect(apiCalls).toBe(2);
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: info.outputPath(`navigation-${locale}-desktop.png`),
    });
    await toolbar
      .getByRole("button", { name: de ? "Öffnen" : "Open", exact: true })
      .click();
    const reopened = page.getByRole("dialog", {
      name: de ? "Öffnen" : "Open",
      exact: true,
    });
    await expect(reopened.locator("#open-source-computer")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Escape");
  });

test("GUI-156 saving an unnamed project requires a non-empty project name", async ({
  page,
}) => {
  const unnamed = {
    format: "bluek-project",
    version: 1,
    projectName: "",
    files: [{ fileName: "App.kt", kind: "functions", source: "fun main() {}" }],
  };
  await page.goto(
    "/#bluek=p1." + Buffer.from(JSON.stringify(unnamed)).toString("base64url"),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const save = page.getByRole("dialog", { name: "Save", exact: true });
  const downloadChoice = save.getByRole("button", {
    name: /^Download BlueK project file/,
  });
  const dialogTypes: string[] = [];
  const answerEmptyName = async (dialog: import("@playwright/test").Dialog) => {
    dialogTypes.push(dialog.type());
    if (dialog.type() === "prompt") await dialog.accept("   ");
    else await dialog.accept();
  };
  page.on("dialog", answerEmptyName);
  await downloadChoice.click();
  await expect.poll(() => dialogTypes).toEqual(["prompt", "alert"]);
  page.off("dialog", answerEmptyName);
  await expect(save).toBeVisible();
  await expect(page.getByLabel("Project name")).toHaveValue("");

  page.once("dialog", (dialog) => dialog.accept("Named project"));
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadChoice.click(),
  ]);
  expect(download.suggestedFilename()).toBe("Named project.bluek.json");
  await expect(page.getByLabel("Project name")).toHaveValue("Named project");
});

test("NAV-02 signing in from Save returns to the save step without silently uploading", async ({
  page,
}) => {
  let signedIn = false,
    uploads = 0;
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: { user: signedIn ? { id: "a", username: "learner" } : null },
    }),
  );
  await page.route("**/api/account/login", (route) => {
    signedIn = true;
    return route.fulfill({ json: { user: { id: "a", username: "learner" } } });
  });
  await page.route("**/api/private-projects", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { projects: [] } });
    uploads++;
    return route.fulfill({
      json: { id: "00000000-0000-0000-0000-000000000001", revision: 1 },
    });
  });
  await page.goto(link);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const save = page.getByRole("dialog", { name: "Save", exact: true });
  await save.getByRole("button", { name: /^Save in account/ }).click();
  await save.getByRole("button", { name: "Sign in", exact: true }).click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  await account.getByLabel("Username", { exact: false }).fill("learner");
  await account
    .getByLabel("Password", { exact: true })
    .fill("navigation-password");
  await account
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(account).toBeHidden();
  await expect(
    save.getByRole("button", {
      name: "Save current project privately",
      exact: true,
    }),
  ).toBeVisible();
  expect(uploads).toBe(0);
  await save
    .getByRole("button", {
      name: "Save current project privately",
      exact: true,
    })
    .click();
  await expect(save.getByRole("status")).toContainText("saved privately");
  expect(uploads).toBe(1);
  await expect(
    save.getByRole("button", {
      name: "Update this private project",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .locator(".toolbar-account")
    .getByRole("button", { name: "Account", exact: true })
    .click();
  await expect(
    account.getByRole("button", { name: "Change password", exact: true }),
  ).toBeVisible();
  await expect(
    account.locator(".cloud-project-management"),
  ).toBeVisible();
  await account
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Change password", exact: true }),
  ).toBeVisible();
});

test("NAV-05 account overview includes project management and supports project actions and ZIP export", async ({
  page,
}, info) => {
  const firstId = "00000000-0000-0000-0000-000000000002";
  let renamedRequest: { body: unknown; revision: string | undefined } | null =
    null;
  let firstName = "Inheritance exercises";
  let firstRevision = 2;
  await page.route("**/api/account", (route) =>
    route.fulfill({ json: { user: { id: "a", username: "learner" } } }),
  );
  await page.route("**/api/private-projects/*", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      renamedRequest = {
        body: request.postDataJSON(),
        revision: request.headers()["if-match"],
      };
      firstName = request.postDataJSON().name;
      firstRevision++;
      return route.fulfill({
        json: {
          id: firstId,
          name: firstName,
          updatedAt: 1792800000000,
          revision: firstRevision,
        },
      });
    }
    return route.fulfill({
      json: {
        project: { ...project, projectName: firstName },
        revision: firstRevision,
      },
    });
  });
  await page.route("**/api/private-projects", (route) =>
    route.fulfill({
      json: {
        projects: [
          {
            id: firstId,
            name: firstName,
            updatedAt: 1792700000000,
            revision: firstRevision,
          },
          {
            id: "00000000-0000-0000-0000-000000000003",
            name: "Hello World",
            updatedAt: 1792600000000,
            revision: 1,
          },
        ],
      },
    }),
  );
  await page.goto(link);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const save = page.getByRole("dialog", { name: "Save", exact: true });
  await save.getByRole("button", { name: /^Save in account/ }).click();
  await expect(page.getByLabel("Project name")).toHaveValue(
    project.projectName,
  );
  await expect(save.getByLabel(/Name for this account copy/)).toHaveCount(0);
  await expect(
    save.getByRole("button", { name: /Rename|Delete|Download/ }),
  ).toHaveCount(0);
  await save
    .getByRole("button", {
      name: "Project management in your account",
      exact: true,
    })
    .click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  const manager = account.locator(".cloud-project-management");
  await expect(manager).toContainText("Inheritance exercises");
  await expect(manager).toContainText("Hello World");
  const row = manager
    .locator("li")
    .filter({ hasText: "Inheritance exercises" });
  await expect(
    row.getByRole("button", { name: "Open", exact: true }),
  ).toBeVisible();
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    row.getByRole("button", { name: "Download JSON", exact: true }).click(),
  ]);
  expect(await jsonDownload.suggestedFilename()).toBe(
    "Inheritance exercises.bluek.json",
  );
  const [zipDownload] = await Promise.all([
    page.waitForEvent("download"),
    manager
      .getByRole("button", {
        name: "Download all projects as ZIP",
        exact: true,
      })
      .click(),
  ]);
  expect(await zipDownload.suggestedFilename()).toBe("BlueK-Projekte.zip");
  const zipStream = await zipDownload.createReadStream();
  const zipChunks: Buffer[] = [];
  for await (const chunk of zipStream) zipChunks.push(Buffer.from(chunk));
  expect(Object.keys(unzipSync(Buffer.concat(zipChunks))).sort()).toEqual([
    "Hello World.bluek.json",
    "Inheritance exercises.bluek.json",
  ]);
  const rowHeight = (await row.boundingBox())!.height;
  await row
    .getByRole("button", { name: "Rename “Inheritance exercises”" })
    .click();
  const renameInput = manager.getByLabel("New name for “Inheritance exercises”");
  await expect(renameInput).toBeFocused();
  await expect(row.getByRole("button", { name: "Open", exact: true })).toBeVisible();
  expect(Math.abs((await row.boundingBox())!.height - rowHeight)).toBeLessThanOrEqual(1);
  await renameInput.fill("Inheritance unit");
  await renameInput.press("Enter");
  await expect(account.getByRole("status")).toHaveCount(0);
  await expect(manager).toContainText("Inheritance unit");
  expect(renamedRequest).toEqual({
    body: { name: "Inheritance unit" },
    revision: "2",
  });
  await page.screenshot({
    path: info.outputPath("account-project-renamed.png"),
  });
});

test("NAV-06 shared project codes are grouped for display and accept pasted links", async ({
  page,
}) => {
  let requestedCode = "";
  await page.route("**/api/projects/*", async (route) => {
    requestedCode = new URL(route.request().url()).pathname.split("/").at(-1)!;
    await route.fulfill({ json: { project } });
  });
  await page.goto(link);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const open = page.getByRole("dialog", { name: "Open", exact: true });
  await open.locator("#open-source-link").click();
  await open
    .getByLabel("Public project code")
    .fill("https://bluek.online/?p=7m4k-r9wp-3x6d");
  await open.getByRole("button", { name: "Load project", exact: true }).click();
  await expect(open).toBeHidden();
  expect(requestedCode).toBe("7m4kr9wp3x6d");
});

test("NAV-07 account project management creates a separate named copy", async ({
  page,
}) => {
  const sourceId = "00000000-0000-0000-0000-000000000011";
  const copyId = "00000000-0000-0000-0000-000000000012";
  let projects = [
    {
      id: sourceId,
      name: "Navigation project",
      updatedAt: 1792700000000,
      revision: 1,
    },
  ];
  let duplicatedPayload: unknown;
  await page.route("**/api/account", (route) =>
    route.fulfill({ json: { user: { id: "a", username: "learner" } } }),
  );
  await page.route("**/api/private-projects/*", (route) =>
    route.fulfill({ json: { project, revision: 1 } }),
  );
  await page.route("**/api/private-projects", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { projects } });
    duplicatedPayload = route.request().postDataJSON();
    projects = [
      {
        id: copyId,
        name: "Navigation project (Copy)",
        updatedAt: Date.now(),
        revision: 1,
      },
      ...projects,
    ];
    return route.fulfill({ status: 201, json: { id: copyId, revision: 1 } });
  });
  await page.goto(link);
  await page
    .locator(".toolbar-account")
    .getByRole("button", { name: "Account", exact: true })
    .click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  const manager = account.locator(".cloud-project-management");
  const sourceRow = manager.locator("li").filter({
    hasText: "Navigation project",
  });
  await sourceRow
    .getByRole("button", { name: "Duplicate “Navigation project”" })
    .click();
  await expect(manager).toContainText("Navigation project (Copy)");
  expect(duplicatedPayload).toEqual({
    ...project,
    projectName: "Navigation project (Copy)",
  });
  await expect(manager.locator("li")).toHaveCount(2);
});

test("NAV-03 Open only opens private projects; management owns rename and delete", async ({
  page,
}, info) => {
  let signedIn = false,
    deleted = false;
  let projectName = "Account project",
    revision = 1;
  const id = "00000000-0000-0000-0000-000000000001";
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: { user: signedIn ? { id: "a", username: "learner" } : null },
    }),
  );
  await page.route("**/api/account/login", (route) => {
    signedIn = true;
    return route.fulfill({ json: { user: { id: "a", username: "learner" } } });
  });
  await page.route("**/api/private-projects", (route) =>
    route.fulfill({
      json: {
        projects: deleted
          ? []
          : [
              {
                id,
                name: projectName,
                updatedAt: Date.now(),
                revision,
              },
            ],
      },
    }),
  );
  await page.route(`**/api/private-projects/${id}`, (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (route.request().method() === "PATCH") {
      projectName = route.request().postDataJSON().name;
      revision++;
      return route.fulfill({
        json: { id, name: projectName, updatedAt: Date.now(), revision },
      });
    }
    return route.fulfill({
      json: {
        project: { ...project, projectName },
        revision,
      },
    });
  });
  await page.goto(link);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const open = page.getByRole("dialog", { name: "Open", exact: true });
  await open.locator("#open-source-account").click();
  await open.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    open.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await open.getByRole("button", { name: "Sign in", exact: true }).click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  await account.getByLabel("Username", { exact: false }).fill("learner");
  await account
    .getByLabel("Password", { exact: true })
    .fill("navigation-password");
  await account
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(account).toBeHidden();
  await expect(open.getByRole("button", { name: "Refresh" })).toHaveCount(0);
  const projectRow = open.locator("#open-panel-account .cloud-projects li");
  await expect(projectRow.locator(".cloud-project-open")).toBeVisible();
  await expect(
    projectRow.getByRole("button", { name: /Rename|Delete|Download/ }),
  ).toHaveCount(0);
  await open
    .getByRole("button", {
      name: "Project management in your account",
      exact: true,
    })
    .click();
  const managerDialog = page.getByRole("dialog", {
    name: "Account",
    exact: true,
  });
  const manager = managerDialog.locator(".cloud-project-management");
  await expect(manager).toContainText("Account project");
  await manager
    .getByRole("button", { name: "Rename “Account project”" })
    .click();
  const renameInput = manager.getByLabel("New name for “Account project”");
  await renameInput.fill("Renamed account project");
  await renameInput.press("Enter");
  await expect(managerDialog.getByRole("status")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("account-projects-renamed.png"),
  });
  page.once("dialog", (dialog) => dialog.accept());
  await manager.getByRole("button", { name: "Open", exact: true }).click();
  await expect(managerDialog).toBeHidden();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Renamed account project",
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  const reopenedManager = page.getByRole("dialog", {
    name: "Account",
    exact: true,
  });
  const projectManager = reopenedManager.locator(".cloud-project-management");
  page.once("dialog", (dialog) => dialog.accept());
  await projectManager
    .getByRole("button", { name: "Delete “Renamed account project”" })
    .click();
  await expect(projectManager).toContainText("No private projects saved yet.");
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Renamed account project",
  );
});
