import { test, expect } from '@playwright/test';

test('RT-08/RT-09 generic instances and inline returns work through the browser worker', async ({ page }) => {
  const payload = {
    format: 'bluek-project', version: 1,
    files: [
      { fileName: 'Box.kt', kind: 'class', source: 'class Box<T>(val value: T) { fun get(): T = value }' },
      { fileName: 'Functions.kt', kind: 'functions', source: `
        inline fun perform(block: () -> Unit) { block() }
        inline fun <reified T> matcher(): (Any) -> Boolean = { it is T }
        fun answer(): Int {
          perform { return Box<Int>(42).get() }
          return 0
        }
      ` },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  const evaluate = async (source: string, expected: string) => {
    const entries = page.locator('.codepad-entry');
    const count = await entries.count();
    await page.getByLabel('Codepad input').fill(source);
    await page.getByLabel('Codepad input').press('Enter');
    await expect(entries).toHaveCount(count + 1);
    await expect(entries.last().locator('.codepad-error')).toHaveCount(0);
    await expect(entries.last()).toContainText(expected);
  };
  await evaluate('val textBox = Box<String>("ready")', 'textBox');
  await evaluate('textBox.get()', 'ready');
  await evaluate('answer()', '42');
  await evaluate('val isText = matcher<String>()', 'isText');
  await evaluate('isText("ok") && !isText(1)', 'true');
});
