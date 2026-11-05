import { test, expect, webkit } from '@playwright/test';
import { cardText, cardRasters, expectLocalizedCards } from './cardFontChecks';

for (const engine of ['Chromium', 'WebKit']) {
  test(`GUI-158 ${engine} playing cards switch language without changing terminal text`, async ({ browser: chromium }, info) => {
    const browser = engine === 'WebKit' ? await webkit.launch() : chromium;
    const context = await browser.newContext({ locale: 'en-US' });
    try {
      const page = await context.newPage();
      const project = { format: 'bluek-project', version: 1, files: [{
        fileName: 'Cards.kt', kind: 'functions',
        source: `fun main() { println("${cardText}")\nprintln("\\u001B[31m\\u001B]66;s=4;🂫 🂭\\u0007\\u001B[0m") }`,
      }] };
      await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(project)).toString('base64url'));
      await page.getByRole('button', { name: 'Compile', exact: true }).click();
      await page.getByRole('button', { name: 'Start main', exact: true }).click();
      const terminal = page.locator('.terminal-output pre');
      await expect(terminal).toHaveText(cardText + '\n🂫 🂭\n');
      const english = await cardRasters(terminal, 'en');
      await terminal.screenshot({ path: info.outputPath('cards-english.png') });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByLabel('Language', { exact: true }).selectOption('de');
      await page.getByRole('button', { name: 'Schließen', exact: true }).click();
      expectLocalizedCards(english, await cardRasters(terminal, 'de'));
      await expect(terminal).toHaveText(cardText + '\n🂫 🂭\n');
      await expect(terminal.locator('.terminal-sized').first()).toContainText('🂫 🂭');
      await terminal.screenshot({ path: info.outputPath('cards-german.png') });
      await expect(page.locator('meta[name="bluek-card-font-license"]')).toHaveAttribute('content', /Copyright 2022[\s\S]*SIL OPEN FONT LICENSE[\s\S]*PERMISSION & CONDITIONS/);
      await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
      await page.getByLabel('Sprache', { exact: true }).selectOption('en');
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      expect(await cardRasters(terminal, 'en')).toEqual(english);
    } finally {
      await context.close();
      if (engine === 'WebKit') await browser.close();
    }
  });
}
