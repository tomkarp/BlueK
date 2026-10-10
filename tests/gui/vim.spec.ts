import { test, expect } from "@playwright/test";

for (const locale of ["en", "de"] as const) {
  test(`GUI-68 Vim keeps insert mode after i and cc while typing (${locale})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (locale) => localStorage.setItem("bluek-language", locale),
      locale,
    );
    const payload = {
      format: "bluek-project",
      version: 1,
      files: [
        {
          fileName: "Hund.kt",
          kind: "class",
          source: "class Hund {\n    // original\n}",
        },
      ],
    };
    await page.goto(
      "/#bluek=p1." +
        Buffer.from(JSON.stringify(payload)).toString("base64url"),
    );
    await page.locator(".classcard").dblclick();
    const editor = page.locator(".editor-dialog");
    const panel = editor.locator(".cm-panels");
    await page.keyboard.press("ControlOrMeta+Shift+V");
    await expect(panel).toHaveText("--NORMAL--");
    await page.keyboard.press("g");
    await page.keyboard.press("g");
    await page.keyboard.press("i");
    for (const character of "// inserted") {
      await page.keyboard.type(character);
      // Each keystroke must survive the source -> Svelte -> editor update.
      await expect(panel).toHaveText("--INSERT--");
    }
    await expect(editor.locator(".cm-line").first()).toHaveText(
      "// insertedclass Hund {",
    );
    await page.keyboard.press("Escape");
    await expect(panel).toHaveText("--NORMAL--");
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await page.keyboard.press("c");
    await expect(panel).toHaveText("--INSERT--");
    for (const character of "// changed") {
      await page.keyboard.type(character);
      await expect(panel).toHaveText("--INSERT--");
    }
    await expect(editor.locator(".cm-line").nth(1)).toHaveText(
      "    // changed",
    );
    await page.keyboard.press("Escape");
    await expect(panel).toHaveText("--NORMAL--");
    await page.keyboard.press("u");
    await expect(editor.locator(".cm-line").nth(1)).toHaveText("    ");
    await expect(panel).toHaveText("--NORMAL--");
    // CodeMirror keeps the cc deletion and subsequent insertion as two undo groups.
    await page.keyboard.press("u");
    await expect(editor.locator(".cm-line").nth(1)).toHaveText(
      "    // original",
    );
    await expect(editor).toBeVisible();
  });
}
