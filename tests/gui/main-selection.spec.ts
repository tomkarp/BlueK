import { test, expect, type Page } from '@playwright/test';

async function project(page: Page, files: { fileName: string; source: string; kind?: string }[], bluePlay = false) {
  const payload = { format: 'bluek-project', version: 1,
    ...(bluePlay ? { library: { id: 'blueplay', version: 1 } } : {}),
    files: files.map(file => ({ kind: 'functions', ...file })) };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Ready', exact: true })).toBeVisible();
}

test('RT-25 Start main runs the unique entry point outside Main.kt', async ({ page }) => {
  await project(page, [
    { fileName: 'Main.kt', source: 'fun helper() {}' },
    { fileName: 'Program.kt', source: 'fun main() { println("Program started") }' },
  ]);
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('Program started\n');
  await expect(page.getByRole('dialog', { name: 'Choose main', exact: true })).toHaveCount(0);
});

test('RT-25 Start main asks every time, allows cancellation and forgets the choice after reload', async ({ page }) => {
  await project(page, [
    { fileName: 'Program.kt', source: 'fun main() { println("Program") }' },
    { fileName: 'Main.kt', source: 'fun main() { println("Main") }' },
  ]);
  const start = page.getByRole('button', { name: 'Start main', exact: true });
  const chooser = page.getByRole('dialog', { name: 'Choose main', exact: true });
  await start.click();
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Program.kt — main()', exact: true })).toBeFocused();
  await chooser.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(chooser).toBeHidden();
  await expect(page.locator('.terminal-output pre')).toHaveCount(0);
  await start.click();
  await page.keyboard.press('Escape');
  await expect(chooser).toBeHidden();
  await start.click();
  await chooser.getByRole('button', { name: 'Program.kt — main()', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('Program\n');
  await start.click();
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button', { name: 'Main.kt — main()', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('Program\nMain\n');
  // Load the autosaved project (without the original share fragment).
  await page.goto('/');
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Ready', exact: true })).toBeVisible();
  await start.click();
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('button', { name: /\.kt — main\(\)/ })).toHaveCount(2);
});

test('RT-25 BluePlay Reset runs the unique main in an arbitrary file in the same session', async ({ page }) => {
  await project(page, [{ fileName: 'Spiel.kt', source:
    'var starts = 0\nfun main() { starts++; println("Spiel $starts"); World(200, 100, 1).show() }' }], true);
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const world = page.getByRole('dialog', { name: 'BluePlay – World', exact: true });
  await expect(world).toBeVisible();
  await expect(page.locator('.terminal-output pre')).toHaveText('Spiel 1\n');
  await world.getByRole('button', { name: 'Reset BluePlay world', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('Spiel 2\n');
  await expect(world).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Choose main', exact: true })).toHaveCount(0);
});

test('RT-25 BluePlay Reset asks every time and can change the selected main', async ({ page }) => {
  await project(page, [
    { fileName: 'Main.kt', source: 'var starts = 0\nfun main() { starts++; println("Main $starts"); World(200, 100, 1).show() }' },
    { fileName: 'Spiel.kt', source: 'fun main() { starts++; println("Spiel $starts"); World(240, 120, 1).show() }' },
  ], true);
  const chooser = page.getByRole('dialog', { name: 'Choose main', exact: true });
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await chooser.getByRole('button', { name: 'Spiel.kt — main()', exact: true }).click();
  const world = page.getByRole('dialog', { name: 'BluePlay – World', exact: true });
  await expect(world).toBeVisible();
  await expect(page.locator('.terminal-output pre')).toHaveText('Spiel 1\n');
  await world.getByRole('button', { name: 'Reset BluePlay world', exact: true }).click();
  await expect(chooser).toBeVisible();
  await expect(chooser).toContainText('Reset');
  await chooser.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(world).toBeVisible();
  await expect(page.locator('.terminal-output pre')).toHaveText('Spiel 1\n');
  await world.getByRole('button', { name: 'Reset BluePlay world', exact: true }).click();
  await chooser.getByRole('button', { name: 'Main.kt — main()', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('Main 2\n');
  await world.getByRole('button', { name: 'Reset BluePlay world', exact: true }).click();
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button', { name: 'Spiel.kt — main()', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('Spiel 3\n');
});

test('RT-25 member main is not a project entry point', async ({ page }) => {
  await project(page, [{ fileName: 'Runner.kt', kind: 'class', source: 'class Runner { fun main() {} }' }]);
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeDisabled();
});

test('RT-25 keyboard start asks again and recompiling discards an open choice', async ({ page }) => {
  await project(page, [
    { fileName: 'First.kt', source: 'fun main() { println("First") }' },
    { fileName: 'Second.kt', source: 'fun main() { println("Second") }' },
  ]);
  const chooser = page.getByRole('dialog', { name: 'Choose main', exact: true });
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(chooser).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(chooser).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await expect(page.locator('.terminal-output pre')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+Enter');
  await chooser.getByRole('button', { name: 'Second.kt — main()', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('Second\n');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(chooser).toBeVisible();
});
