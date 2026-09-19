import { test, expect, type Page } from '@playwright/test';

async function load(page: Page, source: string, kind: 'class' | 'functions' = 'class') {
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Timer.kt', kind, source }] };
  await page.goto((process.env.BLUEK_GUI_URL || '/') + '#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
}

async function watchDialogs(page: Page) {
  // The object-name dialog is required by GUI-02. This test observes only
  // method argument dialogs, which are the dialogs relevant to GUI-47.
  await page.evaluate(() => {
    document.body.dataset.methodDialogInsertions = '0';
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches('.method-dialog') ||
          node.querySelector('.method-dialog'))) {
          document.body.dataset.methodDialogInsertions = String(Number(document.body.dataset.methodDialogInsertions) + 1);
        }
      }
    }).observe(document.body, { subtree: true, childList: true });
  });
}

async function checkActivity(page: Page) {
  const bar = page.getByRole('progressbar', { name: 'Program active', exact: true });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('aria-busy', 'true');
  const indicator = bar.locator('.activity-indicator');
  await expect(indicator).toBeVisible();
  const box = (await indicator.boundingBox())!;
  const track = (await bar.boundingBox())!;
  expect(box.height).toBeGreaterThan(10);
  expect(box.x).toBeGreaterThanOrEqual(track.x);
  expect(box.x + box.width).toBeLessThanOrEqual(track.x + track.width);
  await expect.poll(async () => Math.abs((await indicator.boundingBox())!.x - box.x)).toBeGreaterThan(8);
  await expect(indicator).toHaveCSS('animation-direction', 'alternate');
  await expect(indicator).toHaveCSS('animation-duration', '1s');
  await expect(page.locator('.method-dialog, .create-object-dialog')).toHaveCount(0);
}

for (const kind of ['constructor', 'method', 'function'] as const) {
  for (const withParameter of [false, true]) {
    test(`GUI-47 ${kind} ${withParameter ? 'closes after confirmation' : 'uses no parameter dialog'} and shows moving activity`, async ({ page }) => {
      const params = withParameter ? 'millis: Int' : '';
      const body = `Thread.sleep(${withParameter ? 'millis' : '2000'}); println("done")`;
      const source = kind === 'constructor' ? `class Timer(${params}) { init { ${body} } }`
        : kind === 'method' ? `class Timer { fun starten(${params}) { ${body} } }`
        : `fun starten(${params}) { ${body} }`;
      await load(page, source, kind === 'function' ? 'functions' : 'class');
      if (kind === 'method') {
        await page.locator('.classcard').click({ button: 'right' });
        await page.locator('.constructor-menu-item').click();
        await page.locator('.create-object-dialog').getByRole('button', { name: 'Create', exact: true }).click();
        await expect(page.locator('.bench .object')).toHaveCount(1);
      }
      await watchDialogs(page);
      await page.locator(kind === 'method' ? '.bench .object' : '.classcard').click({ button: 'right' });
      await page.locator('.popup').getByRole('button', { name: kind === 'constructor' ? /^Timer\(/ : /starten\(/ }).click();
      if (withParameter) {
        const dialog = page.locator(kind === 'constructor' ? '.create-object-dialog' : '.method-dialog');
        await expect(dialog).toBeVisible();
        await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
        await dialog.getByLabel('millis: Int', { exact: true }).fill('2000');
        await dialog.getByRole('button', { name: kind === 'constructor' ? 'Create' : 'Invoke', exact: true }).click();
      } else if (kind === 'constructor') {
        // Creating an object always requires its name confirmation, even when
        // the constructor itself has no parameters.
        await page.locator('.create-object-dialog').getByRole('button', { name: 'Create', exact: true }).click();
      }
      await checkActivity(page);
      if (kind === 'method' && !withParameter) {
        await page.screenshot({ path: test.info().outputPath('running-method.png') });
      }
      await expect(page.locator('.terminal-output pre')).toHaveText('done\n');
      await expect(page.getByRole('progressbar', { name: 'Ready', exact: true })).toBeVisible();
      await expect(page.locator('.activity-indicator')).toHaveCount(0);
      if (!withParameter) await expect(page.locator('body')).toHaveAttribute('data-method-dialog-insertions', '0');
      if (kind === 'constructor') await expect(page.locator('.bench .object')).toHaveCount(1);
    });
  }
}

test('GUI-47 failed argument is visible after Invoke closes; reset discards a pending call', async ({ page }) => {
  await load(page, 'class Timer { fun starten(millis: Int) { Thread.sleep(millis); println("stale") } }');
  await page.locator('.classcard').click({ button: 'right' });
  await page.locator('.constructor-menu-item').click();
  await page.locator('.create-object-dialog').getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('.bench .object')).toHaveCount(1);
  await page.locator('.bench .object').click({ button: 'right' });
  await page.locator('.method-menu-item').filter({ hasText: 'starten' }).click();
  await page.locator('.method-dialog input').fill('"wrong type"');
  await page.locator('.method-dialog').getByRole('button', { name: 'Invoke', exact: true }).click();
  await expect(page.locator('.method-dialog')).toHaveCount(0);
  const error = page.getByRole('dialog', { name: 'Compiler errors' });
  await expect(error).toBeVisible();
  await expect(error.locator('pre')).not.toBeEmpty();
  await error.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('.bench .object').click({ button: 'right' });
  await page.locator('.method-menu-item').filter({ hasText: 'starten' }).click();
  await page.locator('.method-dialog input').fill('1000');
  await page.locator('.method-dialog').getByRole('button', { name: 'Invoke', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Program active', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset runtime', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Ready', exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.activity-indicator')).toHaveCount(0);
  await expect(page.locator('.terminal-output pre')).toHaveCount(0);
});
