import { test, expect, type Page } from '@playwright/test';
import { createExportedProgram, parseEmbeddedProgram } from '../../frontend/src/programExport';
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import type { SavedProject } from '../../frontend/src/projectFormat';
import { pathToFileURL } from 'node:url';

const project = {
  format: 'bluek-project' as const, version: 1 as const, projectName: 'Shared program',
  files: [{ fileName: 'App.kt', kind: 'functions' as const, source: 'fun main() { println("Name?"); println("Hello, " + readln()) }' }],
};
const game = {
  ...project, projectName: 'Shared game', library: { id: 'blueplay' as const, version: 1 as const },
  files: [
    { fileName: 'Game.kt', kind: 'class' as const, source: 'class Game : World(160, 80, 1) { var acted = false; override fun act() { if (!acted) { println("tick"); acted = true } } }' },
    { fileName: 'App.kt', kind: 'functions' as const, source: 'fun main() { Game().show() }' },
  ],
};

async function editor(page: Page, payload: SavedProject = project) {
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Project name')).toHaveValue(payload.projectName);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => { (window as unknown as { copied: string }).copied = value; },
    } });
  });
}
async function options(page: Page) {
  await page.getByRole('button', { name: 'Save / Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Save / Export', exact: true });
  await dialog.getByRole('button', { name: 'Runnable program', exact: true }).click();
  return dialog;
}
async function copied(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as { copied: string }).copied)).toMatch(/\/(?:#run=|run\/)/);
  return page.evaluate(() => (window as unknown as { copied: string }).copied);
}

test('EXP-13 full program link starts chosen main without the IDE, supports input, download and developer view', async ({ page, context }) => {
  await editor(page, { ...project, files: [
    { fileName: 'Other.kt', kind: 'functions', source: 'fun main() { println("Wrong main") }' }, ...project.files,
  ] });
  const dialog = await options(page);
  await expect(dialog.getByLabel('Start game automatically')).toHaveCount(0);
  await dialog.getByRole('button', { name: /^Copy Full Program Link/ }).click();
  const chooser = page.getByRole('dialog', { name: 'Choose main', exact: true });
  await expect(chooser).toContainText('Which main() should the program link start?');
  await chooser.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { copied?: string }).copied)).toBeUndefined();
  await options(page);
  await page.getByRole('button', { name: /^Copy Full Program Link/ }).click();
  await chooser.getByRole('button', { name: 'App.kt — main()', exact: true }).click();
  const link = await copied(page);
  const player = await context.newPage();
  await player.goto(link);
  const terminal = player.getByRole('region', { name: 'Terminal' }).locator('pre');
  await expect(terminal).toHaveText('Name?\n');
  await expect(player.locator('.classcard, .bench, .codepad')).toHaveCount(0);
  await player.getByLabel('Program input').fill('Ada');
  await player.getByLabel('Program input').press('Enter');
  await expect(terminal).toHaveText('Name?\nAda\nHello, Ada\n');
  const [download] = await Promise.all([player.waitForEvent('download'), player.getByRole('button', { name: 'Download project (.bluek.json)' }).click()]);
  expect(download.suggestedFilename()).toBe('Shared program.bluek.json');
  const developer = await context.newPage();
  await developer.goto(await player.getByRole('link', { name: 'Open in BlueK' }).getAttribute('href') as string);
  await expect(developer.getByLabel('Project name')).toHaveValue(project.projectName);
  await expect(developer.locator('.classcard')).toHaveCount(2);
});

