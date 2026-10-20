import { test, expect } from "@playwright/test";
import { interfaceCases } from "../../scripts/interface-cases.mjs";
for (const locale of ["en", "de"])
  for (const id of [
    "unrelated-interfaces",
    "generic-interface",
    "specific-A-B",
    "super-both",
    "super-preserves-this",
    "super-suspension",
    "conflicting-defaults",
    "super-abstract",
  ]) {
    const fixture = interfaceCases.find((c) => c.id === id)!;
    test(`RT-120/121/122 interfaces ${id} (${locale})`, async ({ page }) => {
      await page.addInitScript(
        (language) => localStorage.setItem("bluek-language", language),
        locale,
      );
      const files = Object.entries(fixture.files).map(([fileName, source]) => ({
        fileName,
        source,
        kind:
          fileName === "Main.kt" || fileName === "Functions.kt"
            ? "functions"
            : "class",
      }));
      await page.goto(
        "/#bluek=p1." +
          Buffer.from(
            JSON.stringify({ format: "bluek-project", version: 1, files }),
          ).toString("base64url"),
      );
      await page
        .getByRole("button", {
          name: locale === "de" ? "Kompilieren" : "Compile",
          exact: true,
        })
        .click();
      const main = page.getByRole("button", {
        name: locale === "de" ? "main starten" : "Start main",
        exact: true,
      });
      if (fixture.valid) {
        await expect(main).toBeEnabled();
        await main.click();
        await expect(page.locator(".terminal-output pre")).toHaveText(
          fixture.output!,
        );
      } else {
        await expect(
          page.locator(".editor-diagnostic").first(),
        ).not.toBeEmpty();
        await expect(main).toBeDisabled();
        await expect(page.locator(".terminal-output pre")).toHaveCount(0);
      }
    });
  }
