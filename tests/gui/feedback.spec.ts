import { test, expect } from '@playwright/test';

for (const locale of ['en', 'de'] as const) {
  test(`GUI-137 ${locale}: reopened report sends current functions and classes; receipt omits privacy sentence`, async ({ page }) => {
    const sent: any[] = [];
    await page.route('**/api/feedback**', route => {
      const request = route.request();
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/feedback') {
        const report = request.postDataJSON();
        sent.push(report);
        return route.fulfill({ json: { reference: report.id, queued: false, issueNumber: 12 } });
      }
      if (new URL(request.url()).pathname === '/api/feedback/config') {
        return route.fulfill({ json: { available: true } });
      }
      return route.abort();
    });
    const payload = { format: 'bluek-project', version: 1, projectName: 'Issue 12', readme: 'Complete project', files: [
      { fileName: 'Tier.kt', kind: 'class', source: 'class Tier' },
      { fileName: 'TierTest.kt', kind: 'class', source: 'class TierTest', isTestClass: true, testTarget: 'Tier.kt' },
    ] };
    await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
    await expect(page.getByRole('button', { name: 'Tier', exact: true })).toBeVisible();
    await page.locator('.sidebar-feedback-button').click();
    let dialog = page.locator('.feedback-dialog');
    await dialog.getByLabel('Short title', { exact: true }).fill('Delayed val');
    await dialog.getByLabel('What happened?', { exact: true }).fill('Compile error');
    await dialog.getByLabel('Include the current BlueK project', { exact: true }).check();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Adding a functions file after cancelling a report used to leave only the
    // earlier files in its attachment, even when reopening for a newer error.
    await page.getByRole('button', { name: 'New File', exact: true }).click();
    const newFile = page.getByRole('dialog', { name: 'Create New Kotlin File' });
    await newFile.getByRole('radio', { name: 'Kotlin Functions' }).check();
    await newFile.getByLabel('Name', { exact: true }).fill('Main');
    await newFile.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('button', { name: 'Main', exact: true }).dblclick();
    const source = page.locator('.editor-dialog .cm-content').last();
    await source.fill('fun main() { println("Issue 12") }');
    if (locale === 'de') {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByLabel('Language', { exact: true }).selectOption('de');
      await page.getByRole('dialog', { name: 'Einstellungen', exact: true }).getByRole('button', { name: 'Schließen', exact: true }).click();
    }
    await page.locator('.sidebar-feedback-button').click();
    dialog = page.locator('.feedback-dialog');
    await expect(dialog.locator('input[type=text]')).toHaveValue('Delayed val');
    await dialog.locator('details summary').click();
    const preview = JSON.parse(await dialog.locator('details pre').innerText());
    expect(preview.project.files.map((file: any) => file.fileName)).toEqual(['Tier.kt', 'TierTest.kt', 'Main.kt']);
    expect(preview.project.files[2]).not.toHaveProperty('kind');
    expect(preview.project.files[2].source).toContain('fun main');
    expect(preview.project.readme).toBe(payload.readme);
    await dialog.getByRole('button', { name: locale === 'de' ? 'Meldung senden' : 'Send report', exact: true }).click();
    await expect(dialog.locator('[role=status]')).toContainText(locale === 'de' ? '12' : 'Report number: 12');
    expect(sent).toHaveLength(1);
    expect(sent[0].project).toEqual(preview.project);
    expect(sent[0].environment.language).toBe(locale);
    await expect(dialog.locator('[role=status]')).not.toContainText(/Die Meldung ist privat\.|The report is private\./);
    await expect(dialog.locator('.feedback-hint')).toContainText(locale === 'de' ? 'E-Mail-Adresse' : 'email address');
  });
}

test('RT-110 delayed val in when compiles and executes each selected branch', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Main.kt', kind: 'functions', source: `
    fun message(action: Int): String {
      val aktionsmeldung: String
      when (action) {
        1 -> aktionsmeldung = "eins"
        2 -> aktionsmeldung = "zwei"
        else -> aktionsmeldung = "sonst"
      }
      return aktionsmeldung
    }
  ` }] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  const input = page.getByLabel('Codepad input', { exact: true });
  await expect(input).toBeEnabled();
  await input.fill('(0..2).map { message(it) }.joinToString()');
  await input.press('Enter');
  await expect(page.locator('.codepad-result-value').last()).toContainText('sonst, eins, zwei');
  await expect(page.locator('.codepad-error')).toHaveCount(0);
  await expect(page.locator('.compiler-dialog')).toHaveCount(0);
});
