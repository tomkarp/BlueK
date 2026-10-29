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

test('GUI feedback accepts suggestions and sends selected attachments', async ({ page }) => {
  let submitted: any;
  await page.route('**/api/feedback**', route => {
    const request = route.request();
    if (request.method() === 'POST') {
      submitted = request.postDataJSON();
      return route.fulfill({ json: { reference: submitted.id, queued: false, issueNumber: 24 } });
    }
    return route.fulfill({ json: { available: true } });
  });
  await page.goto('/');
  await page.locator('.sidebar-feedback-button').click();
  const dialog = page.locator('.feedback-dialog');
  await dialog.getByLabel('What would you like to report?').selectOption('suggestion');
  await dialog.getByLabel('Short title', { exact: true }).fill('More ideas');
  await dialog.getByLabel('What happened?', { exact: true }).fill('Let users suggest improvements.');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'screen.png', mimeType: 'image/png', buffer: Buffer.from('image') });
  await dialog.getByRole('button', { name: 'Send report', exact: true }).click();
  await expect(dialog.locator('[role=status]')).toContainText('24');
  expect(submitted.category).toBe('suggestion');
  expect(submitted.attachments).toHaveLength(1);
  expect(submitted.attachments[0]).toMatchObject({ name: 'screen.png', type: 'image/png' });
  expect(Buffer.from(submitted.attachments[0].data, 'base64').toString()).toBe('image');
});

test('GUI feedback pastes images into both rich text fields', async ({ page }) => {
  let submitted: any;
  await page.route('**/api/feedback**', route => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { reference: submitted.id, queued: false, issueNumber: 25 } });
    }
    return route.fulfill({ json: { available: true } });
  });
  await page.goto('/');
  await page.locator('.sidebar-feedback-button').click();
  const dialog = page.locator('.feedback-dialog');
  await dialog.getByLabel('Short title', { exact: true }).fill('Image report');
  const fields = dialog.locator('[contenteditable="true"]');
  for (const field of [fields.nth(0), fields.nth(1)]) {
    await field.focus();
    await field.evaluate(element => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['image'], 'pasted.png', { type: 'image/png' }));
      element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: transfer }));
    });
    await expect(field.locator('img')).toBeVisible();
  }
  await expect(fields.nth(0).locator('img')).toHaveAttribute('data-size', 'medium');
  await dialog.getByLabel('Display size for pasted.png').first().selectOption('small');
  await expect(fields.nth(0).locator('img')).toHaveAttribute('data-size', 'small');
  const overlayBounds = await dialog.getByLabel('Display size for pasted.png').first().evaluate(select => {
    const image = select.parentElement?.querySelector('img');
    if (!image) throw new Error('Image overlay has no image');
    const control = select.getBoundingClientRect();
    const picture = image.getBoundingClientRect();
    return { atTopLeft: control.left - picture.left < 16 && control.top - picture.top < 16 };
  });
  expect(overlayBounds).toEqual({ atTopLeft: true });
  expect(submitted).toBeUndefined();
  await dialog.getByRole('button', { name: 'Remove' }).first().click();
  await expect(fields.nth(0).locator('img')).toHaveCount(0);
  await expect(fields.nth(1).locator('img')).toHaveCount(1);
  await expect(dialog.locator('.feedback-attachment-list li')).toHaveCount(1);
  await fields.nth(0).fill('The removed image no longer appears here.');
  await dialog.getByRole('button', { name: 'Send report', exact: true }).click();
  await expect(dialog.locator('[role=status]')).toContainText('25');
  expect(submitted.attachments).toHaveLength(1);
  expect(submitted.description).not.toContain('[[bluek-image:');
  expect(submitted.expected).toContain('[[bluek-image:');
  expect(submitted.attachments[0].displaySize ?? 'medium').toBe('medium');
});

test('GUI feedback removes pasted image attachment when deleted with Backspace', async ({ page }) => {
  await page.route('**/api/feedback**', route => route.fulfill({ json: { available: true } }));
  await page.goto('/');
  await page.locator('.sidebar-feedback-button').click();
  const dialog = page.locator('.feedback-dialog');
  const field = dialog.getByRole('textbox', { name: 'What happened?' });
  await field.evaluate(element => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['image'], 'delete.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: transfer }));
  });
  await expect(field.locator('img')).toHaveCount(1);
  await field.press('End');
  await field.press('Backspace');
  await field.press('Backspace');
  await expect(field.locator('img')).toHaveCount(0);
  await expect(dialog.locator('.feedback-attachment-list li')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Send report' })).toBeDisabled();
});

test('GUI feedback image size options follow the selected German language', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Language', { exact: true }).selectOption('de');
  await page.getByRole('dialog', { name: 'Einstellungen', exact: true }).getByRole('button', { name: 'Schließen', exact: true }).click();
  await page.locator('.sidebar-feedback-button').click();
  const field = page.locator('.feedback-rich-text').first();
  await field.evaluate(element => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['image'], 'clipboard.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: transfer }));
  });
  const size = page.getByLabel('Anzeigengröße für clipboard.png');
  await expect(size.locator('option')).toHaveText(['Originalgröße', 'Groß', 'Mittel', 'Klein']);
  await size.selectOption('large');
  const largeWidth = Number.parseFloat(await field.locator('img').evaluate(image => getComputedStyle(image).width));
  expect(largeWidth).toBeGreaterThan(480);
  await size.selectOption('small');
  await expect(field.locator('img')).toHaveAttribute('data-size', 'small');
  const width = await field.locator('img').evaluate(image => getComputedStyle(image).width);
  expect(width).toBe('240px');
});

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
