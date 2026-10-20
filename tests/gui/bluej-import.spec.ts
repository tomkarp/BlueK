import { test, expect } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

// 1x1 opaque PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function openImportDialog(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open / Import', exact: true }).click();
  return page.getByRole('dialog', { name: 'Open / Import' });
}

// The file chooser only offers JSON; BlueJ ZIPs reach BlueK by dropping them
// onto the Open / Import drop zone.
async function dropZip(dialog: import('@playwright/test').Locator, name: string, zip: Uint8Array) {
  const dataTransfer = await dialog.page().evaluateHandle(({ name, bytes }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], name, { type: 'application/zip' }));
    return transfer;
  }, { name, bytes: Array.from(zip) });
  await dialog.locator('.project-dropzone').dispatchEvent('drop', { dataTransfer });
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
  await dropZip(dialog, 'blackjack.zip', zip);
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

test('GUI-61 a BlueJ BluePlay project uses the built-in library and its images', async ({ page }) => {
  const librarySource = strToU8('// historical BluePlay library source, replaced by BlueK\n');
  const zip = zipSync({
    'Ausgebuext/World.kt': librarySource,
    'Ausgebuext/Actor.kt': librarySource,
    'Ausgebuext/Image.kt': librarySource,
    'Ausgebuext/BluePlayFunctions.kt': librarySource,
    'Ausgebuext/Ausreisser.kt': strToU8('class Ausreisser : Actor() {\n    init {\n        image = Image("cat.png")\n    }\n}\n'),
    'Ausgebuext/Main.kt': strToU8('fun main() {\n    val welt = World(200, 100, 1)\n    welt.addObject(Ausreisser(), 50, 50)\n    welt.show()\n}\n'),
    'Ausgebuext/package.bluej': strToU8('#BlueJ package file\n'),
    'Ausgebuext/images/cat.png': new Uint8Array(PNG),
  });
  const dialog = await openImportDialog(page);
  await dropZip(dialog, 'Ausgebuext.zip', zip);
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

for (const locale of ['en', 'de']) {
  test(`GUI-147 choose one BlueJ project from a collection and cancel without replacing the workspace (${locale})`, async ({ page }) => {
    await page.addInitScript(language => localStorage.setItem('bluek-language', language), locale);
    const zip = zipSync({
      'units/unit1/demo/package.bluej': strToU8('#BlueJ package file\n'),
      'units/unit1/demo/Cat.kt': strToU8('class Cat { fun sound()="meow" }'),
      'units/unit2/demo/package.bluej': strToU8('#BlueJ package file\n'),
      'units/unit2/demo/Dog.kt': strToU8('class Dog { fun sound()="woof" }'),
    });
    await page.goto('/');
    const open = () => page.getByRole('button', { name: locale === 'de' ? 'Öffnen / Importieren' : 'Open / Import', exact: true }).click();
    const upload = async () => {
      await open();
      await page.getByLabel(locale === 'de' ? 'Projektdatei auswählen' : 'Choose project file').setInputFiles({ name: 'Units.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
    };
    await upload();
    let dialog = page.getByRole('dialog', { name: locale === 'de' ? 'BlueJ-Projekt auswählen' : 'Choose BlueJ Project', exact: true });
    await expect(dialog.locator('option')).toHaveText(['units/unit1/demo', 'units/unit2/demo']);
    await dialog.getByLabel(locale === 'de' ? 'Projekt' : 'Project', { exact: true }).selectOption('units/unit2/demo/');
    await dialog.getByRole('button', { name: locale === 'de' ? 'Projekt öffnen' : 'Open project', exact: true }).click();
    await expect(page.locator('.classcard')).toHaveCount(1);
    await expect(page.locator('.classcard[aria-label="Dog"]')).toBeVisible();
    await page.getByLabel(locale === 'de' ? 'Codepad-Eingabe' : 'Codepad input').fill('Dog().sound()');
    await page.getByLabel(locale === 'de' ? 'Codepad-Eingabe' : 'Codepad input').press('Enter');
    await expect(page.locator('.codepad-entry').last()).toContainText('woof');
    await upload();
    dialog = page.getByRole('dialog', { name: locale === 'de' ? 'BlueJ-Projekt auswählen' : 'Choose BlueJ Project', exact: true });
    await dialog.getByRole('button', { name: locale === 'de' ? 'Abbrechen' : 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.classcard[aria-label="Dog"]')).toBeVisible();
    await expect(page.locator('.codepad-entry').last()).toContainText('woof');
    await upload();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.classcard[aria-label="Dog"]')).toBeVisible();
  });
}
