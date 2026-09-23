import { test, expect, type Locator, type Page } from '@playwright/test';

async function bluePlayProject(page: Page, files: { fileName: string; source: string; kind?: string }[]) {
  const payload = { format: 'bluek-project', version: 1, library: { id: 'blueplay', version: 1 },
    files: files.map(file => ({ kind: 'class', ...file })) };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Ready', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  await expect(stage).toBeVisible();
  return stage;
}

/** Colour of the world pixel at (x, y), independent of the canvas' device scale. */
function worldPixel(stage: Locator, x: number, y: number, worldWidth: number, worldHeight: number) {
  return stage.locator('.game-stage').evaluate((element: HTMLCanvasElement, point) => {
    const context = element.getContext('2d')!;
    const scaleX = element.width / point.worldWidth, scaleY = element.height / point.worldHeight;
    const [red, green, blue] = context.getImageData(Math.floor((point.x + 0.5) * scaleX), Math.floor((point.y + 0.5) * scaleY), 1, 1).data;
    return [red, green, blue];
  }, { x, y, worldWidth, worldHeight });
}

test('GUI-86 Actor images drawn with Image.fill() are rendered on the stage', async ({ page }) => {
  const stage = await bluePlayProject(page, [
    { fileName: 'Main.kt', kind: 'functions', source: `
fun main() {
    val world = World(100, 60, 1)
    world.addObject(Box(), 20, 30)
    world.addObject(Framed(), 70, 30)
    showWorld(world)
}` },
    { fileName: 'Box.kt', source: `
class Box : Actor() {
    init {
        val picture = Image(20, 20)
        picture.setColor(200, 0, 0)
        picture.fill()
        setImage(picture)
    }
}` },
    // fill() followed by further drawing, and a filled image nested via drawImage.
    { fileName: 'Framed.kt', source: `
class Framed : Actor() {
    init {
        val inner = Image(6, 6)
        inner.setColor(0, 0, 200)
        inner.fill()
        val picture = Image(20, 20)
        picture.setColor(0, 160, 0)
        picture.fill()
        picture.drawImage(inner, 7, 7)
        setImage(picture)
    }
}` },
  ]);

  // Placement is centred: Box covers x 10..29, y 20..39. The placeholder would
  // draw a light box with the class initial instead of solid red.
  await expect.poll(() => worldPixel(stage, 20, 30, 100, 60)).toEqual([200, 0, 0]);
  expect(await worldPixel(stage, 11, 21, 100, 60)).toEqual([200, 0, 0]);
  expect(await worldPixel(stage, 28, 38, 100, 60)).toEqual([200, 0, 0]);
  expect(await worldPixel(stage, 5, 30, 100, 60)).toEqual([255, 255, 255]);

  // Framed covers x 60..79, y 20..39; the nested blue image sits at 67..72, 27..32.
  expect(await worldPixel(stage, 62, 22, 100, 60)).toEqual([0, 160, 0]);
  expect(await worldPixel(stage, 69, 29, 100, 60)).toEqual([0, 0, 200]);
});
