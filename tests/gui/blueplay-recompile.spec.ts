import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const project = JSON.parse(readFileSync(new URL('../fixtures/blueplay-recompile.bluek.json', import.meta.url), 'utf8')) as {
  files: { fileName: string; kind: string; source: string }[];
};

const worldSource = project.files[0].source;
const colorSource = worldSource.replace('setBackground("dog.png")', 'setBackground(20, 38, 77)');
const stageOf = (page: Page) => page.getByRole('dialog', { name: 'BluePlay – World', exact: true });
const terminal = (page: Page) => page.locator('.terminal-output pre');
const corner = (page: Page) => stageOf(page).locator('canvas').evaluate((canvas: HTMLCanvasElement) =>
  Array.from(canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data));

async function hideTerminal(page: Page) {
  const button = page.getByRole('button', { name: 'Hide terminal', exact: true });
  if (await button.count()) await button.click();
}
async function compile(page: Page) {
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await expect(stageOf(page)).toHaveCount(0);
}
async function startMain(page: Page) {
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(stageOf(page)).toBeVisible();
  await expect(stageOf(page)).toHaveAttribute('data-simulation', 'paused');
  await hideTerminal(page);
  // Keep class cards and the default editor's content visible beside the world.
  const bounds = (await stageOf(page).boundingBox())!;
  await page.mouse.move(bounds.x + 80, bounds.y + 15);
  await page.mouse.down();
  await page.mouse.move(880, 55, { steps: 4 });
  await page.mouse.up();
}
async function load(page: Page, trackWorld = false) {
  const payload = { ...project, files: [
    { ...project.files[0], source: colorSource }, project.files[1],
    trackWorld ? { ...project.files[2], source: 'var shown: Spielfeld? = null\nfun main() { println("MAIN"); val s = Spielfeld(); shown = s; s.show() }' } : project.files[2],
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await compile(page);
  await startMain(page);
  await expect.poll(() => corner(page)).toEqual([20, 38, 77, 255]);
}
async function edit(page: Page, source: string) {
  await hideTerminal(page);
  await page.getByRole('button', { name: 'Spielfeld', exact: true }).dblclick();
  const editor = page.locator('.editor-dialog');
  await editor.locator('.cm-content').fill(source);
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(stageOf(page)).toHaveAttribute('data-phase', 'uncompiled');
}
async function evaluate(page: Page, code: string) {
  const input = page.getByLabel('Codepad input', { exact: true });
  const entries = page.locator('.codepad-entry');
  const count = await entries.count();
  await input.fill(code);
  await input.press('Enter');
  await expect(entries).toHaveCount(count + 1);
  await expect(entries.last().locator('.codepad-error')).toHaveCount(0);
  return entries.last();
}

for (const running of [false, true]) {
  test(`GUI-143 Compile closes the old world and Start main loads the edited image (${running ? 'running' : 'paused'}, anonymous world)`, async ({ page }) => {
    await load(page);
    const stage = stageOf(page);
    if (running) {
      await stage.getByRole('button', { name: 'Run BluePlay world' }).click();
      await expect(stage).toHaveAttribute('data-simulation', 'running');
    }
    await edit(page, worldSource);
    await compile(page);
    // Compile executes no main and leaves no old world or controls to act on.
    await expect(page.locator('.object')).toHaveCount(0);
    await startMain(page);
    await expect.poll(() => corner(page)).not.toEqual([20, 38, 77, 255]);
    // Check image rendering beyond its transparent corner, away from actors.
    await expect.poll(() => stage.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const rgba = canvas.getContext('2d')!.getImageData(200, 120, 200, 150).data;
      const colors = new Set<string>();
      for (let i = 0; i < rgba.length; i += 4) colors.add(`${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`);
      return colors.size;
    })).toBeGreaterThan(2);
    await stage.getByRole('button', { name: 'Run BluePlay world' }).click();
    await expect(stage).toHaveAttribute('data-simulation', 'running');
    if (!running) {
      await stage.getByRole('button', { name: 'Pause BluePlay world' }).click();
      await expect(stage).toHaveAttribute('data-simulation', 'paused');
    }
    // Compile replaces the session even when the source has not changed.
    await compile(page);
    await startMain(page);
    await stage.getByRole('button', { name: 'Act once' }).click();
    await expect(stage).toHaveAttribute('data-simulation', 'paused');
    await stage.getByRole('button', { name: 'Reset BluePlay world' }).click();
    await expect(stage).toBeVisible();
    await expect(stage.getByRole('button', { name: 'Run BluePlay world' })).toBeEnabled();
  });
}

test('GUI-143 Codepad compile-on-demand clears the previous world without running main', async ({ page }) => {
  await load(page, true);
  await edit(page, worldSource);
  await expect(await evaluate(page, 'shown == null')).toContainText('true');
  await expect(stageOf(page)).toHaveCount(0);
  // Starting main is explicit, and Act still performs exactly one step.
  await startMain(page);
  await stageOf(page).getByRole('button', { name: 'Act once' }).click();
  await expect(await evaluate(page, 'shown!!.schritte')).toContainText('1');
});

test('GUI-143 failed compilation closes the stale world; successful compilation never starts main', async ({ page }) => {
  await load(page, true);
  await edit(page, 'class Spielfeld : World(600, 400, 1) { val wrong: Int = "text" }');
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.locator('.editor-diagnostics')).toBeVisible();
  await expect(stageOf(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeDisabled();
  const editor = page.locator('.editor-dialog');
  await editor.locator('.cm-content').fill(worldSource);
  await page.keyboard.press('Escape');
  await compile(page);
  await expect(await evaluate(page, 'shown == null')).toContainText('true');
  await startMain(page);
  await expect(await evaluate(page, 'shown!!.schritte')).toContainText('0');
});
