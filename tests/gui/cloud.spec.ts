import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/storage", route => route.fulfill({ json: { used: 0, limit: 5242880, publications: [] } }));
});
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

test("CLOUD-06 restores the account status from the existing session on startup", async ({
  page,
}) => {
  let releaseSession!: () => void;
  const pendingSession = new Promise<void>((resolve) => {
    releaseSession = resolve;
  });
  await page.route("**/api/account", async (route) => {
    await pendingSession;
    await route.fulfill({
      json: { user: { id: "account", username: "learner" } },
    });
  });
  await page.goto(link(project));
  const accountButton = page.locator(".toolbar-account button");
  await expect(accountButton).toContainText("Checking account…");
  await expect(accountButton).toBeDisabled();
  releaseSession();
  await expect(accountButton).toHaveText("Account");
  await expect(accountButton).toHaveAttribute("title", "Signed in as learner");
});

test("CLOUD-01 custom media cannot be published from either project or program UI and remain in local JSON", async ({
  page,
}) => {
  let uploads = 0;
  await page.route("**/api/projects", (route) => {
    uploads++;
    return route.fulfill({ status: 422, json: { error: "custom-media", resources: ["images/apple.png", "sounds/own.wav"] } });
  });
  await page.route("**/api/programs", (route) => {
    uploads++;
    return route.fulfill({ status: 422, json: { error: "custom-media", resources: ["images/apple.png", "sounds/own.wav"] } });
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
    dialog.getByText("Publication details", { exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: /Full .* Link/ }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: /^Create editing link/ }).click();
  await expect(page.locator(".share-notice")).toContainText(
    "images/apple.png, sounds/own.wav",
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await dialog.getByRole("button", { name: /^Create runnable link/ }).click();
  await expect.poll(() => uploads).toBe(2);
  await expect(page.locator(".share-notice")).toContainText("Publication refused");
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
    await expect(
      cloud.getByText(
        de
          ? "Du kannst ohne Konto programmieren"
          : "You can program, run, use examples",
        { exact: false },
      ),
    ).toHaveCount(0);
    expect(
      await cloud.locator('input[name="password"]').getAttribute("placeholder"),
    ).toBeNull();
    await expect(
      cloud.locator("input[autocomplete=username]"),
    ).not.toBeFocused();
    const loginMode = cloud.locator(".cloud-actions button").filter({
      hasText: de ? "Anmelden" : "Sign in",
    });
    await expect(loginMode).toHaveAttribute("aria-pressed", "true");
    await expect(loginMode).toHaveCSS("background-color", "rgb(7, 105, 199)");
    await cloud
      .getByRole("button", {
        name: de ? "Konto erstellen" : "Create account",
        exact: true,
      })
      .click();
    await expect(cloud).toContainText(
      de ? "nach längerer Zeit ohne Anmeldung" : "after an extended period",
    );
    const registrationPassword = cloud.locator('input[name="password"]');
    expect(await registrationPassword.getAttribute("placeholder")).toBeNull();
    await expect(cloud.locator(".cloud-password-length-hint")).toHaveText(
      de ? "10–128 Zeichen" : "10–128 characters",
    );
    await expect(loginMode).toHaveAttribute("aria-pressed", "false");
    await expect(
      cloud.locator(".cloud-actions button").filter({
        hasText: de ? "Konto erstellen" : "Create account",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await cloud.locator("input[autocomplete=username]").fill("hä");
    await expect(cloud.locator(".cloud-validation-hint")).toContainText(
      de
        ? "mindestens drei Zeichen · Zeichen „ä“ ist nicht erlaubt"
        : "at least 3 characters · character “ä” is not allowed",
    );
    await expect(cloud.locator("input[type=email]")).toHaveCount(0);
    await expect(cloud.locator("input[autocomplete=new-password]")).toHaveCount(
      2,
    );
    await expect(cloud.locator('input[name="password"]')).toHaveAttribute(
      "minlength",
      "10",
    );
    await expect(cloud.locator("input[autocomplete=username]")).toHaveAttribute(
      "pattern",
      "[A-Za-z0-9._-]+",
    );
    await cloud.locator("input[autocomplete=username]").fill("learner");
    await registrationPassword.fill("a-unique-bluek-password");
    await expect(cloud.locator(".cloud-password-length-hint")).toHaveCount(0);
    await expect(
      cloud.locator('input[name="password"]:placeholder-shown'),
    ).toHaveCount(0);
    await cloud
      .locator('input[name="confirm-password"]')
      .fill("a-unique-bluek-password");
    await cloud.locator(".cloud-ack input").nth(0).check();
    await cloud.locator(".cloud-ack input").nth(1).check();
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
    await expect(save.getByText(/Angemeldet als|Signed in as/)).toHaveCount(0);
    await expect(save.getByText(/Projektgröße|Project size/)).toHaveCount(0);
    const saveAction = save.locator(".cloud-save-choice");
    await expect(saveAction).toContainText(project.projectName);
    await expect(saveAction).toContainText(
      de ? "Im Konto speichern" : "Save to account",
    );
    await saveAction.click();
    await expect(save.getByRole("alert")).toContainText(
      de ? "lokale JSON-Sicherung" : "local JSON backup",
    );
    await expect(
      page.getByLabel(de ? "Projektname" : "Project name"),
    ).toHaveValue(project.projectName);
    await expect(save.locator(".cloud-save-choice")).toContainText(
      project.projectName,
    );
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
  await cloud.locator(".cloud-save-choice").getByText("Save to account").click();
  await expect(cloud.getByRole("alert")).toContainText(
    "download a local JSON backup",
  );
  await expect(cloud.getByRole("status")).toHaveCount(0);
  await expect(page.getByLabel("Project name")).toHaveValue(
    project.projectName,
  );
  await expect(cloud.locator(".cloud-save-choice")).toContainText(
    project.projectName,
  );
});

test("CLOUD-05 saving an unnamed project to an account requires a name", async ({
  page,
}) => {
  await page.clock.install();
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
  await expect(page.getByLabel("Project name")).toHaveValue("");
  page.once("dialog", (dialog) => dialog.accept("Named account project"));
  await save.locator(".cloud-save-choice").getByText("Save to account").click();
  await expect
    .poll(() => savedProject?.projectName)
    .toBe("Named account project");
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Named account project",
  );
  await expect(save).toHaveCount(0);
  await expect(page.locator(".share-notice")).toHaveText(
    "Project saved to your account.",
  );
  await page.clock.fastForward(5000);
  await expect(page.locator(".share-notice")).toHaveCount(0);
});

test("CLOUD-07 project management link stays above the scrollable account project list", async ({
  page,
}) => {
  const projects = Array.from({ length: 16 }, (_, index) => ({
    id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    name: `Project ${index + 1}`,
    updatedAt: Date.now() - index * 1000,
    revision: 1,
  }));
  await page.route("**/api/account", (route) =>
    route.fulfill({ json: { user: { id: "account", username: "learner" } } }),
  );
  await page.route("**/api/private-projects", (route) =>
    route.fulfill({ json: { projects } }),
  );
  await page.goto(link(project));
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Open", exact: true });
  await dialog.getByRole("tab", { name: "Account" }).click();
  const managementLink = dialog.getByRole("button", {
    name: "Project management in your account",
  });
  const projectList = dialog.locator(".cloud-projects");
  await expect(managementLink).toBeVisible();
  await expect(dialog.getByText("Signed in as learner")).toHaveCount(0);
  await expect(projectList.getByText("Project 16")).toBeVisible();
  const before = await managementLink.boundingBox();
  const listSize = await projectList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(listSize.scrollHeight).toBeGreaterThan(listSize.clientHeight);
  await projectList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const after = await managementLink.boundingBox();
  expect(after!.y).toBe(before!.y);
  await expect(managementLink).toBeVisible();
});

test("CLOUD-08 selected account projects can be deleted together", async ({
  page,
}) => {
  let projects = Array.from({ length: 5 }, (_, index) => ({
    id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    name: `Project ${index + 1}`,
    updatedAt: Date.now() - index * 1000,
    revision: 1,
  }));
  let deleteRequests = 0;
  await page.route("**/api/account", (route) =>
    route.fulfill({ json: { user: { id: "account", username: "learner" } } }),
  );
  await page.route("**/api/private-projects**", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { projects } });
    if (route.request().method() === "DELETE") {
      deleteRequests++;
      const id = new URL(route.request().url()).pathname.split("/").at(-1);
      projects = projects.filter((project) => project.id !== id);
      return route.fulfill({ json: { ok: true } });
    }
    throw new Error(`Unexpected account-project request: ${route.request().method()}`);
  });
  await page.goto(link(project));
  await page.locator(".toolbar-account button").click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  await expect(account.locator(".cloud-project-management")).toBeVisible();
  await expect(account.getByText("Project 4")).toBeVisible();
  const firstCheckbox = account.getByRole("checkbox", {
    name: "Select project “Project 1”",
  });
  const fourthCheckbox = account.getByRole("checkbox", {
    name: "Select project “Project 4”",
  });
  const fifthCheckbox = account.getByRole("checkbox", {
    name: "Select project “Project 5”",
  });
  for (const checkbox of [firstCheckbox, fourthCheckbox, fifthCheckbox]) {
    const box = await checkbox.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(20);
    expect(box!.height).toBeLessThanOrEqual(20);
  }
  await firstCheckbox.check();
  await fourthCheckbox.check();
  await fifthCheckbox.check();
  page.once("dialog", (dialog) => dialog.accept());
  await account
    .getByRole("button", { name: "Delete selected projects (3)" })
    .click();
  await expect(account.getByText("Project 1")).toHaveCount(0);
  await expect(account.getByText("Project 4")).toHaveCount(0);
  await expect(account.getByText("Project 5")).toHaveCount(0);
  await expect(account.getByText("Project 2")).toBeVisible();
  await expect(account.getByText("Project 3")).toBeVisible();
  expect(deleteRequests).toBe(3);
});

for (const locale of ["en", "de"])
  test(`CLOUD-09 username changes check availability and update the account view (${locale})`, async ({
    page,
  }) => {
  await page.addInitScript(
    (value) => localStorage.setItem("bluek-language", value),
    locale,
  );
  const de = locale === "de";
  let username = "learner";
  await page.route("**/api/account", (route) =>
    route.fulfill({ json: { user: { id: "account", username } } }),
  );
  await page.route("**/api/private-projects", (route) =>
    route.fulfill({ json: { projects: [] } }),
  );
  await page.route("**/api/account/username", async (route) => {
    const body = route.request().postDataJSON() as {
      password: string;
      newUsername: string;
    };
    expect(body.password).toBe("current-password");
    if (body.newUsername.toLowerCase() === "taken.name")
      return route.fulfill({ status: 409, json: { error: "username-taken" } });
    username = body.newUsername.toLowerCase();
    return route.fulfill({ json: { user: { id: "account", username } } });
  });

  await page.goto(link(project));
  await page.locator(".toolbar-account button").click();
  const account = page.getByRole("dialog", {
    name: de ? "Konto" : "Account",
    exact: true,
  });
  await account
    .getByRole("button", {
      name: de ? "Benutzernamen ändern" : "Change username",
    })
    .click();
  const rename = page.getByRole("dialog", {
    name: de ? "Benutzernamen ändern" : "Change username",
    exact: true,
  });
  await rename.getByLabel(de ? "Neuer Benutzername" : "New username").fill("taken.name");
  await rename.getByLabel(de ? "Aktuelles Passwort" : "Current password").fill("current-password");
  await rename
    .getByRole("button", {
      name: de ? "Benutzernamen ändern" : "Change username",
    })
    .click();
  await expect(rename.getByRole("alert")).toHaveText(
    de ? "Dieser Benutzername ist bereits vergeben." : "This username is already taken.",
  );

  await rename
    .getByLabel(de ? "Aktuelles Passwort" : "Current password")
    .fill("current-password");
  await rename.getByLabel(de ? "Neuer Benutzername" : "New username").fill("New.Learner");
  await rename
    .getByRole("button", {
      name: de ? "Benutzernamen ändern" : "Change username",
    })
    .click();
  await expect(rename).toHaveCount(0);
  await expect(account).toContainText(
    de ? "Angemeldet als new.learner" : "Signed in as new.learner",
  );
  await expect(
    account.getByText(de ? "Benutzername geändert." : "Username changed."),
  ).toBeVisible();
});

for (const locale of ["en", "de"])
  test(`CLOUD-10 account passwords require confirmation and can be revealed (${locale})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("bluek-language", value),
      locale,
    );
    const de = locale === "de";
    let registered = false;
    let registrations = 0;
    let passwordChanges = 0;
    await page.route("**/api/account", (route) =>
      route.fulfill({
        json: {
          user: registered ? { id: "account", username: "learner" } : null,
        },
      }),
    );
    await page.route("**/api/account/register", async (route) => {
      registrations++;
      const body = route.request().postDataJSON() as {
        username: string;
        password: string;
      };
      expect(body.password).toBe("a-unique-bluek-password");
      registered = true;
      return route.fulfill({
        json: { user: { id: "account", username: body.username } },
      });
    });
    await page.route("**/api/private-projects", (route) =>
      route.fulfill({ json: { projects: [] } }),
    );
    await page.route("**/api/account/password", async (route) => {
      passwordChanges++;
      const body = route.request().postDataJSON() as {
        password: string;
        newPassword: string;
      };
      expect(body.password).toBe("old-bluek-password");
      expect(body.newPassword).toBe("a-different-bluek-password");
      return route.fulfill({ json: { ok: true } });
    });

    await page.goto(link(project));
    await page.locator(".toolbar-account button").click();
    const account = page.getByRole("dialog", {
      name: de ? "Konto" : "Account",
      exact: true,
    });
    await account
      .getByRole("button", {
        name: de ? "Konto erstellen" : "Create account",
        exact: true,
      })
      .click();
    await expect(account.locator(".cloud-validation-hint")).toHaveText(
      de ? "mindestens drei Zeichen" : "at least 3 characters",
    );
    const registerPassword = account.locator('input[name="password"]');
    const registerConfirmation = account.locator(
      'input[name="confirm-password"]',
    );
    await account.locator('input[name="username"]').fill("hä");
    await expect(account.locator(".cloud-validation-hint")).toContainText(
      de
        ? "mindestens drei Zeichen · Zeichen „ä“ ist nicht erlaubt"
        : "at least 3 characters · character “ä” is not allowed",
    );
    await expect(account.locator(".cloud-validation-hint")).toHaveCSS(
      "color",
      "rgb(180, 35, 24)",
    );
    await account.locator('input[name="username"]').fill("learner");
    await expect(account.locator(".cloud-validation-hint")).toHaveCount(0);
    expect(await registerPassword.getAttribute("placeholder")).toBeNull();
    await registerPassword.fill("a-unique-bluek-password");
    await registerConfirmation.fill("a-different-bluek-password");
    const revealPasswords = account.locator(".cloud-password-toggle");
    await expect(revealPasswords).toHaveAccessibleName(
      de ? "Passwörter anzeigen" : "Show passwords",
    );
    await revealPasswords.click();
    await expect(revealPasswords).toHaveAttribute("aria-pressed", "true");
    await expect(registerPassword).toHaveAttribute("type", "text");
    await expect(registerConfirmation).toHaveAttribute("type", "text");
    const acknowledgmentCheckboxes = account.locator(".cloud-ack input");
    const acknowledgmentCheckbox = acknowledgmentCheckboxes.nth(0);
    const acknowledgmentText = account.locator(".cloud-ack span").nth(0);
    const acknowledgmentCheckboxBounds =
      await acknowledgmentCheckbox.boundingBox();
    const acknowledgmentTextBounds = await acknowledgmentText.boundingBox();
    expect(acknowledgmentCheckboxBounds).not.toBeNull();
    expect(acknowledgmentTextBounds).not.toBeNull();
    expect(
      acknowledgmentTextBounds!.x -
        (acknowledgmentCheckboxBounds!.x + acknowledgmentCheckboxBounds!.width),
    ).toBeGreaterThanOrEqual(0);
    expect(
      acknowledgmentTextBounds!.x -
        (acknowledgmentCheckboxBounds!.x + acknowledgmentCheckboxBounds!.width),
    ).toBeLessThan(20);
    const revealBounds = await account.locator(".cloud-password-toggle").boundingBox();
    const confirmationBounds = await registerConfirmation.boundingBox();
    expect(revealBounds).not.toBeNull();
    expect(confirmationBounds).not.toBeNull();
    expect(revealBounds!.y).toBeGreaterThan(
      confirmationBounds!.y + confirmationBounds!.height - 1,
    );
    await expect(acknowledgmentText).toContainText(
      de ? "nur für BlueK" : "only for BlueK",
    );
    await expect(acknowledgmentText).toContainText(
      de ? "Andere Konten sind geschützt, da" : "Other accounts are protected because",
    );
    await acknowledgmentCheckbox.check();
    const createAccountButton = account
      .getByRole("button", {
        name: de ? "Konto erstellen" : "Create account",
        exact: true,
      })
      .last();
    await expect(createAccountButton).toBeDisabled();
    await expect(account.locator(".cloud-ack span").nth(1)).toContainText(
      de ? "verliere ich auch den Zugriff" : "lose access to my account",
    );
    await acknowledgmentCheckboxes.nth(1).check();
    await createAccountButton.click();
    await expect(account.getByRole("alert")).toHaveText(
      de
        ? "Die Passwörter stimmen nicht überein."
        : "The passwords do not match.",
    );
    expect(registrations).toBe(0);
    await registerConfirmation.fill("a-unique-bluek-password");
    await createAccountButton.click();
    await expect(account.getByText(/Angemeldet als learner|Signed in as learner/)).toBeVisible();
    expect(registrations).toBe(1);

    await account
      .getByRole("button", {
        name: de ? "Passwort ändern" : "Change password",
        exact: true,
      })
      .click();
    const changePassword = page.getByRole("dialog", {
      name: de ? "Passwort ändern" : "Change password",
      exact: true,
    });
    await changePassword.locator('input[name="current-password"]').fill("old-bluek-password");
    await changePassword.locator('input[name="new-password"]').fill("a-different-bluek-password");
    await changePassword
      .locator('input[name="confirm-new-password"]')
      .fill("a-unique-bluek-password");
    await changePassword
      .getByRole("button", {
        name: de ? "Passwort ändern" : "Change password",
        exact: true,
      })
      .click();
    await expect(changePassword.getByRole("alert")).toHaveText(
      de
        ? "Die Passwörter stimmen nicht überein."
        : "The passwords do not match.",
    );
    expect(passwordChanges).toBe(0);
    await changePassword
      .locator('input[name="confirm-new-password"]')
      .fill("a-different-bluek-password");
    await changePassword
      .getByRole("button", {
        name: de ? "Passwörter anzeigen" : "Show passwords",
      })
      .click();
    await expect(
      changePassword.getByRole("button", {
        name: de ? "Passwörter verbergen" : "Hide passwords",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(changePassword.locator('input[type="text"]')).toHaveCount(3);
    await changePassword
      .getByRole("button", {
        name: de ? "Passwort ändern" : "Change password",
        exact: true,
      })
      .click();
    await expect(changePassword).toHaveCount(0);
    await expect(account.getByRole("status")).toHaveText(
      de
        ? "Passwort geändert. Andere Sitzungen wurden abgemeldet."
        : "Password changed. Other sessions have been signed out.",
    );
    expect(passwordChanges).toBe(1);
  });

for (const locale of ["en", "de"])
  test(`CLOUD-12 account deletion requires the current password and explains deletion of public copies (${locale})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("bluek-language", value),
      locale,
    );
    const de = locale === "de";
    let deleted = false;
    await page.route("**/api/account", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: {
            user: deleted ? null : { id: "account", username: "learner" },
          },
        });
      expect(route.request().method()).toBe("DELETE");
      expect(route.request().postDataJSON()).toEqual({
        password: "current-password",
      });
      deleted = true;
      return route.fulfill({ json: { ok: true } });
    });
    await page.route("**/api/private-projects", (route) =>
      route.fulfill({ json: { projects: [] } }),
    );

    await page.goto(link(project));
    await page.locator(".toolbar-account button").click();
    const account = page.getByRole("dialog", {
      name: de ? "Konto" : "Account",
      exact: true,
    });
    await account
      .getByRole("button", {
        name: de ? "Konto löschen" : "Delete account",
        exact: true,
      })
      .click();
    const deletion = page.getByRole("dialog", {
      name: de ? "Konto löschen" : "Delete account",
      exact: true,
    });
    await expect(deletion.getByRole("alert")).toContainText(
      de ? "privaten Projekte" : "private projects",
    );
    await expect(deletion.getByRole("alert")).toContainText(
      de ? "geteilten Kopien" : "shared copies",
    );
    await expect(deleted).toBe(false);
    await deletion
      .getByLabel(de ? "Aktuelles Passwort" : "Current password")
      .fill("current-password");
    await deletion
      .getByRole("button", {
        name: de
          ? "Konto und alle Projekte löschen"
          : "Delete account and all projects",
      })
      .click();
    await expect(deletion).toHaveCount(0);
    await expect(account.getByRole("status")).toHaveText(
      de
        ? "Dein Konto, deine privaten Projekte und geteilten Kopien wurden gelöscht."
        : "Your account, private projects and shared copies have been deleted.",
    );
    await expect(page.locator(".toolbar-account button")).toHaveText(
      de ? "Anmelden" : "Sign in",
    );
    expect(deleted).toBe(true);
  });

