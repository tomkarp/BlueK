import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { test, expect, type Download, type Page, type TestInfo } from '@playwright/test';
import { PROGRAM_ELEMENT_ID, PUBLIC_BLUEK_URL, parseEmbeddedProgram } from '../../frontend/src/programExport';

type Files = { fileName: string; source: string; kind?: 'class' | 'functions' }[];

async function project(page: Page, files: Files, extra: Record<string, unknown> = {}) {
  const payload = { format: 'bluek-project', version: 1, files: files.map(file => ({ kind: 'functions', ...file })), ...extra };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
}

function exportButton(page: Page) {
  return page.getByRole('dialog', { name: 'Save / Export' }).getByRole('button', { name: /Export as HTML/ });
}

// Saved under its suggested name: a file without .html would open as text.
async function openExportedFile(page: Page, download: Download, testInfo: TestInfo) {
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const html = await readFile(file, 'utf8');
  const text = html.match(new RegExp(`<script type="application/json" id="${PROGRAM_ELEMENT_ID}">(.*?)</script>`, 's'))![1];
  const player = await page.context().newPage();
  await player.goto(pathToFileURL(file).href);
  return { program: parseEmbeddedProgram(text), player };
}

const greeter: Files = [
  { fileName: 'Greeter.kt', kind: 'class', source: 'class Greeter(val name: String) {\n    fun greet() = "Hello, " + name\n}\n' },
  { fileName: 'App.kt', source: 'fun main() {\n    println("Name?")\n    val name = readLine() ?: "nobody"\n    println(Greeter(name).greet())\n}\n' },
];

test('EXP-08 Export as HTML compiles on demand, asks for a name and downloads a runnable file', async ({ page }, testInfo) => {
  await project(page, greeter);
  await page.getByRole('button', { name: 'Save / Export' }).click();
  const button = exportButton(page);
  await expect(button).toContainText('Export as HTML (Beta)');
  await expect(button).toContainText('A single web page that runs the program, without BlueK.');
  page.once('dialog', dialog => dialog.accept('Grüße an alle'));
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  expect(download.suggestedFilename()).toBe('Grüße an alle.html');
  await expect(page.getByLabel('Project name')).toHaveValue('Grüße an alle');

  const { program, player } = await openExportedFile(page, download, testInfo);
  expect(program.mainFile).toBe('App.kt');
  expect(program.blueKUrl).toBe(PUBLIC_BLUEK_URL);
  expect(program.project.projectName).toBe('Grüße an alle');
  expect(program.project.files.map(file => file.fileName)).toEqual(['Greeter.kt', 'App.kt']);
  await expect(player).toHaveTitle('Grüße an alle');
  const output = player.getByRole('region', { name: 'Terminal' }).locator('pre');
  await expect(output).toHaveText('Name?\n');
  await player.getByLabel('Program input').fill('Ada');
  await player.getByLabel('Program input').press('Enter');
  await expect(output).toHaveText('Name?\nAda\nHello, Ada\n');
});

test('EXP-09 with several mains the export asks which one to start and Cancel downloads nothing', async ({ page }, testInfo) => {
  await project(page, [
    { fileName: 'Main.kt', source: 'fun main() { println("Main.kt") }' },
    { fileName: 'Second.kt', source: 'fun main() { println("Second.kt") }' },
  ], { projectName: 'Zwei' });
  const downloads: Download[] = [];
  page.on('download', download => downloads.push(download));
  const chooser = page.getByRole('dialog', { name: 'Choose main', exact: true });

  await page.getByRole('button', { name: 'Save / Export' }).click();
  await exportButton(page).click();
  await expect(chooser).toContainText('Which main() should the exported HTML file start?');
  await expect(chooser.getByRole('button', { name: /\.kt — main\(\)/ })).toHaveCount(2);
  await chooser.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(chooser).toBeHidden();
  await page.waitForTimeout(300);
  expect(downloads).toHaveLength(0);

  await page.getByRole('button', { name: 'Save / Export' }).click();
  await exportButton(page).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    chooser.getByRole('button', { name: 'Second.kt — main()', exact: true }).click(),
  ]);
  const { program, player } = await openExportedFile(page, download, testInfo);
  expect(program.mainFile).toBe('Second.kt');
  await expect(player.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('Second.kt\n');
});

test('EXP-10 a project without main cannot be exported and compile errors stop the export', async ({ page }, testInfo) => {
  await project(page, [{ fileName: 'Tools.kt', source: 'fun helper() = 1' }], { projectName: 'Ohne main' });
  const downloads: Download[] = [];
  page.on('download', download => downloads.push(download));
  await page.getByRole('button', { name: 'Save / Export' }).click();
  await exportButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: 'Export as HTML needs a file with a parameterless main().' })).toBeVisible();
  await page.getByRole('button', { name: 'Save / Export' }).click();
  await expect(exportButton(page)).toBeDisabled();
  await expect(exportButton(page)).toContainText('Needs a file with a parameterless main().');
  await page.getByRole('dialog', { name: 'Save / Export' }).getByRole('button', { name: 'Cancel' }).click();

  await project(page, [{ fileName: 'App.kt', source: 'fun main() {\n    val x: Int = "text"\n}\n' }], { projectName: 'Fehler' });
  // Only the hash changed, which is no new visit — a reload is one.
  await page.reload();
  await expect(page.getByLabel('Project name')).toHaveValue('Fehler');
  await page.getByRole('button', { name: 'Save / Export' }).click();
  await exportButton(page).click();
  // As with Compile, the file opens with its error marked; nothing is downloaded.
  await expect(page.getByRole('dialog', { name: 'App.kt' }).getByText(/Line 2: TypeMismatchException/)).toBeVisible();
  await page.waitForTimeout(300);
  expect(downloads).toHaveLength(0);
});

test('EXP-11 a BluePlay project exported from the IDE shows its world', async ({ page }, testInfo) => {
  await project(page, [{ fileName: 'Spiel.kt', source: 'fun main() {\n    println("Spiel")\n    showWorld(World(160, 80))\n}\n' }],
    { projectName: 'Spiel', library: { id: 'blueplay', version: 1 } });
  await page.getByRole('button', { name: 'Save / Export' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()]);
  expect(download.suggestedFilename()).toBe('Spiel.html');
  const { program, player } = await openExportedFile(page, download, testInfo);
  expect(program.project.library).toEqual({ id: 'blueplay', version: 1 });
  await expect(player.getByRole('button', { name: 'BluePlay world' })).toBeVisible();
  await expect(player.getByRole('status')).toHaveText('Paused');
  await expect(player.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('Spiel\n');
});