test('EXP-18 app-base program links load only the player and switch to the IDE in the same tab', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  const program = createExportedProgram(project, 'App.kt', 'http://127.0.0.1:5194/');
  await page.goto('/#run=p1.' + Buffer.from(JSON.stringify(program)).toString('base64url'));
  await expect(page.getByLabel('Program input')).toBeEnabled();
  expect(requests.some(url => /svelte-main|SvelteApp|workspace\//.test(url))).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('bluek.project-draft.v1.')))).toEqual([]);

  // Both links have the same document URL: hash navigation must select the UI again.
  const developerUrl = await page.getByRole('link', { name: 'Open in BlueK' }).getAttribute('href');
  await page.evaluate(url => { window.location.href = url; }, developerUrl!);
  await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
  await expect(page.locator('.player')).toHaveCount(0);
  await page.evaluate(hash => { window.location.hash = hash; }, '#run=p1.' + Buffer.from(JSON.stringify(program)).toString('base64url'));
  await expect(page.getByLabel('Program input')).toBeEnabled();
  await expect(page.locator('.classcard, .bench, .codepad')).toHaveCount(0);
});

test('EXP-18 project short links load and the original full project format remains readable', async ({ page }) => {
  await page.route('**/api/projects/green-lamp-river', route => route.fulfill({ json: { project } }));
  await page.goto('/bluek/green-lamp-river');
  await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  const program = createExportedProgram(project, 'App.kt', 'http://127.0.0.1:5194/');
  await page.goto('/#run=p1.' + Buffer.from(JSON.stringify(program)).toString('base64url'));
  await expect(page.getByLabel('Program input')).toBeEnabled();
  await expect(page.locator('.classcard, .bench, .codepad')).toHaveCount(0);
});

test('EXP-18 invalid app-base program links report an error without opening the IDE', async ({ page }) => {
  await page.goto('/#run=p1.' + Buffer.from('{}').toString('base64url'));
  await expect(page.getByRole('alert')).toContainText('This program cannot be started.');
  await expect(page.getByRole('alert')).toContainText('Invalid BlueK program.');
  await expect(page.locator('.classcard, .bench, .codepad')).toHaveCount(0);
  // An undecodable link names the program link, not a project link.
  await page.goto('/#run=garbage');
  await expect(page.getByRole('alert')).toContainText('Invalid BlueK program link.');
  await expect(page.getByRole('link', { name: 'Open BlueK' })).toHaveAttribute('href', 'http://127.0.0.1:5194/');
});

test('EXP-19 a project code opened as a program offers its project; capitalized codes play', async ({ page }) => {
  await page.route('**/api/programs/green-lamp-river', route => route.fulfill({ status: 409, json: { error: 'This code belongs to an editable BlueK project, not to a runnable program.' } }));
  await page.route('**/api/projects/green-lamp-river', route => route.fulfill({ json: { project } }));
  await page.goto('/run/green-lamp-river');
  await expect(page.getByRole('alert')).toContainText('This code belongs to an editable BlueK project, not to a runnable program.');
  await expect(page.getByRole('alert')).not.toContainText('30 days');
  await page.getByRole('link', { name: 'Open in BlueK' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
  await expect(page).toHaveURL('http://127.0.0.1:5194/');

  const program = createExportedProgram(project, 'App.kt', 'http://127.0.0.1:5194/');
  await page.route('**/api/programs/fresh-book-apple', route => route.fulfill({ json: { program } }));
  await page.goto('/run/Fresh-Book-Apple');
  await expect(page.getByLabel('Program input')).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Open in BlueK' })).toHaveAttribute('href', 'http://127.0.0.1:5194/bluek/fresh-book-apple');
});

test('EXP-14 short program link stores options, opens the developer project through its short code and reports expiry', async ({ page, context }) => {
  let stored: unknown;
  await context.route('**/api/programs', async route => {
    stored = route.request().postDataJSON();
    await route.fulfill({ json: { code: 'green-lamp-river', expiresAt: '2026-11-09T00:00:00Z' }, status: 201 });
  });
  await context.route('**/api/programs/green-lamp-river', route => route.fulfill({ json: { program: stored } }));
  // The service answers a runnable export's code with its project for "Open in BlueK".
  await context.route('**/api/projects/green-lamp-river', route => route.fulfill({ json: { project: (stored as { project: unknown }).project } }));
  await editor(page);
  const dialog = await options(page);
  await dialog.getByLabel('Allow source download').uncheck();
  await dialog.getByLabel('Show project name').uncheck();
  await dialog.getByRole('button', { name: /^Copy Short Program Link/ }).click();
  const ready = page.getByRole('dialog', { name: 'Short program link', exact: true });
  await expect(ready).toContainText('30 days');
  const link = await copied(page);
  expect(link).toMatch(/\/run\/green-lamp-river$/);
  const player = await context.newPage();
  await player.goto(link);
  await expect(player.getByLabel('Program input')).toBeEnabled();
  await expect(player.getByRole('heading')).toHaveCount(0);
  await expect(player).toHaveTitle('BlueK program');
  await expect(player.getByRole('button', { name: /Download project/ })).toHaveCount(0);
  const developerUrl = await player.getByRole('link', { name: 'Open in BlueK' }).getAttribute('href');
  expect(developerUrl).toMatch(/\/bluek\/green-lamp-river$/);
  const developer = await context.newPage();
  await developer.goto(developerUrl as string);
  await expect(developer.getByLabel('Project name')).toHaveValue(project.projectName);
  // The client words the expiry itself (also against older server texts), translated with a way back.
  await context.route('**/api/programs/green-lamp-river', route => route.fulfill({ status: 404, json: { error: 'Project not found or expired.' } }));
  await player.reload();
  const problem = player.getByRole('alert');
  await expect(problem).toContainText('This program cannot be started.');
  await expect(problem).toContainText('Program not found or expired.');
  await expect(problem).toContainText('Short links are kept for 30 days.');
  await expect(player.getByRole('link', { name: 'Open BlueK' })).toHaveAttribute('href', 'http://127.0.0.1:5194/');
  await player.evaluate(() => localStorage.setItem('bluek-language', 'de'));
  await player.reload();
  await expect(problem).toContainText('Das Programm wurde nicht gefunden oder ist abgelaufen.');
  await expect(problem).toContainText('Kurzlinks werden 30 Tage aufbewahrt.');
  await expect(player.getByRole('link', { name: 'BlueK öffnen' })).toBeVisible();
});

test('EXP-15 BluePlay options force reachable Run, apply to links and HTML, and fit a small German viewport', async ({ page, context }, info) => {
  await editor(page, game);
  let dialog = await options(page);
  await page.screenshot({ path: info.outputPath('export-options-desktop.png') });
  await dialog.getByLabel('Show Act / Run / Reset buttons').uncheck();
  await dialog.getByLabel('Start game automatically').uncheck();
  await expect(dialog.getByLabel('Show Act / Run / Reset buttons')).toBeChecked();
  await expect(dialog.getByLabel('Show Act / Run / Reset buttons')).toBeDisabled();
  await dialog.getByLabel('Show speed slider').uncheck();
  await dialog.getByRole('button', { name: /^Copy Full Program Link/ }).click();
  const player = await context.newPage();
  await player.goto(await copied(page));
  await expect(player.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await expect(player.getByRole('status')).toHaveCount(0);
  await expect(player.getByRole('slider')).toHaveCount(0);
  await player.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(player.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('tick\n');
  await player.close();

  dialog = await options(page);
  await dialog.getByLabel('Start game automatically').check();
  await dialog.getByLabel('Show Act / Run / Reset buttons').uncheck();
  await dialog.getByLabel('Allow source download').uncheck();
  await dialog.getByLabel('Include “Open in BlueK”').uncheck();
  await dialog.getByLabel('Show project name').uncheck();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /^Export as HTML/ }).click()]);
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const htmlPlayer = await context.newPage();
  await htmlPlayer.goto(pathToFileURL(file).href);
  await expect(htmlPlayer.getByRole('status')).toHaveCount(0);
  await expect(htmlPlayer.getByRole('heading')).toHaveCount(0);
  await expect(htmlPlayer.locator('.player-header')).toHaveCount(0);
  await expect(htmlPlayer).toHaveTitle('BlueK program');
  await expect(htmlPlayer.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('tick\n');
  await expect(htmlPlayer.locator('.player-controls')).toHaveCount(0);
  await expect(htmlPlayer.getByRole('link')).toHaveCount(0);
  await expect(htmlPlayer.getByRole('button', { name: /Download project/ })).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem('bluek-language', 'de'));
  await page.reload();
  await page.setViewportSize({ width: 390, height: 720 });
  await page.getByRole('button', { name: 'Speichern / Exportieren', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Speichern / Exportieren', exact: true });
  await dialog.getByRole('button', { name: 'Ausführbares Programm', exact: true }).click();
  await expect(dialog.getByLabel('Spiel automatisch starten')).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: info.outputPath('export-options-german-mobile.png') });
});

for (const autoRun of [false, true]) for (const showControls of [true, false]) for (const showSpeed of [true, false]) {
  if (!autoRun && !showControls) continue;
  test(`EXP-15 BluePlay auto=${autoRun}, buttons=${showControls}, speed=${showSpeed}`, async ({ page }) => {
    const program = createExportedProgram(game, 'App.kt', 'https://bluek.online/', { autoRun, showControls, showSpeed, allowDownload: false, allowBlueK: false });
    await page.goto('/#run=p1.' + Buffer.from(JSON.stringify(program)).toString('base64url'));
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'BluePlay world', exact: true })).toBeVisible();
    if (showControls) await expect(page.getByRole('button', { name: autoRun ? 'Pause' : 'Run', exact: true })).toBeEnabled();
    await expect(page.locator('.player-buttons')).toHaveCount(showControls ? 1 : 0);
    await expect(page.getByRole('slider')).toHaveCount(showSpeed ? 1 : 0);
    if (!autoRun) await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('tick\n');
    if (showControls) {
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(page.getByRole('button', { name: autoRun ? 'Pause' : 'Run', exact: true })).toBeEnabled();
    }
    if (showSpeed) await page.getByRole('slider').fill('70');
  });
}