test("CLOUD-13 a successful account save clears the unsaved-project warning", async ({
  page,
}) => {
  let saved = false;
  await page.route("**/api/account", (route) =>
    route.fulfill({ json: { user: { id: "account", username: "learner" } } }),
  );
  await page.route("**/api/private-projects", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { projects: [] } });
    expect(route.request().method()).toBe("POST");
    saved = true;
    return route.fulfill({
      json: { id: "123e4567-e89b-42d3-a456-426614174000", revision: 1 },
    });
  });
  await page.goto(link(project));
  await page.getByLabel("Project name").fill("Updated project");
  const dispatchBeforeUnload = () =>
    page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(await dispatchBeforeUnload()).toBe(true);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save", exact: true });
  await dialog.getByRole("button", { name: /^Save in account/ }).click();
  await dialog.locator(".cloud-save-choice").click();
  await expect(dialog).toHaveCount(0);
  expect(saved).toBe(true);
  expect(await dispatchBeforeUnload()).toBe(false);
});


test("CLOUD-14 regular accounts cannot manage shared publications", async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { user: { id: "account", username: "learner" } } }));
  await page.route("**/api/private-projects", route => route.fulfill({ json: { projects: [] } }));
  await page.route("**/api/storage", route => route.fulfill({ json: { used: 0, limit: 5242880 } }));
  await page.goto(link(project));
  await page.locator(".toolbar-account button").click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  await expect(account).toContainText("0.00 of 5 MiB");
  await expect(account.getByText("Manage shared copies")).toHaveCount(0);
  await expect(account.getByText("abcd2345efgh")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await account.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("CLOUD-15 trusted publication sends custom media and displays a one-year receipt", async ({ page }) => {
  const resources = [{ path: "images/own.png", data: "data:image/png;base64,AAAA" }];
  let sent: unknown;
  await page.route("**/api/account", route => route.fulfill({ json: { user: { id: "account", username: "learner" } } }));
  await page.route("**/api/projects", route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { code: "abcd2345efgh", expiresAt: "2027-10-30T00:00:00Z", expiresInDays: 365 } });
  });
  await page.goto(link({ ...project, resources }));
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const sharing = page.getByRole("dialog", { name: "Share", exact: true });
  await expect(sharing).not.toContainText("Immutable copy:");
  await sharing.getByRole("button", { name: /^Create editing link/ }).click();
  await expect(page.locator(".share-link-dialog")).toContainText("365 days");
  expect((sent as { resources: unknown }).resources).toEqual(resources);
});

