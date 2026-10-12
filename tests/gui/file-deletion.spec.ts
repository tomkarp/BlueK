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
