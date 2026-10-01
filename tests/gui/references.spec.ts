import { test, expect, type Page } from '@playwright/test';

async function load(page: Page) {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Timer.kt', kind: 'class', source: `class Timer {
    var min = 0
    var max = 0
    val zeitspanne: Int get() = max - min
    fun setzeBereich(a: Int, b: Int) { min = a; max = b }
  }` },
    { fileName: 'Child.kt', kind: 'class', source: 'class Child { var value = 1 }' },
    { fileName: 'Parent.kt', kind: 'class', source: 'class Parent(val child: Child, val other: Child)' },
    { fileName: 'Slow.kt', kind: 'class', source: 'class Slow(val child: Child) { val first: Int get() { Thread.sleep(250); return 1 }; val second: Int get() { Thread.sleep(250); return 2 } }' },
    { fileName: 'Faulty.kt', kind: 'class', source: 'class Faulty { var n = 1; val bad: String get() = throw IllegalStateException("No world"); val good: Int get() = n * 10; val absent: String? get() = null }' },
  ] };
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
  await page.getByRole('button', { name: 'Timer', exact: true }).click({ button: 'right' });
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

test('GUI-88 inspector shows object references as arrows and opens them by their attribute name', async ({ page }) => {
  await load(page);
  await evaluate(page, 'val shared = Child(); val parent = Parent(shared, shared)');
  await evaluate(page, 'parent');
  await adoptLast(page, 'parent');
  await object(page, 'parent').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector', exact: true });
  await expect(inspector.locator('.inspect-reference')).toHaveCount(2);
  await expect(inspector.locator('.inspect-row').filter({ hasText: 'child : Child' }).locator('output')).toHaveCount(0);
  await inspector.getByRole('button', { name: 'Open referenced object child' }).click();
  const childInspector = page.getByRole('dialog', { name: 'Object inspector', exact: true }).filter({ hasText: 'child : Child' });
  await expect(childInspector).toBeVisible();
  await expect(childInspector.locator('.inspect-row').filter({ hasText: 'value : Int' }).locator('output')).toHaveText('1');
  await childInspector.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('dialog', { name: 'Object inspector', exact: true }).filter({ hasText: 'parent : Parent' }).getByRole('button', { name: 'Open referenced object other' }).click();
  await expect(page.getByRole('dialog', { name: 'Object inspector', exact: true }).filter({ hasText: 'other : Child' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Object inspector', exact: true }).filter({ hasText: 'other : Child' }).locator('.inspect-row').filter({ hasText: 'value : Int' }).dblclick();
  await expect(page.getByLabel('Value of value')).toHaveCount(0);
});

test('GUI-89 inspection does not flicker Compile and a reference click waits for a pending getter', async ({ page }) => {
  await load(page);
  await evaluate(page, 'val parent = Parent(Child(), Child())');
  await evaluate(page, 'parent');
  await adoptLast(page, 'parent');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === 'Compile');
    if (!button) throw new Error('Compile button missing');
    const transitions: boolean[] = [];
    (window as Window & { compileTransitions?: boolean[] }).compileTransitions = transitions;
    new MutationObserver(() => transitions.push(button.hasAttribute('disabled')))
      .observe(button, { attributes: true, attributeFilter: ['disabled'] });
  });
  await object(page, 'parent').dblclick();
  const parentInspector = page.getByRole('dialog', { name: 'Object inspector', exact: true }).filter({ hasText: 'parent : Parent' });
  await expect(parentInspector).toBeVisible();
  await parentInspector.getByRole('button', { name: 'Open referenced object child' }).click();
  const childInspector = page.getByRole('dialog', { name: 'Object inspector', exact: true }).filter({ hasText: 'child : Child' });
  await expect(childInspector).toBeVisible();
  const childBox = (await childInspector.boundingBox())!;
  await page.mouse.move(childBox.x + 22, childBox.y + 18);
  await page.mouse.down();
  await page.mouse.move(childBox.x + 460, childBox.y + 110);
  await page.mouse.up();
  await parentInspector.getByRole('button', { name: 'Open referenced object other' }).click();
  await expect(page.locator('.inspect-window h2').filter({ hasText: /^other : Child$/ })).toBeVisible();
  await page.locator('.inspect-window').filter({ has: page.locator('h2').filter({ hasText: /^other : Child$/ }) }).getByRole('button', { name: 'Close', exact: true }).last().click();
  await object(page, 'parent').click({ button: 'right' });
  await page.locator('.popup').getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(parentInspector).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { compileTransitions?: boolean[] }).compileTransitions)).toEqual([]);

  await evaluate(page, 'val slow = Slow(Child())');
  await evaluate(page, 'slow');
  await adoptLast(page, 'slow');
  await object(page, 'slow').dblclick();
  const slowInspector = page.getByRole('dialog', { name: 'Object inspector', exact: true }).filter({ hasText: 'slow : Slow' });
  await expect(slowInspector).toBeVisible();
  await expect(page.getByLabel('Program active', { exact: true })).toBeVisible();
  await slowInspector.getByRole('button', { name: 'Open referenced object child' }).click();
  await expect(page.locator('.inspect-window h2').filter({ hasText: /^child : Child$/ })).toBeVisible();
});

test('GUI-92 inspector shows property exceptions and continues with values and null', async ({ page }) => {
  await load(page);
  await evaluate(page, 'val faulty = Faulty(); faulty');
  await adoptLast(page, 'faulty');
  await object(page, 'faulty').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector', exact: true });
  const output = (name: string) => inspector.locator('.inspect-row').filter({ hasText: `${name} :` }).locator('output, .inspect-error-value');
  await expect(output('bad')).toHaveText('IllegalStateException: No world');
  await expect(output('bad')).toHaveCSS('white-space', 'nowrap');
  await expect(output('bad')).toHaveCSS('text-overflow', 'ellipsis');
  await output('bad').hover();
  await expect(output('bad')).toHaveAttribute('title', 'IllegalStateException: No world');
  await output('bad').click();
  const message = page.getByRole('dialog', { name: 'Property error: bad', exact: true });
  await expect(message).toContainText('IllegalStateException: No world');
  await message.getByRole('button', { name: 'Close', exact: true }).click();
  await output('bad').focus();
  await page.keyboard.press('Enter');
  await expect(message).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(message).toHaveCount(0);
  await output('bad').focus();
  await page.keyboard.press('Space');
  await expect(message).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(message).toHaveCount(0);
  await expect(inspector).toBeVisible();
  await expect(output('good')).toHaveText('10');
  await expect(output('absent')).toHaveText('null');
  await expect(inspector).not.toContainText('<computed>');
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await evaluate(page, 'faulty.n = 3');
  await expect(output('good')).toHaveText('30');
  await expect(output('bad')).toHaveText('IllegalStateException: No world');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByLabel('Dark mode', { exact: true }).check();
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(output('bad')).toHaveCSS('color', await output('good').evaluate(element => getComputedStyle(element).color));
  await page.screenshot({ path: '/tmp/bluek-inspector-errors-dark.png' });
  await inspector.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Codepad input').fill('faulty.bad');
  await page.getByLabel('Codepad input').press('Enter');
  await expect(page.locator('.codepad-entry').last().locator('.codepad-error')).toContainText('IllegalStateException: No world');
});

test('GUI-92 detached Actor shows world getter errors and recovers after attachment', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, library: { id: 'blueplay', version: 1 }, files: [] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await evaluate(page, 'val actor = Actor(); actor');
  await adoptLast(page, 'actor');
  await object(page, 'actor').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector', exact: true });
  const row = (name: string) => inspector.locator('.inspect-row').filter({ hasText: `${name} :` });
  await expect(row('world').locator('span').first()).toHaveText('world : World');
  for (const name of ['world', 'isAtEdge', 'isClicked']) await expect(row(name).getByRole('button', { name: `Show error for ${name}` })).toContainText('IllegalStateException: The actor is not in a world');
  await expect(row('x').locator('output')).toHaveText('0');
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  expect(await inspector.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const failure = row('world').getByRole('button', { name: 'Show error for world' });
  await expect(failure).toHaveCSS('white-space', 'nowrap');
  await expect(failure).toHaveCSS('text-overflow', 'ellipsis');
  expect(await failure.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect(row('world').locator('.inspect-value')).toHaveCSS('grid-column-start', '2');
  await expect(failure).toHaveCSS('color', await row('x').locator('output').evaluate(element => getComputedStyle(element).color));
  await failure.click();
  const message = page.getByRole('dialog', { name: 'Property error: world', exact: true });
  await expect(message).toContainText('IllegalStateException: The actor is not in a world (add it with addObject first).');
  await message.getByRole('button', { name: 'Close', exact: true }).click();
  await page.screenshot({ path: '/tmp/bluek-inspector-errors.png' });
  await evaluate(page, 'val habitat = World(10,10,1); habitat.addObject(actor, 0,0)');
  await expect(row('world').getByRole('button', { name: 'Open referenced object world' })).toBeVisible();
  await expect(row('isAtEdge').locator('output')).toHaveText('true');
  await expect(row('isClicked').locator('output')).toHaveText('false');
  await evaluate(page, 'habitat.removeObject(actor)');
  await expect(row('world').getByRole('button', { name: 'Show error for world' })).toContainText('IllegalStateException: The actor is not in a world');
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await evaluate(page, 'habitat.addObject(actor, 0,0)');
  await row('world').getByRole('button', { name: 'Open referenced object world' }).click();
  await expect(page.locator('.inspect-window h2').filter({ hasText: /^world : World$/ })).toBeVisible();
});