test("CLOUD-16 ordinary account and project buttons share rounded hover styling in both themes", async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { user: { id: "account", username: "learner" } } }));
  await page.route("**/api/private-projects", route => route.fulfill({ json: { projects: [{ id: "project", name: "Example", updatedAt: 1, revision: 1 }] } }));
  await page.goto(link(project));
  await page.locator(".toolbar-account button").click();
  const actions = page.locator(".cloud-account-actions button");
  await expect(actions).toHaveCount(4);
  for (const dark of [false, true]) {
    await page.locator(".bluek").evaluate((element, enabled) => element.classList.toggle("dark", enabled), dark);
    for (let index = 0; index < 4; index++) {
      const button = actions.nth(index);
      await page.mouse.move(0, 0);
      const before = await button.evaluate(element => getComputedStyle(element).backgroundColor);
      await expect(button).toHaveCSS('border-color', dark ? 'rgb(85, 85, 92)' : 'rgb(170, 170, 170)');
      await button.hover();
      const after = await button.evaluate(element => getComputedStyle(element).backgroundColor);
      expect(after).toBe(dark ? "rgb(69, 69, 74)" : "rgb(222, 222, 222)");
      expect(after).not.toBe(before);
    }
    const projectButton = page.locator(".cloud-management-actions button").first();
    await projectButton.hover();
    const projectStyle = await projectButton.evaluate(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius, appearance: style.appearance };
    });
    await actions.first().hover();
    const accountStyle = await actions.first().evaluate(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius, appearance: style.appearance };
    });
    expect(projectStyle).toEqual(accountStyle);
    expect(projectStyle.radius).toBe("6px");
    expect(projectStyle.appearance).toBe("none");
  }
});

