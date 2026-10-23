import { test, expect } from "@playwright/test";
const project = {
  format: "bluek-project",
  version: 1,
  projectName: "Local original",
  files: [
    {
      fileName: "App.kt",
      kind: "functions",
      source: 'fun main() { println("local") }',
    },
  ],
};
const link = (value: unknown) =>
  "/#bluek=p1." + Buffer.from(JSON.stringify(value)).toString("base64url");

test("CLOUD-01 custom media cannot be published from either project or program UI and remain in local JSON", async ({
  page,
}) => {
  let uploads = 0;
  await page.route("**/api/projects", (route) => {
    uploads++;
    return route.fulfill({ status: 500, json: { error: "server" } });
  });
  await page.route("**/api/programs", (route) => {
    uploads++;
    return route.fulfill({ status: 500, json: { error: "server" } });
  });
  const resources = [
    { path: "images/apple.png", data: "data:image/png;base64,AAAA" },
    { path: "sounds/own.wav", data: "data:audio/wav;base64,AAAA" },
  ];
  await page.goto(link({ ...project, resources }));
  await expect(page.getByLabel("Project name")).toHaveValue(
    project.projectName,
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share", exact: true });
  await expect(
    dialog.getByRole("button", { name: /Full .* Link/ }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: /^Create editing link/ }).click();
  await expect(page.locator(".share-notice")).toContainText(
    "images/apple.png, sounds/own.wav",
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await dialog.getByRole("button", { name: /^Create runnable link/ }).click();
  await expect(page.locator(".share-notice")).toContainText(
    "Publication refused",
  );
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("dialog", { name: "Save", exact: true })
      .getByRole("button", { name: /^Download BlueK project file/ })
      .click(),
  ]);
  const { readFile } = await import("node:fs/promises");
  expect(
    JSON.parse(await readFile((await download.path())!, "utf8")).resources,
  ).toEqual(resources);
});

test("CLOUD-02 delayed publication load cannot replace work edited while it is pending", async ({
  page,
}) => {
  await page.goto(link(project));
  await expect(page.getByLabel("Project name")).toHaveValue(
    project.projectName,
  );
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/projects/7m4kr9wp3x6d", async (route) => {
    requested();
    await waiting;
    await route.fulfill({
      json: { project: { ...project, projectName: "Server copy" } },
    });
  });
  await page.goto("/?p=7m4kr9wp3x6d");
  await started;
  await expect(page.getByLabel("Project name")).toHaveValue(
    project.projectName,
  );
  await page.getByLabel("Project name").fill("New local edit");
  release();
  await expect(page.locator(".link-problem-notice")).toContainText(
    "Your local work is preserved",
  );
  await expect(page.getByLabel("Project name")).toHaveValue("New local edit");
  await page.reload();
  await expect(page.getByLabel("Project name")).toHaveValue("New local edit");
});

