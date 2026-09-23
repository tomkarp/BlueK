import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect, webkit, type Page, type TestInfo } from '@playwright/test';
import { createExportedProgram, embedProgram, PUBLIC_BLUEK_URL } from '../../frontend/src/programExport';
import { parseProject } from '../../frontend/src/projectFormat';

// The exported player is a single HTML file opened from disk. These tests fill
// the built template the way the IDE does and open the result via file://.
const templatePath = path.resolve('frontend/public/player/bluek-player.html');
type Files = { fileName: string; source: string; kind?: 'class' | 'functions' }[];

async function exportFile(testInfo: TestInfo, name: string, files: Files, mainFile: string,
  extra: Record<string, unknown> = {}, blueKUrl = PUBLIC_BLUEK_URL) {
  const project = parseProject({ format: 'bluek-project', version: 1, files: files.map(file => ({ kind: 'functions', ...file })), ...extra });
  const html = embedProgram(await readFile(templatePath, 'utf8'), createExportedProgram(project, mainFile, blueKUrl));
  const file = testInfo.outputPath(`${name}.html`);
  await writeFile(file, html);
  return pathToFileURL(file).href;
}

async function openPlayer(page: Page, url: string) {
  const requests: string[] = [];
  page.on('request', request => {
    if (!/^(file|blob|data):/.test(request.url())) requests.push(request.url());
  });
  await page.goto(url);
  return requests;
}

const greeter: Files = [
  { fileName: 'Greeter.kt', kind: 'class', source: 'class Greeter(val name: String) {\n    fun greet() = "Hello, " + name\n}\n' },
  { fileName: 'App.kt', source: 'fun main() {\n    println("Name?")\n    val name = readLine() ?: "nobody"\n    println(Greeter(name).greet())\n}\n' },
];

test('EXP-01 console program runs from file:// with input, restart and no network access', async ({ page }, testInfo) => {
  const requests = await openPlayer(page, await exportFile(testInfo, 'console', greeter, 'App.kt', { projectName: 'Begrüßung' }));
  await expect(page).toHaveTitle('Begrüßung');
  await expect(page.getByRole('heading', { name: 'Begrüßung' })).toBeVisible();
  const output = page.getByRole('region', { name: 'Terminal' }).locator('pre');
  const input = page.getByLabel('Program input');
  await expect(output).toHaveText('Name?\n');
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Waiting for input');
  await input.fill('Ada');
  await input.press('Enter');
  await expect(output).toHaveText('Name?\nAda\nHello, Ada\n');
  await expect(output.locator('.player-input-echo')).toHaveText('Ada');
  await expect(page.getByRole('status')).toHaveText('Finished');
  await expect(input).toBeDisabled();

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(output).toHaveText('Name?\n');
  await input.fill('Grace');
  await input.press('Enter');
  await expect(output).toHaveText('Name?\nGrace\nHello, Grace\n');
  expect(requests).toEqual([]);
});