test("GUI-157 account mode and password action use readable accent colors", async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { user: null } }));
  await page.goto(link(project));
  await page.locator('.toolbar-account button').click();
  const mode = page.locator('.cloud-mode-button[aria-pressed="true"]');
  const password = page.locator('.cloud-password-toggle').last();
  for (const dark of [false, true]) {
    await page.locator('.bluek').evaluate((element, enabled) => element.classList.toggle('dark', enabled), dark);
    await expect(mode).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(mode).toHaveCSS('background-color', 'rgb(7, 105, 199)');
    await expect(password).toHaveCSS('color', dark ? 'rgb(143, 200, 255)' : 'rgb(7, 105, 199)');
  }
});

test("CLOUD-17 project action icons and selection toolbar keep their spacing", async ({ page }, info) => {
  await page.route("**/api/account", route => route.fulfill({ json: { user: { id: "account", username: "learner" } } }));
  await page.route("**/api/private-projects", route => route.fulfill({ json: { projects: [{ id: "project", name: "Example", updatedAt: 1, revision: 1 }] } }));
  await page.goto(link(project));
  await page.locator(".toolbar-account button").click();
  const actions = page.locator(".cloud-management-icon-action");
  await expect(actions).toHaveCount(4);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const dark of [false, true]) {
      await page.locator(".bluek").evaluate((element, enabled) => element.classList.toggle("dark", enabled), dark);
      for (const button of await actions.all()) {
        const bounds = (await button.boundingBox())!;
        const icon = (await button.locator("svg").boundingBox())!;
        expect(Math.abs(icon.x + icon.width / 2 - bounds.x - bounds.width / 2)).toBeLessThan(0.5);
        expect(Math.abs(icon.y + icon.height / 2 - bounds.y - bounds.height / 2)).toBeLessThan(0.5);
      }
      const heading = (await page.locator(".cloud-project-management-heading").boundingBox())!;
      const selection = (await page.locator(".cloud-management-selection").boundingBox())!;
      expect(selection.y - heading.y - heading.height).toBeGreaterThanOrEqual(15);
      await page.screenshot({ path: info.outputPath(`project-actions-${width}-${dark ? "dark" : "light"}.png`) });
    }
  }
});
