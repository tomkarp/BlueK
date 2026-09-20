import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';

// 1x1 opaque PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function openImportDialog(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open / Import', exact: true }).click();
  return page.getByRole('dialog', { name: 'Open / Import' });
}

test('GUI-60 a BlueJ ZIP project opens with its classes, positions and hidden private methods', async ({ page }) => {
  const zip = zipSync({
    'blackjack/package.bluej': strToU8('#BlueJ package file\ntarget1.name=Stapel\ntarget1.x=300\ntarget1.y=40\ntarget2.name=Karte\ntarget2.x=60\ntarget2.y=40\n'),
    'blackjack/Karte.kt': strToU8('class Karte(val rang: String) {\n    fun druckeKarte() {\n        println("│$rang│")\n    }\n}\n'),
    'blackjack/Stapel.kt': strToU8('class Stapel {\n    private val karten: MutableList<Karte> = mutableListOf()\n\n    fun erzeugeBlaetter(anzahl: Int) {\n        repeat(anzahl) { karten.add(Karte("A")) }\n    }\n\n    fun zaehleKarten(): Int = karten.size\n\n    private fun zieheKarte(): Karte? = if (karten.isEmpty()) null else karten.removeAt(0)\n\n    fun zieheUndZeige() {\n        zieheKarte()?.druckeKarte()\n    }\n}\n'),
    'blackjack/Karte.ctxt': strToU8('#BlueJ class context'),
    '__MACOSX/blackjack/._Karte.kt': strToU8('junk'),
  });
  const dialog = await openImportDialog(page);
  await dialog.getByLabel('Choose project file').setInputFiles({ name: 'blackjack.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(page.locator('.classcard')).toHaveCount(2);
  const karte = await page.locator('.classcard[aria-label="Karte"]').boundingBox();
  const stapel = await page.locator('.classcard[aria-label="Stapel"]').boundingBox();
  expect(karte!.x).toBeLessThan(stapel!.x);

  const input = page.getByLabel('Codepad input');
  await expect(input).toBeEnabled();
  await input.fill('val stapel1 = Stapel()');
  await input.press('Enter');
  await input.fill('stapel1.erzeugeBlaetter(3)');
  await input.press('Enter');
  await input.fill('stapel1.zaehleKarten()');
  await input.press('Enter');
  await expect(page.locator('.codepad-entry').last()).toContainText('3');

  await page.locator('.classcard[aria-label="Stapel"]').click({ button: 'right' });
  await page.locator('.constructor-menu-item').click();
  await page.getByRole('dialog', { name: 'Create Stapel' }).getByRole('button', { name: 'Create', exact: true }).click();
  await page.locator('.bench .object').last().click({ button: 'right' });
  const methods = page.locator('.method-menu-item');
  await expect(methods.filter({ hasText: 'zieheUndZeige' })).toHaveCount(1);
  await expect(methods.filter({ hasText: 'zieheKarte(' })).toHaveCount(0);
});

test('GUI-61 a BlueJ BluePlay directory uses the built-in library and its images', async ({ page }) => {
  const root = path.join(mkdtempSync(path.join(tmpdir(), 'bluek-import-')), 'Ausgebuext');
  mkdirSync(path.join(root, 'images'), { recursive: true });
  for (const framework of ['World.kt', 'Actor.kt', 'Image.kt', 'BluePlayFunctions.kt'])
    writeFileSync(path.join(root, framework), '// historical framework source, replaced by BlueK\n');
  writeFileSync(path.join(root, 'Ausreisser.kt'), 'class Ausreisser : Actor() {\n    init {\n        image = Image("cat.png")\n    }\n}\n');
  writeFileSync(path.join(root, 'Main.kt'), 'fun main() {\n    val welt = World(200, 100, 1)\n    welt.addObject(Ausreisser(), 50, 50)\n    welt.show()\n}\n');
  writeFileSync(path.join(root, 'package.bluej'), '#BlueJ package file\n');
  writeFileSync(path.join(root, 'images', 'cat.png'), PNG);
  const dialog = await openImportDialog(page);
  await dialog.getByLabel('Choose project directory').setInputFiles(root);
  await expect(page.locator('.classcard[aria-label="Ausreisser"]')).toBeVisible();
  await expect(page.locator('.classcard[aria-label="World"]')).toHaveCount(1);
  const input = page.getByLabel('Codepad input');
  await expect(input).toBeEnabled();
  await input.fill('main()');
  await input.press('Enter');
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  await expect(stage).toBeVisible();
  await expect(page.locator('.codepad-error')).toHaveCount(0);
});
