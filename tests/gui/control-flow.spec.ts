import { test, expect } from '@playwright/test';
import { controlFlowCases } from '../../scripts/control-flow-cases.mjs';

for (const locale of ['en', 'de']) {
  for (const entry of controlFlowCases.filter(c => c.id.startsWith('suspect-'))) {
    test(`RT-115/116 compiler diagnostic rejects ${entry.id} before main (${locale})`, async ({ page }) => {
      await page.addInitScript(language => localStorage.setItem('bluek-language', language), locale);
      const files = Object.entries(entry.files).map(([fileName, source]) => ({ fileName, source, kind: fileName === 'Tier.kt' ? 'class' : 'functions' }));
      await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify({ format: 'bluek-project', version: 1, files })).toString('base64url'));
      await page.getByRole('button', { name: locale === 'de' ? 'Kompilieren' : 'Compile', exact: true }).click();
      const editor = page.locator('.editor-dialog');
      const d = entry.diagnostic!;
      await expect(editor.locator('.editor-header h3')).toHaveText(d.fileName);
      await expect(editor.locator('.editor-diagnostic')).toHaveText(`${locale === 'de' ? 'Zeile' : 'Line'} ${d.line}: ${d.message}`);
      await expect(editor.locator('.cm-bluek-error-line')).toContainText(entry.id === 'suspect-3-int-condition' ? 'if (zahl)' : '}');
      await expect(page.getByRole('button', { name: locale === 'de' ? 'main starten' : 'Start main', exact: true })).toBeDisabled();
      // Correct the syntax/type rule in the editor and execute the same split project.
      const source = entry.files[d.fileName];
      const corrected = entry.id === 'suspect-1-conditional-return'
        ? source.replace('        }\n    }', '        }\n        return false\n    }')
        : entry.id === 'suspect-2-last-expression'
          ? source.replace('        glueckslevel >= 20', '        return glueckslevel >= 20')
          : source.replace('if (zahl)', 'if (zahl == 1)');
      await editor.locator('.cm-content').fill(corrected);
      await page.getByRole('button', { name: locale === 'de' ? 'Kompilieren' : 'Compile', exact: true }).click();
      await expect(editor.locator('.editor-diagnostics')).toHaveCount(0);
      await expect(page.getByRole('button', { name: locale === 'de' ? 'main starten' : 'Start main', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: locale === 'de' ? 'main starten' : 'Start main', exact: true }).click();
      await expect(page.locator('.terminal-output pre')).toHaveText(entry.id === 'suspect-3-int-condition' ? 'ja\n' : 'false\n');
    });
  }
}

// RT-117/118: practical definite assignment and nullability cases use separate cards.
import { flowStateCases } from "../../scripts/flow-state-cases.mjs";
for (const locale of ["en", "de"]) {
  for (const id of [
    "val-do-conditional-break",
    "null-nested-guard",
    "property-this-stable",
    "lambda-unmodified-var-capture",
    "val-try-catch-missing",
    "property-implicit-mutable",
    "lambda-later-var-write",
    "member-val-missing-branch",
  ]) {
    const entry = flowStateCases.find((c) => c.id === id)!;
    test(`RT-117/118 flow state ${id} (${locale})`, async ({ page }) => {
      await page.addInitScript(
        (language) => localStorage.setItem("bluek-language", language),
        locale,
      );
      const files = Object.entries(entry.files).map(([fileName, source]) => ({
        fileName,
        source,
        kind: fileName === "Main.kt" ? "functions" : "class",
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
      if (!entry.valid) {
        await expect(
          page.locator(".editor-dialog .editor-diagnostic"),
        ).not.toBeEmpty();
        await expect(main).toBeDisabled();
        await expect(page.locator(".terminal-output pre")).toHaveCount(0);
      } else {
        await expect(main).toBeEnabled();
        await main.click();
        await expect(page.locator(".terminal-output pre")).toHaveText(
          entry.output!,
        );
      }
    });
  }
}