for (const locale of ["en", "de"])
  test(`CLOUD-03 account advice, password-manager fields and failed saves preserve local work (${locale})`, async ({
    page,
  }, info) => {
    await page.addInitScript(
      (value) => localStorage.setItem("bluek-language", value),
      locale,
    );
    let signedIn = false;
    await page.route("**/api/account", (route) =>
      route.fulfill({
        json: {
          user: signedIn ? { id: "account", username: "learner" } : null,
        },
      }),
    );
    await page.route("**/api/account/register", (route) => {
      signedIn = true;
      return route.fulfill({
        json: { user: { id: "account", username: "learner" } },
      });
    });
    await page.route("**/api/private-projects", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { projects: [] } })
        : route.fulfill({ status: 503, json: { error: "server" } }),
    );
    await page.goto(link(project));
    const de = locale === "de";
    await page
      .getByRole("button", { name: de ? "Anmelden" : "Sign in", exact: true })
      .click();
    const cloud = page.getByRole("dialog", {
      name: de ? "Konto" : "Account",
      exact: true,
    });
    await cloud
      .getByRole("button", {
        name: de ? "Konto erstellen" : "Create account",
        exact: true,
      })
      .click();
    await expect(cloud).toContainText(
      de
        ? "noch eine manuelle Kontowiederherstellung"
        : "manual account recovery",
    );
    await expect(cloud).toContainText(
      de ? "keine Mindestaufbewahrungsfrist" : "not a minimum retention period",
    );
    await expect(cloud.locator("input[type=email]")).toHaveCount(0);
    await expect(cloud.locator("input[autocomplete=new-password]")).toHaveCount(
      1,
    );
    await cloud.locator("input[autocomplete=username]").fill("learner");
    await cloud
      .locator("input[autocomplete=new-password]")
      .fill("a-unique-bluek-password");
    await cloud.getByRole("checkbox").check();
    await cloud
      .getByRole("button", {
        name: de ? "Konto erstellen" : "Create account",
        exact: true,
      })
      .last()
      .click();
    await cloud
      .getByRole("button", { name: de ? "Schließen" : "Close", exact: true })
      .click();
    await page
      .getByRole("button", { name: de ? "Speichern" : "Save", exact: true })
      .click();
    const save = page.getByRole("dialog", {
      name: de ? "Speichern" : "Save",
      exact: true,
    });
    await save
      .getByRole("button", {
        name: de ? /^Im Konto speichern/ : /^Save in account/,
      })
      .click();
    await save
      .getByRole("button", {
        name: de
          ? "Aktuelles Projekt privat speichern"
          : "Save current project privately",
        exact: true,
      })
      .click();
    await expect(save.getByRole("alert")).toContainText(
      de ? "lokale JSON-Sicherung" : "local JSON backup",
    );
    await expect(
      page.getByLabel(
        de ? "Name der Kontokopie" : "Name for this account copy",
      ),
    ).toHaveValue(project.projectName);
    await expect(save.getByRole("status")).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 720 });
    const bounds = await save.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.height).toBeLessThanOrEqual(720);
    await page.screenshot({
      path: info.outputPath(`cloud-${locale}-mobile.png`),
    });
  });

test("CLOUD-04 a malformed success receipt does not claim that a private save succeeded", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({ json: { user: { id: "account", username: "learner" } } }),
  );
  await page.route("**/api/private-projects", (route) =>
    route.fulfill({
      json: route.request().method() === "GET" ? { projects: [] } : {},
    }),
  );
  await page.goto(link(project));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const cloud = page.getByRole("dialog", { name: "Save", exact: true });
  await cloud.getByRole("button", { name: /^Save in account/ }).click();
  await cloud
    .getByRole("button", {
      name: "Save current project privately",
      exact: true,
    })
    .click();
  await expect(cloud.getByRole("alert")).toContainText(
    "download a local JSON backup",
  );
  await expect(cloud.getByRole("status")).toHaveCount(0);
  await expect(page.getByLabel("Name for this account copy")).toHaveValue(
    project.projectName,
  );
});

test("CLOUD-05 saving an unnamed project to an account requires a name", async ({
  page,
}) => {
  let savedProject: Record<string, unknown> | undefined;
  await page.route("**/api/account", (route) =>
    route.fulfill({ json: { user: { id: "account", username: "learner" } } }),
  );
  await page.route("**/api/private-projects", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { projects: [] } });
    savedProject = route.request().postDataJSON();
    return route.fulfill({
      json: { id: "00000000-0000-0000-0000-000000000001", revision: 1 },
    });
  });
  await page.goto(
    link({
      ...project,
      projectName: "",
    }),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const save = page.getByRole("dialog", { name: "Save", exact: true });
  await save.getByRole("button", { name: /^Save in account/ }).click();
  await expect(
    save.getByLabel("Name for this account copy"),
  ).toHaveValue("");
  page.once("dialog", (dialog) => dialog.accept("Named account project"));
  await save
    .getByRole("button", { name: "Save current project privately" })
    .click();
  await expect.poll(() => savedProject?.projectName).toBe("Named account project");
  await expect(page.getByLabel("Project name")).toHaveValue("Named account project");
});
