import { test, expect } from '@playwright/test';

for (const locale of ['en', 'de']) {
  for (const file of [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund' },
    { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {}' },
    { fileName: 'HundTest.kt', kind: 'class', isTestClass: true, source: 'class HundTest' },
  ]) {
    test(`GUI-141 file deletion confirms and cancels without losing state (${locale}, ${file.fileName})`, async ({ page }) => {
      await page.addInitScript(language => localStorage.setItem('bluek-language', language), locale);
      const payload = { format: 'bluek-project', version: 1, files: [file] };
      await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
      await page.getByRole('button', { name: locale === 'de' ? 'Kompilieren' : 'Compile', exact: true }).click();
      await expect(page.locator('.classcard.uncompiled')).toHaveCount(0);
      const card = page.locator('.classcard');
      await card.dblclick();
      const editor = page.locator('.editor-dialog');
      await expect(editor).toBeVisible();
      const input = page.getByLabel(locale === 'de' ? 'Codepad-Eingabe' : 'Codepad input');
      await input.fill('val retained = 42');
      await input.press('Enter');
      await expect(page.locator('.codepad-entry')).toHaveCount(1);
      await card.click({ button: 'right' });
      const prompt = locale === 'de'
        ? `Die Datei „${file.fileName}“ aus diesem Projekt löschen?`
        : `Delete the file “${file.fileName}” from this project?`;
      const cancelled = page.waitForEvent('dialog');
      const cancelClick = page.locator('.popup').getByRole('button', { name: locale === 'de' ? 'Löschen' : 'Delete', exact: true }).click();
      const cancelDialog = await cancelled;
      expect(cancelDialog.type()).toBe('confirm');
      expect(cancelDialog.message()).toBe(prompt);
      await cancelDialog.dismiss();
      await cancelClick;
      await expect(card).toBeVisible();
      await expect(card).not.toHaveClass(/uncompiled/);
      await expect(editor).toBeVisible();
      await expect(editor.locator('.cm-content')).toContainText(file.source);
      await expect(page.locator('.codepad-entry')).toHaveCount(1);
      await input.fill('retained');
      await input.press('Enter');
      await expect(page.locator('.codepad-entry').last().locator('.codepad-result-value')).toHaveText('42');
      const confirmed = page.waitForEvent('dialog');
      const deleteClick = page.locator('.popup').getByRole('button', { name: locale === 'de' ? 'Löschen' : 'Delete', exact: true }).click();
      const deleteDialog = await confirmed;
      expect(deleteDialog.message()).toBe(prompt);
      await deleteDialog.accept();
      await deleteClick;
      await expect(card).toHaveCount(0);
      await expect(editor).toHaveCount(0);
      await expect(page.locator('.codepad-entry')).toHaveCount(0);
    });
  }
}

test('an attached test saves no position until its class is deleted', async ({ page }) => {
  const project = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', source: 'class Hund {}' },
    { fileName: 'HundTest.kt', source: 'class HundTest {}', isTestClass: true, testTarget: 'Hund.kt' },
  ], cardPositions: { 'Hund.kt': { x: 180, y: 130 }, 'HundTest.kt': { x: 700, y: 700 } } };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(project)).toString('base64url'));
  const parent = page.getByRole('button', { name: 'Hund', exact: true });
  const child = page.getByRole('button', { name: 'HundTest', exact: true });
  await expect(child).toHaveClass(/attached-test/);
  const position = await child.evaluate(el => ({ x: parseFloat((el as HTMLElement).style.left), y: parseFloat((el as HTMLElement).style.top) }));
  expect(position).toEqual({ x: 210, y: 100 });
  const savedProject = () => page.evaluate(() => Object.values(localStorage).flatMap(value => {
    try { const item = JSON.parse(value); return item?.project?.files ? [item.project] : item?.files ? [item] : []; }
    catch { return []; }
  }).find(item => item.files.some((file: { fileName: string }) => file.fileName === 'HundTest.kt')));
  await expect.poll(async () => (await savedProject())?.cardPositions?.['Hund.kt']).toEqual({ x: 180, y: 130 });
  expect((await savedProject()).cardPositions).not.toHaveProperty('HundTest.kt');
  await parent.click({ button: 'right', position: { x: 15, y: 60 } });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.popup').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(child).not.toHaveClass(/attached-test/);
  await expect.poll(async () => (await savedProject())?.cardPositions?.['HundTest.kt']).toEqual(position);
  await page.reload();
  await expect(child).toBeVisible();
  expect(await child.evaluate(el => ({ x: parseFloat((el as HTMLElement).style.left), y: parseFloat((el as HTMLElement).style.top) }))).toEqual(position);
});
