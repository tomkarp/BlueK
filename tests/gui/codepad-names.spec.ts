import { test, expect } from '@playwright/test';

for (const locale of ['en', 'de']) {
  test(`GUI-142 Codepad Get suggests the directly used name and keeps unnamed call results (${locale})`, async ({ page }) => {
    await page.addInitScript(language => localStorage.setItem('bluek-language', language), locale);
    const payload = { format: 'bluek-project', version: 1, files: [
      { fileName: 'Hund.kt', kind: 'class', source: 'class Hund { fun self(): Hund = this }' },
    ] };
    await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
    const input = page.getByLabel(locale === 'de' ? 'Codepad-Eingabe' : 'Codepad input');
    const entries = page.locator('.codepad-entry');
    async function evaluate(code: string) {
      const count = await entries.count();
      await input.fill(code);
      await input.press('Enter');
      await expect(entries).toHaveCount(count + 1);
      await expect(entries.last().locator('.codepad-error')).toHaveCount(0);
      return entries.last();
    }
    const name = page.getByLabel(locale === 'de' ? 'Instanzname' : 'Name of instance', { exact: true });
    const cancel = () => page.getByRole('button', { name: locale === 'de' ? 'Abbrechen' : 'Cancel', exact: true }).click();
    const first = await evaluate('val s = Hund(); s');
    await first.getByRole('button').click();
    await expect(name).toHaveValue('s');
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.locator('.bench .object')).toHaveCount(1);
    await expect(page.locator('.bench .object')).toContainText('s:');
    // Reading the same variable again proposes the same name and binding is idempotent.
    const direct = await evaluate('/* same variable */ s');
    await direct.getByRole('button').click();
    await expect(name).toHaveValue('s');
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.locator('.bench .object')).toHaveCount(1);
    const alias = await evaluate('val anderer = s; anderer');
    await alias.getByRole('button').click();
    await expect(name).toHaveValue('anderer');
    await cancel();
    // A method returning the very same named object must still use the class suggestion.
    const returned = await evaluate('s.self()');
    await returned.getByRole('button').click();
    await expect(name).toHaveValue('hund');
    await cancel();
    const created = await evaluate('Hund()');
    await created.getByRole('button').click();
    await expect(name).toHaveValue('hund');
    await cancel();
    await expect(page.locator('.bench .object')).toHaveCount(1);
  });
}
