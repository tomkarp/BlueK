import { test, expect, type Page } from '@playwright/test';

async function project(page: Page, source = '') {
  const payload = { format: 'bluek-project', version: 1, files: source
    ? [{ fileName: 'Hund.kt', kind: 'class', source }] : [] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
}

async function evaluate(page: Page, code: string) {
  const input = page.getByLabel('Codepad input');
  const entries = page.locator('.codepad-entry');
  const count = await entries.count();
  await input.fill(code);
  await input.press('Enter');
  await expect(entries).toHaveCount(count + 1);
  await expect(entries.last().locator('.codepad-error')).toHaveCount(0);
  return entries.last();
}

test('GUI-11 codepad works without Compile in an empty project', async ({ page }) => {
  await project(page);
  await evaluate(page, '1 + 2');
  await evaluate(page, 'val answer = 42');
  await evaluate(page, 'answer');
});

test('GUI-03 GUI-04 computed values update after every inspector edit', async ({ page }) => {
  await project(page, 'class Hund(var alter: Int = 1) { val steuer: Int get() = alter * 10 }');
  const entry = await evaluate(page, 'Hund()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  const computed = inspector.locator('.inspect-row').filter({ hasText: 'steuer :' }).locator('output');
  await expect(computed).toHaveText('10');
  for (const age of [2, 3, 7]) {
    await inspector.getByLabel('Edit alter', { exact: true }).click();
    await inspector.getByLabel('Value of alter').fill(String(age));
    await inspector.getByLabel('Value of alter').press('Enter');
    await expect(computed).toHaveText(String(age * 10));
  }
  await evaluate(page, 'hund1.alter = 9');
  await expect(computed).toHaveText('90');
});

test('GUI-07 every value can be placed on the bench', async ({ page }) => {
  await project(page);
  for (const [code, name, display] of [['5', 'zahl', '5 : Int'], ['"Hallo"', 'text', '"Hallo" : String']]) {
    const entry = await evaluate(page, code);
    await expect(entry.getByRole('button')).toBeEnabled();
    await expect(entry.getByRole('button')).toHaveText(display);
    await entry.getByRole('button').click();
    await page.getByLabel('Name of instance').fill(name);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.locator('.bench')).toContainText(name);
    const alias = await evaluate(page, name);
    await expect(alias.getByRole('button')).toHaveText(display);
  }
});

test('GUI-05 history works immediately after execution and terminal output', async ({ page }) => {
  await project(page);
  for (const code of ['5', 'println("Hallo")']) {
    await evaluate(page, code);
    const input = page.getByLabel('Codepad input');
    await expect(input).toBeFocused();
    await input.press('ArrowUp');
    await expect(input).toHaveValue(code);
  }
});

test('GUI-01 new project offers all templates and can be cancelled', async ({ page }) => {
  await project(page);
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Project' });
  const choices = ['Empty Project', 'Kotlin Example', 'BluePlay Template', 'BluePlay Example']
    .map(name => dialog.getByRole('button', { name: new RegExp('^' + name) }));
  for (const choice of choices) await expect(choice).toBeEnabled();
  const boxes = await Promise.all(choices.map(choice => choice.boundingBox()));
  for (let index = 1; index < boxes.length; index++) {
    expect(boxes[index]!.y).toBeGreaterThan(boxes[index - 1]!.y);
    expect(Math.abs(boxes[index]!.x - boxes[0]!.x)).toBeLessThan(2);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('GUI-17 Escape cancels constructor and method parameter dialogs', async ({ page }) => {
  await project(page, 'class Hund { fun laufen(weite: Int) {} }');
  await evaluate(page, '1');
  await page.locator('.classcard').click({ button: 'right' });
  await page.locator('.constructor-menu-item').click();
  await expect(page.getByRole('dialog', { name: 'Create Hund' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Create Hund' })).toBeHidden();

  const objectEntry = await evaluate(page, 'Hund()');
  await objectEntry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').click({ button: 'right' });
  await page.locator('.method-menu-item').first().click();
  const methodDialog = page.getByRole('dialog', { name: /hund1/ });
  await expect(methodDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(methodDialog).toBeHidden();
});

test('GUI-02 constructor suggests numbered names', async ({ page }) => {
  await project(page, 'class Hund {}');
  await evaluate(page, '1');
  for (const name of ['hund1', 'hund2']) {
    await page.locator('.classcard').click({ button: 'right' });
    await page.locator('.constructor-menu-item').click();
    const dialog = page.getByRole('dialog', { name: 'Create Hund' });
    await expect(dialog.getByLabel('Name of instance')).toHaveValue(name);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('.bench')).toContainText(name);
  }
});

for (const name of ['Empty Project', 'Kotlin Example', 'BluePlay Template', 'BluePlay Example']) {
  test(`GUI-01 creates ${name}`, async ({ page }) => {
    await project(page);
    await page.getByRole('button', { name: 'New Project', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create New Project' });
    await dialog.getByRole('button', { name: new RegExp('^' + name) }).click();
    await expect(dialog).toBeHidden();
    if (name === 'Empty Project') await expect(page.locator('.classcard')).toHaveCount(0);
    else await expect(page.locator('.classcard').first()).toBeVisible();
  });
}

test('GUI-09 bench splitter follows first drag without jumping', async ({ page }) => {
  await project(page);
  const splitter = page.getByRole('separator', { name: 'Resize object bench and codepad' });
  for (const delta of [35, -20]) {
    const before = (await splitter.boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + delta, before.y + before.height / 2, { steps: 5 });
    await page.mouse.up();
    const after = (await splitter.boundingBox())!;
    expect(Math.abs(after.x - before.x - delta)).toBeLessThan(3);
  }
});

test('GUI-06 terminal splitter spans viewport and resizes both panels', async ({ page }) => {
  await project(page);
  await page.getByLabel('Show terminal', { exact: true }).click();
  await page.getByLabel('Split terminal to the right').click();
  const splitter = page.locator('.terminal-split-divider');
  const before = (await splitter.boundingBox())!;
  expect(before.y).toBe(0);
  expect(before.height).toBe(page.viewportSize()!.height);
  const terminalBefore = (await page.locator('.terminal-window').boundingBox())!;
  const benchBefore = (await page.locator('.lower').boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, 40);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 - 40, 40, { steps: 5 });
  await page.mouse.up();
  const terminalAfter = (await page.locator('.terminal-window').boundingBox())!;
  const benchAfter = (await page.locator('.lower').boundingBox())!;
  expect(Math.abs(terminalAfter.width - terminalBefore.width - 40)).toBeLessThan(3);
  expect(Math.abs(benchAfter.width - benchBefore.width + 40)).toBeLessThan(3);
});

test('GUI-08 GUI-10 editor renames files even after empty content', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  const dialog = page.locator('.editor-dialog');
  const editor = dialog.locator('.cm-content');
  await editor.fill('class Tier {}');
  await expect(dialog.locator('h3')).toHaveText('Tier.kt');
  await editor.fill('');
  await editor.fill('class Katze {}');
  await expect(dialog.locator('h3')).toHaveText('Katze.kt');
  const bounds = (await dialog.boundingBox())!;
  const close = (await dialog.getByRole('button', { name: 'Close' }).boundingBox())!;
  expect(bounds.y + bounds.height - close.y - close.height).toBeLessThan(50);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.classcard')).toHaveAttribute('aria-label', 'Katze');
  await evaluate(page, 'Katze()');
});

test('GUI-12 GUI-13 GUI-15 input echo order and clearing preserve the app', async ({ page }) => {
  await project(page);
  const code = 'println("A"); val x = readln(); println("B"); println(x)';
  await page.getByLabel('Codepad input').fill(code);
  await page.getByLabel('Codepad input').press('Enter');
  const terminal = page.locator('.terminal-window');
  const input = terminal.locator('input');
  await expect(input).toBeEnabled();
  await expect(terminal.locator('pre')).toHaveText('A\n');
  await input.fill('Test');
  await input.press('Enter');
  await expect(terminal.locator('pre')).toHaveText('A\nTest\nB\nTest\n');
  await expect(terminal.locator('.terminal-input-echo')).toHaveText('Test');
  await expect(input).toBeDisabled();
  await expect(terminal.locator('.terminal-notice')).toHaveCount(0);
  await terminal.getByLabel('Clear terminal').click();
  await expect(terminal.locator('pre')).toHaveText('');
  await expect(page.getByRole('button', { name: 'New Project', exact: true })).toBeVisible();
  await evaluate(page, 'println("after")');
  await expect(terminal.locator('pre')).toHaveText('after\n');
  await evaluate(page, 'println("\\u000C")');
  await expect(terminal.locator('pre')).not.toContainText('after');
});

test('GUI-16 media remains disabled', async ({ page }) => {
  await project(page);
  await expect(page.locator('.media-disabled')).toHaveAttribute('title', 'Not yet supported');
  await expect(page.locator('.media-disabled input')).toBeDisabled();
});

test('GUI-14 output is visible before a long loop finishes', async ({ page }) => {
  await project(page);
  await page.getByLabel('Codepad input').fill('var i = 0; while (i < 100000000) { println(i); i++ }');
  await page.getByLabel('Codepad input').press('Enter');
  await expect(page.locator('.terminal-output pre')).toContainText('0\n');
  await expect(page.getByLabel('Codepad input')).toBeDisabled();
  await expect(page.locator('.codepad-entry')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset runtime', exact: true }).click();
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
});