test('EXP-02 the chosen main runs, not the first file with main', async ({ page }, testInfo) => {
  await openPlayer(page, await exportFile(testInfo, 'mains', [
    { fileName: 'Main.kt', source: 'fun main() { println("Main.kt") }' },
    { fileName: 'Second.kt', source: 'fun main() { println("Second.kt") }' },
  ], 'Second.kt'));
  await expect(page.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('Second.kt\n');
});

test('EXP-03 compile errors, a missing main and runtime errors are shown instead of output', async ({ page }, testInfo) => {
  await openPlayer(page, await exportFile(testInfo, 'compile-error', [{ fileName: 'App.kt', source: 'fun main() {\n    val x: Int = "text"\n}\n' }], 'App.kt'));
  const compile = page.getByRole('alert', { name: 'Compile errors' });
  await expect(compile).toContainText('The program could not be compiled.');
  await expect(compile).toContainText('App.kt:2:');
  await expect(page.getByRole('status')).toHaveText('Compile error');

  await openPlayer(page, await exportFile(testInfo, 'no-main', [
    { fileName: 'App.kt', source: 'fun helper() {}' },
    { fileName: 'Other.kt', source: 'fun main() { println("other") }' },
  ], 'App.kt'));
  await expect(page.getByRole('alert', { name: 'Error' })).toContainText('App.kt has no parameterless main().');
  await expect(page.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('');

  await openPlayer(page, await exportFile(testInfo, 'runtime-error', [
    { fileName: 'App.kt', source: 'fun main() {\n    println("before")\n    val items = listOf(1)\n    println(items[5])\n}\n' },
  ], 'App.kt'));
  await expect(page.getByRole('alert', { name: 'Error' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('before\n');
});

test('EXP-04 the project can be downloaded as .bluek.json and opened in BlueK by link', async ({ page, context, baseURL }, testInfo) => {
  const url = await exportFile(testInfo, 'links', greeter, 'App.kt', { projectName: 'Hunde: 1/2', readme: '# Hunde' }, baseURL + '/');
  await openPlayer(page, url);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download project (.bluek.json)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Hunde- 1-2.bluek.json');
  const saved = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(saved).toEqual({ format: 'bluek-project', version: 1, projectName: 'Hunde: 1/2', readme: '# Hunde',
    files: greeter.map(file => ({ kind: 'functions', ...file })) });

  const open = page.getByRole('link', { name: 'Open in BlueK' });
  await expect(open).toHaveAttribute('href', new RegExp(`^${baseURL}/#bluek=d1\\.`));
  await expect(open).toHaveAttribute('target', '_blank');
  const [blueK] = await Promise.all([context.waitForEvent('page'), open.click()]);
  await expect(blueK.getByLabel('Project name')).toHaveValue('Hunde: 1/2');
  await expect(blueK.locator('.classcard[aria-label="Greeter"]')).toBeVisible();
  await expect(blueK.locator('.classcard[aria-label="App"]')).toBeVisible();
});

test('EXP-05 a project too large for a link offers only the download', async ({ page }, testInfo) => {
  // Random data does not compress, so the link would exceed the 1 MB limit.
  const data = 'data:audio/wav;base64,' + randomBytes(900_000).toString('base64');
  await openPlayer(page, await exportFile(testInfo, 'large', greeter, 'App.kt', { resources: [{ path: 'sounds/noise.wav', data }] }));
  await expect(page.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('Name?\n');
  await expect(page.getByText('Too large for a link: download the project and open it in BlueK.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in BlueK' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download project (.bluek.json)' })).toBeVisible();
});

const rocketGame: Files = [
  { fileName: 'Rocket.kt', kind: 'class', source: `class Rocket : Actor() {
    init {
        val picture = Image(20, 20)
        picture.setColor(200, 0, 0)
        picture.fillRect(0, 0, 20, 20)
        setImage(picture)
    }
    override fun act() {
        if (isKeyDown("right")) move(5)
        if (isClicked) println("clicked")
        println("x=$x")
    }
}
` },
  { fileName: 'Game.kt', source: 'fun main() {\n    println("start")\n    val world = World(200, 100)\n    world.addObject(Rocket(), 50, 50)\n    showWorld(world)\n}\n' },
];

async function redPixels(page: Page) {
  return page.getByRole('button', { name: 'BluePlay world' }).evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 0; index < data.length; index += 4)
      if (data[index] > 150 && data[index + 1] < 60 && data[index + 2] < 60) count += 1;
    return count;
  });
}

test('EXP-06 BluePlay program shows its world and reacts to Step, keys, clicks, Run, Pause and Reset', async ({ page }, testInfo) => {
  const requests = await openPlayer(page, await exportFile(testInfo, 'blueplay', rocketGame, 'Game.kt', { library: { id: 'blueplay', version: 1 } }));
  const world = page.getByRole('button', { name: 'BluePlay world' });
  const output = page.getByRole('region', { name: 'Terminal' }).locator('pre');
  await expect(world).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Paused');
  await expect(output).toHaveText('start\n');
  await expect.poll(() => redPixels(page)).toBeGreaterThan(100);

  const controls = page.getByLabel('BluePlay controls');
  await controls.getByRole('button', { name: 'Step' }).click();
  await expect(output).toHaveText('start\nx=50\n');

  await world.focus();
  await page.keyboard.down('ArrowRight');
  await controls.getByRole('button', { name: 'Step' }).click();
  await expect(output).toHaveText('start\nx=50\nx=55\n');
  // The key was pressed on the world and is released while a button has focus.
  await page.keyboard.up('ArrowRight');
  await controls.getByRole('button', { name: 'Step' }).click();
  await expect(output).toHaveText('start\nx=50\nx=55\nx=55\n');

  const box = (await world.boundingBox())!;
  await page.mouse.click(box.x + box.width * (55.5 / 200), box.y + box.height * (50.5 / 100));
  await controls.getByRole('button', { name: 'Step' }).click();
  await expect(output).toContainText('clicked\nx=55\n');

  await controls.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('status')).toHaveText('Running');
  await expect(controls.getByRole('button', { name: 'Reset' })).toBeDisabled();
  await expect.poll(async () => (await output.textContent())!.split('x=').length).toBeGreaterThan(10);
  await controls.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('status')).toHaveText('Paused');

  await controls.getByRole('button', { name: 'Reset' }).click();
  await expect(output).toHaveText('start\n');
  await controls.getByRole('button', { name: 'Step' }).click();
  await expect(output).toHaveText('start\nx=50\n');
  expect(requests).toEqual([]);
});

test('EXP-07 the player runs console and BluePlay programs in WebKit', async ({}, testInfo) => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage();
    await openPlayer(page, await exportFile(testInfo, 'webkit-console', greeter, 'App.kt'));
    await page.getByLabel('Program input').fill('Ada');
    await page.getByLabel('Program input').press('Enter');
    await expect(page.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('Name?\nAda\nHello, Ada\n');

    await openPlayer(page, await exportFile(testInfo, 'webkit-blueplay', rocketGame, 'Game.kt', { library: { id: 'blueplay', version: 1 } }));
    await expect.poll(() => redPixels(page)).toBeGreaterThan(100);
    await page.getByLabel('BluePlay controls').getByRole('button', { name: 'Step' }).click();
    await expect(page.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('start\nx=50\n');
  } finally {
    await browser.close();
  }
});
