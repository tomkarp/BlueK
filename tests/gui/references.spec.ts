import { test, expect, type Page } from '@playwright/test';

async function load(page: Page) {
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Timer.kt', kind: 'class', source: `class Timer {
    var min = 0
    var max = 0
    val zeitspanne: Int get() = max - min
    fun setzeBereich(a: Int, b: Int) { min = a; max = b }
  }` }] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
}
async function evaluate(page: Page, code: string) {
  const entries = page.locator('.codepad-entry');
  const count = await entries.count();
  await page.getByLabel('Codepad input').fill(code);
  await page.getByLabel('Codepad input').press('Enter');
  await expect(entries).toHaveCount(count + 1);
  await expect(entries.last().locator('.codepad-error')).toHaveCount(0);
  return entries.nth(count);
}
const object = (page: Page, name: string) => page.locator('.bench .object').filter({ hasText: new RegExp(`^${name}:`) });
async function create(page: Page, name: string) {
  await page.locator('.classcard').click({ button: 'right' });
  await page.locator('.constructor-menu-item').click();
  const dialog = page.locator('.create-object-dialog');
  await dialog.getByLabel('Name of instance').fill(name);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(object(page, name)).toBeVisible();
}
async function remove(page: Page, name: string) {
  await object(page, name).click({ button: 'right' });
  await page.locator('.popup').getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(object(page, name)).toHaveCount(0);
}
async function adoptLast(page: Page, name: string) {
  await page.locator('.codepad-entry').last().locator('.codepad-object-result').click();
  const dialog = page.locator('.create-object-dialog');
  await dialog.getByLabel('Name of instance').fill(name);
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(object(page, name)).toBeVisible();
}

test('RT-07 aliases, getters, independent declarations and name reuse survive removing original', async ({ page }) => {
  await load(page);
  await create(page, 'timer1');
  await evaluate(page, 'val t = timer1; val t2 = t; val t3 = t2');
  await evaluate(page, 't3');
  await adoptLast(page, 't3');
  await remove(page, 'timer1');
  await evaluate(page, 'val a = 5');
  await evaluate(page, 't3.setzeBereich(5, 20)');
  await expect(await evaluate(page, 't3.zeitspanne')).toContainText('15');
  await create(page, 'timer1');
  await expect(await evaluate(page, 'timer1.zeitspanne')).toContainText('0');
  await expect(await evaluate(page, 't3.zeitspanne')).toContainText('15');
  await remove(page, 't3');
  await expect(await evaluate(page, 't3.zeitspanne')).toContainText('15');
});

test('RT-07 removed last reference disables old result handles and closes inspectors', async ({ page }) => {
  await load(page);
  await create(page, 'timer1');
  const entry = await evaluate(page, 'timer1');
  await object(page, 'timer1').dblclick();
  await expect(page.getByRole('dialog', { name: 'Object inspector', exact: true })).toBeVisible();
  await remove(page, 'timer1');
  await expect(page.getByRole('dialog', { name: 'Object inspector', exact: true })).toHaveCount(0);
  await expect(entry.locator('.codepad-object-result')).toBeDisabled();
  await evaluate(page, 'val a = 5');
  await create(page, 'timer1');
  await expect(entry.locator('.codepad-object-result')).toBeDisabled();
});

test('RT-07 Codepad var bench view follows reassignment and removal preserves the variable', async ({ page }) => {
  await load(page);
  await evaluate(page, 'var t = Timer(); t.min = 9');
  await evaluate(page, 't');
  await adoptLast(page, 't');
  await evaluate(page, 't = Timer()');
  await object(page, 't').dblclick();
  await expect(page.getByRole('dialog', { name: 'Object inspector', exact: true }).locator('.inspect-row').filter({ hasText: 'min : Int' }).locator('output')).toHaveText('0');
  await page.getByRole('dialog', { name: 'Object inspector', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await remove(page, 't');
  await expect(await evaluate(page, 't.min')).toContainText('0');
  await evaluate(page, 't');
  await adoptLast(page, 't');
  // Re-adopting the same name is an idempotent view operation.
  await evaluate(page, 't');
  await adoptLast(page, 't');
  await expect(page.locator('.bench .object')).toHaveCount(1);
});
