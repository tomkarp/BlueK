import { expect, type Locator } from '@playwright/test';

export const cardText = '🂫 🂭 🂮 🂡 🂻 🂽 🃋 🃍 🃛 🃝 🂢';

/** Check actual rasterized glyphs, not just a CSS family declaration. */
export async function cardRasters(terminal: Locator, locale: 'en' | 'de') {
  const family = `BlueK Cards ${locale === 'de' ? 'German' : 'English'}`;
  await expect(terminal).toHaveCSS('font-family', 'monospace');
  const card = terminal.locator('.terminal-card').first();
  await expect(card).toHaveCSS('font-family', new RegExp(`^"?${family}"?, monospace$`));
  await expect(card).toHaveCSS('opacity', '1');
  return card.evaluate(async (element, family) => {
    const loaded = await document.fonts.load(`100px "${family}"`, '🂫🂭');
    if (loaded.length !== 1 || loaded[0].status !== 'loaded') throw new Error('Card font not loaded');
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    const render = (text: string, font: string) => {
      ctx.clearRect(0, 0, 180, 200);
      ctx.font = `100px ${font}`;
      ctx.fillText(text, 10, 120);
      return canvas.toDataURL();
    };
    const font = getComputedStyle(element).fontFamily;
    if (render('Ab1', font) !== render('Ab1', 'monospace')) throw new Error('Normal text font changed');
    return [...'🂫🂭🂻🂽🃋🃍🃛🃝🂮🂡🂢'].map(char => render(char, font));
  }, family);
}

export function expectLocalizedCards(english: string[], german: string[]) {
  // All four jacks and queens change; king, ace and number card stay identical.
  for (let i = 0; i < english.length; i++) {
    if (i < 8) expect(german[i]).not.toBe(english[i]);
    else expect(german[i]).toBe(english[i]);
  }
}