test('EXP-16 full link can hide the project name while retaining download and developer actions', async ({ page, context }) => {
  await editor(page);
  const dialog = await options(page);
  await expect(dialog.getByLabel('Show project name')).toBeChecked();
  await dialog.getByLabel('Show project name').uncheck();
  await dialog.getByRole('button', { name: /^Copy Full Program Link/ }).click();
  const player = await context.newPage();
  await player.goto(await copied(page));
  await expect(player.getByLabel('Program input')).toBeEnabled();
  await expect(player.getByRole('heading')).toHaveCount(0);
  await expect(player.getByRole('status')).toHaveCount(0);
  await expect(player).toHaveTitle('BlueK program');
  await expect(player.getByRole('button', { name: /Download project/ })).toBeVisible();
  await expect(player.getByRole('link', { name: 'Open in BlueK' })).toBeVisible();
});

for (const locale of ['en', 'de']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 800, height: 700 }, { width: 390, height: 720 }]) {
  test(`EXP-17 export dialog keeps its size across project/program and options (${locale}, ${viewport.width}px)`, async ({ page }, info) => {
    await page.addInitScript(value => localStorage.setItem('bluek-language', value), locale);
    await editorForLayout(page, game, locale);
    await page.setViewportSize(viewport);
    const names = locale === 'de' ? {
      save: 'Speichern / Exportieren', project: 'BlueK-Projekt', program: 'Ausführbares Programm',
      group: 'Für Links und HTML:', cancel: 'Abbrechen',
      toggles: ['Projektnamen anzeigen', 'Quellcode-Download anbieten', '„In BlueK öffnen“ einbinden', 'Speedleiste anzeigen', 'Buttons Act / Start / Zurücksetzen anzeigen', 'Spiel automatisch starten'],
    } : {
      save: 'Save / Export', project: 'BlueK project', program: 'Runnable program',
      group: 'For links and HTML:', cancel: 'Cancel',
      toggles: ['Show project name', 'Allow source download', 'Include “Open in BlueK”', 'Show speed slider', 'Show Act / Run / Reset buttons', 'Start game automatically'],
    };
    await page.getByRole('button', { name: names.save, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: names.save, exact: true });
    const original = await dialog.boundingBox();
    expect(original!.width).toBeLessThanOrEqual(viewport.width - 32);
    expect(original!.height).toBeLessThanOrEqual(viewport.height - 32);
    const unchanged = async () => {
      expect(await dialog.boundingBox()).toEqual(original);
      await expect(dialog.getByRole('button', { name: names.cancel, exact: true })).toBeInViewport();
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    };
    await dialog.getByRole('button', { name: names.program, exact: true }).click();
    await unchanged();
    const common = dialog.getByRole('group', { name: names.group, exact: true });
    await expect(common.getByRole('checkbox')).toHaveCount(3);
    await expect(dialog.locator('.program-export-choices > button')).toHaveCount(3);
    const buttonBounds = await dialog.locator('.program-export-choices > button').evaluateAll(buttons => buttons.map(button => ({ x: button.getBoundingClientRect().x, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
    expect(buttonBounds.every(box => box.x === buttonBounds[0].x && box.width === buttonBounds[0].width && box.height === buttonBounds[0].height)).toBe(true);
    for (const label of names.toggles) {
      await dialog.getByLabel(label, { exact: true }).uncheck();
      await unchanged();
    }
    await dialog.getByRole('button', { name: names.project, exact: true }).click();
    await unchanged();
    await dialog.getByRole('button', { name: names.program, exact: true }).click();
    await unchanged();
    await page.screenshot({ path: info.outputPath('export-options-stable.png') });
  });
}

async function editorForLayout(page: Page, payload: SavedProject, locale: string) {
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel(locale === 'de' ? 'Projektname' : 'Project name')).toHaveValue(payload.projectName!);
}


test('EXP-17 full link, short link and static HTML use the same shared options', async ({ page, context }, info) => {
  let stored: Record<string, unknown> = {};
  await context.route('**/api/programs', async route => {
    stored = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { code: 'green-lamp-river', expiresAt: '2026-11-09T00:00:00Z' } });
  });
  await editor(page, game);
  let dialog = await options(page);
  for (const label of ['Show project name', 'Allow source download', 'Include “Open in BlueK”', 'Show speed slider', 'Start game automatically'])
    await dialog.getByLabel(label, { exact: true }).uncheck();
  const expected = { showProjectName: false, allowDownload: false, allowBlueK: false, showSpeed: false, autoRun: false, showControls: true };
  const settings = (program: Record<string, unknown>) => Object.fromEntries(Object.keys(expected).map(key => [key, program[key]]));
  await dialog.getByRole('button', { name: /^Copy Full Program Link/ }).click();
  const encoded = new URLSearchParams(new URL(await copied(page)).hash.slice(1)).get('run')!;
  const [version, data] = encoded.split('.');
  const bytes = Buffer.from(data, 'base64url');
  const full = JSON.parse((version === 'd1' ? inflateRawSync(bytes) : bytes).toString());
  expect(settings(full)).toEqual(expected);

  dialog = await options(page);
  await dialog.getByRole('button', { name: /^Copy Short Program Link/ }).click();
  const ready = page.getByRole('dialog', { name: 'Short program link', exact: true });
  await expect(ready).toBeVisible();
  expect(settings(stored)).toEqual(expected);
  await ready.getByRole('button', { name: 'Close', exact: true }).click();

  dialog = await options(page);
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /^Export as HTML/ }).click()]);
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const html = await readFile(file, 'utf8');
  const text = html.match(/<script type="application\/json" id="bluek-program">(.*?)<\/script>/s)![1];
  expect(settings(parseEmbeddedProgram(text))).toEqual(expected);
});
