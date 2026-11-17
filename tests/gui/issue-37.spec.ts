import { test, expect } from "@playwright/test";

const originalId = "00000000-0000-0000-0000-000000000037";
const copyId = "00000000-0000-0000-0000-000000000038";
const project = {
  format: "bluek-project",
  version: 1,
  projectName: "Original",
  files: [{ fileName: "App.kt", source: 'fun main() { println("ready") }' }],
};
const link =
  "/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url");

for (const locale of ["en", "de"]) {
  test.describe(locale, () => {
    const de = locale === "de";
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        (value) => localStorage.setItem("bluek-language", value),
        locale,
      );
    });

    test(`CLOUD-10 singular password visibility at sign-in and registration (${locale})`, async ({
      page,
    }) => {
      await page.route("**/api/account", (route) =>
        route.fulfill({ json: { user: null } }),
      );
      await page.goto(link);
      await page.locator(".toolbar-account button").click();
      const account = page.locator(".cloud-dialog");
      const password = account.locator("input[name=password]");
      await password.fill("example-password");
      await account
        .getByRole("button", {
          name: de ? "Passwort anzeigen" : "Show password",
          exact: true,
        })
        .click();
      await expect(password).toHaveAttribute("type", "text");
      await account
        .getByRole("button", {
          name: de ? "Passwort verbergen" : "Hide password",
          exact: true,
        })
        .click();
      await expect(password).toHaveAttribute("type", "password");
      await account
        .getByRole("button", {
          name: de ? "Konto erstellen" : "Create account",
          exact: true,
        })
        .first()
        .click();
      await account
        .getByRole("button", {
          name: de ? "Passwort anzeigen" : "Show password",
          exact: true,
        })
        .click();
      await expect(account.locator('input[name="password"]')).toHaveAttribute(
        "type",
        "text",
      );
      await expect(
        account.locator('input[name="confirm-password"]'),
      ).toHaveAttribute("type", "text");
      await expect(
        account.getByRole("button", {
          name: de ? "Passwort verbergen" : "Hide password",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    test(`CLOUD-11 new named account copy becomes the active save target (${locale})`, async ({
      page,
    }, info) => {
      let failCopy = true;
      const writes: {
        method: string;
        path: string;
        name: string;
        match?: string;
      }[] = [];
      await page.route("**/api/**", (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === "/api/account")
          return route.fulfill({
            json: { user: { id: "a", username: "learner" } },
          });
        if (path === "/api/storage")
          return route.fulfill({ json: { used: 0, limit: 5242880 } });
        if (request.method() === "GET")
          return route.fulfill({ json: { projects: [] } });
        const name = request.postDataJSON().projectName;
        writes.push({
          method: request.method(),
          path,
          name,
          match: request.headers()["if-match"],
        });
        if (name === "My copy" && failCopy)
          return route.fulfill({ status: 503, json: { error: "server" } });
        return route.fulfill({
          json: {
            id:
              name === "Reloaded copy"
                ? "00000000-0000-0000-0000-000000000039"
                : request.method() === "PUT" || name === "My copy"
                  ? copyId
                  : originalId,
            revision: request.method() === "PUT" ? 2 : 1,
          },
        });
      });
      await page.goto(link);
      const save = page.getByRole("dialog", {
        name: de ? "Speichern" : "Save",
        exact: true,
      });
      const openSave = async () => {
        await page
          .getByRole("button", { name: de ? "Speichern" : "Save", exact: true })
          .click();
        await save
          .getByRole("button", {
            name: de ? /^Im Konto speichern/ : /^Save in account/,
          })
          .click();
      };
      await openSave();
      await expect(save.locator(".cloud-save-copy-choice")).toBeVisible();
      await save.locator(".cloud-save-choice").click();
      await expect(save).toBeHidden();
      await openSave();
      const copyLabel = de ? "Neue Kopie speichern" : "Save a new copy";
      await expect(
        save.getByRole("button", { name: copyLabel, exact: true }),
      ).toBeEnabled();
      if (de)
        await page.screenshot({
          path: info.outputPath("account-save-choices.png"),
        });
      await save.getByRole("button", { name: copyLabel, exact: true }).click();
      await expect(
        save.getByRole("button", { name: copyLabel, exact: true }),
      ).toBeDisabled();
      await save
        .getByLabel(
          de ? "Name für die neue Kontokopie" : "Name for the new account copy",
        )
        .fill("Cancelled");
      await save
        .locator("form")
        .getByRole("button", { name: de ? "Abbrechen" : "Cancel", exact: true })
        .click();
      expect(writes).toHaveLength(1);
      await expect(
        page.getByLabel(de ? "Projektname" : "Project name", { exact: true }),
      ).toHaveValue("Original");
      await save.getByRole("button", { name: copyLabel, exact: true }).click();
      await save
        .getByLabel(
          de ? "Name für die neue Kontokopie" : "Name for the new account copy",
        )
        .fill("  My copy  ");
      await save.getByRole("button", { name: copyLabel, exact: true }).click();
      await expect(save.getByRole("alert")).toBeVisible();
      await expect(
        page.getByLabel(de ? "Projektname" : "Project name", { exact: true }),
      ).toHaveValue("Original");
      if (de)
        await page.screenshot({
          path: info.outputPath("account-copy-form.png"),
        });
      failCopy = false;
      await save.getByRole("button", { name: copyLabel, exact: true }).click();
      await expect(save).toBeHidden();
      await expect(
        page.getByLabel(de ? "Projektname" : "Project name", { exact: true }),
      ).toHaveValue("My copy");
      await openSave();
      await save.locator(".cloud-save-choice").click();
      await expect(save).toBeHidden();
      await page.reload();
      await expect(
        page.getByLabel(de ? "Projektname" : "Project name", { exact: true }),
      ).toHaveValue("My copy");
      await openSave();
      await expect(save.locator(".cloud-save-choice")).toContainText(
        de ? "Im Konto speichern" : "Save to account",
      );
      await save.getByRole("button", { name: copyLabel, exact: true }).click();
      await save
        .getByLabel(
          de ? "Name für die neue Kontokopie" : "Name for the new account copy",
        )
        .fill("Reloaded copy");
      await save.getByRole("button", { name: copyLabel, exact: true }).click();
      await expect(save).toBeHidden();
      await expect(
        page.getByLabel(de ? "Projektname" : "Project name", { exact: true }),
      ).toHaveValue("Reloaded copy");
      expect(writes).toEqual([
        {
          method: "POST",
          path: "/api/private-projects",
          name: "Original",
          match: undefined,
        },
        {
          method: "POST",
          path: "/api/private-projects",
          name: "My copy",
          match: undefined,
        },
        {
          method: "POST",
          path: "/api/private-projects",
          name: "My copy",
          match: undefined,
        },
        {
          method: "PUT",
          path: `/api/private-projects/${copyId}`,
          name: "My copy",
          match: "1",
        },
        {
          method: "POST",
          path: "/api/private-projects",
          name: "Reloaded copy",
          match: undefined,
        },
      ]);
    });

    test(`GUI-165 codepad reports possible gaps and suppresses definite source errors (${locale})`, async ({
      page,
    }) => {
      await page.route("**/api/account", (route) =>
        route.fulfill({ json: { user: null } }),
      );
      await page.route("**/api/feedback**", (route) =>
        route.fulfill({ json: { available: true } }),
      );
      await page.goto(link);
      const input = page.locator(".codepad textarea");
      const entries = page.locator(".codepad-entry");
      const evaluate = async (code: string) => {
        const count = await entries.count();
        await input.fill(code);
        await input.press("Enter");
        await expect(entries).toHaveCount(count + 1);
        return entries.last();
      };
      await evaluate("var k = 1");
      for (const code of [
        "5 -",
        "(5 -)",
        "val missing =",
        "println(5",
        "val immutable = 1; immutable = 2",
        "fun missingReturn(): Int { println(1) }",
        "var k = 2",
        'val number: Int = "text"',
        'fun takesInt(n: Int) = n; takesInt("text")',
        'throw IllegalArgumentException("student")',
      ]) {
        const entry = await evaluate(code);
        await expect(entry.locator(".codepad-error")).toBeVisible();
        await expect(entry.locator(".feedback-inline-button")).toHaveCount(0);
      }
      const entry = await evaluate("missingKotlinFeature()");
      await entry.locator(".feedback-inline-button").click();
      const report = page.locator(".feedback-dialog");
      await report.locator("details").click();
      await expect(report.locator("pre")).toContainText(
        "missingKotlinFeature()",
      );
      await report
        .getByRole("button", { name: de ? "Abbrechen" : "Cancel", exact: true })
        .click();
      await page
        .getByRole("button", { name: de ? "Teilen" : "Share", exact: true })
        .click();
      await expect(page.locator(".export-mode-description").last()).toHaveText(
        de
          ? "Öffnet eine eigene Ansicht zum Ausführen des Programms und startet direkt main()."
          : "Opens a separate view for running the program and starts main() directly.",
      );
      await page.locator(".program-settings summary").click();
      await expect(
        page.locator(".program-export-options .program-source-note"),
      ).toHaveText([
        de
          ? "Quellcode bleibt über die Entwicklertools des Browsers auffindbar."
          : "Source code remains accessible through the browser's developer tools.",
      ]);
      for (const note of await page
        .locator(".program-export-options .program-source-note")
        .all())
        await expect(note).toBeVisible();
    });
  });
}
