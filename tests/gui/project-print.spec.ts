import { expect, test } from "@playwright/test";

test("GUI-167 prints the current project files in the chosen order", async ({ page, browserName }) => {
  const project = {
    format: "bluek-project",
    version: 1,
    projectName: "Print example",
    library: { id: "blueplay", version: 1 },
    readme: "# Instructions\n\nUse **your own code**.",
    files: [
      { fileName: "AFunctions.kt", source: "fun hello() = \"hello\"" },
      { fileName: "Student.kt", source: "class Student" },
      { fileName: "StudentTest.kt", source: "class StudentTest", testTarget: "Student.kt", isTestClass: true },
    ],
    resources: [
      { path: "images/dot.png", data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRk8AAAAASUVORK5CYII=" },
      { path: "sounds/example.wav", data: "data:audio/wav;base64,UklGRg==" },
    ],
  };
  await page.addInitScript(() => {
    localStorage.setItem("bluek-language", "en");
    window.print = () => document.body.dataset.printRequested = "true";
  });
  await page.goto("/#bluek=p1." + Buffer.from(JSON.stringify(project)).toString("base64url"));
  await page.getByRole("button", { name: "AFunctions", exact: true }).dblclick();
  const editor = page.locator(".editor-dialog .cm-content");
  await editor.click();
  const mod = await page.evaluate(() => /Mac/.test(navigator.platform) ? "Meta" : "Control");
  await page.keyboard.press(mod + "+a");
  await page.keyboard.insertText('fun hello() = "unsaved"');

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: /Print project/ }).click();
  const preview = page.getByRole("dialog", { name: "Print preview" });
  const paper = preview.locator(".project-print-paper");
  const headings = paper.locator(".print-source h2");
  const rows = preview.locator(".print-file-list li");
  await expect(headings).toHaveText(["Student.kt", "StudentTest.kt", "AFunctions.kt"]);
  await expect(paper.locator(".cm-md-h1")).toHaveText("Instructions");
  await expect(paper.locator(".cm-md-strong")).toHaveText("your own code");
  await expect(paper.locator(".tok-keyword").last()).toHaveText("fun");
  await expect(paper.locator(".tok-string")).toHaveText('"unsaved"');
  await expect(paper.getByText("images/dot.png")).toBeVisible();
  await expect(paper.getByText("sounds/example.wav")).toBeVisible();

  const fileRow = (name: string) =>
    rows.filter({ has: page.getByRole("checkbox", { name, exact: true }) });
  const documentHeadings = paper.locator(".print-readme h2, .print-source h2");
  const readme = preview.getByRole("checkbox", { name: "README.md", exact: true });
  await expect(readme).toBeChecked();
  await expect(documentHeadings).toHaveText(["README.md", "Student.kt", "StudentTest.kt", "AFunctions.kt"]);
  await readme.uncheck();
  await expect(paper.locator(".print-readme")).toHaveCount(0);
  await readme.check();
  await fileRow("README.md").locator(".drag-handle").dragTo(fileRow("AFunctions.kt"));
  await expect(documentHeadings).toHaveText(["Student.kt", "StudentTest.kt", "AFunctions.kt", "README.md"]);

  await fileRow("AFunctions.kt").locator(".drag-handle").dragTo(fileRow("Student.kt"));
  await expect(headings).toHaveText(["AFunctions.kt", "Student.kt", "StudentTest.kt"]);
  await preview.getByRole("checkbox", { name: "Student.kt", exact: true }).uncheck();
  await expect(headings).toHaveText(["AFunctions.kt", "StudentTest.kt"]);
  await preview.getByRole("checkbox", { name: "Student.kt", exact: true }).check();
  await preview.getByRole("button", { name: "Move StudentTest.kt up" }).click();
  await expect(headings).toHaveText(["AFunctions.kt", "StudentTest.kt", "Student.kt"]);
  const lineNumbers = preview.getByRole("checkbox", { name: "Line numbers" });
  await expect(lineNumbers).toBeChecked();
  await expect(paper.locator(".line-number")).toHaveText(["1", "1", "1"]);
  await lineNumbers.uncheck();
  await expect(paper.locator(".line-number")).toHaveCount(0);
  await expect(paper.locator(".tok-string")).toHaveText('"unsaved"');
  await lineNumbers.check();
  await expect(paper.locator(".line-number")).toHaveCount(3);
  await lineNumbers.uncheck();

  await preview.getByRole("button", { name: "Print / Save as PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-print-requested", "true");
  await page.emulateMedia({ media: "print" });
  await expect(preview.locator(".print-settings")).toBeHidden();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeHidden();
  await expect(headings).toHaveText(["AFunctions.kt", "StudentTest.kt", "Student.kt"]);
  await expect(headings.last()).toBeVisible();
  await expect(documentHeadings).toHaveText(["AFunctions.kt", "StudentTest.kt", "Student.kt", "README.md"]);
  await expect(paper.locator(".line-number")).toHaveCount(0);
  if (browserName === "chromium") {
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }
  await page.emulateMedia({ media: null });
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(page.getByRole("button", { name: /Print project/ })).toBeVisible();

  await page.keyboard.press("Escape");
  await editor.click();
  await page.keyboard.press(mod + "+p");
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(page.getByRole("button", { name: /Print project/ })).toBeHidden();
});
