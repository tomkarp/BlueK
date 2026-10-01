import { test, expect, type Locator, type Page } from '@playwright/test';

async function bluePlayProject(page: Page, files: { fileName: string; source: string; kind?: string }[], resources: { path: string; data: string }[] = []) {
  const payload = { format: 'bluek-project', version: 1, library: { id: 'blueplay', version: 1 },
    files: files.map(file => ({ kind: 'class', ...file })), resources };
  await page.goto('about:blank');
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
    world.show()
}` },
    { fileName: 'Box.kt', source: `
class Box : Actor() {
    init {
        val picture = Image(20, 20)
        picture.setColor(200, 0, 0)
        picture.fill()
        image = picture
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
        image = picture
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


test('RT-47 loaded images preserve drawings, snapshot opacity and scaled pixels', async ({ page }) => {
  await page.goto('/');
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4;
    const context = canvas.getContext('2d')!; context.fillStyle = 'rgb(0,0,200)'; context.fillRect(0,0,4,4);
    return canvas.toDataURL('image/png');
  });
  const stage = await bluePlayProject(page, [
    { fileName: 'Main.kt', kind: 'functions', source: `
fun main() {
    val world = World(80, 40, 1)
    val loaded = Image("blue.png")
    loaded.setColor(200, 0, 0)
    loaded.fillRect(0, 0, 2, 4)
    val actor = Actor()
    actor.image = loaded
    world.addObject(actor, 20, 20)
    val source = Image("blue.png")
    source.setTransparency(128)
    val target = Image(8, 8)
    target.drawImage(source, 2, 2)
    source.clear()
    val copy = Image(other = target)
    target.clear()
    copy.scale(16, 16)
    val copied = Actor()
    copied.image = copy
    world.addObject(copied, 50, 20)
    val background = Image(4, 4)
    background.setColor(0, 200, 0)
    background.fill()
    background.setTransparency(128)
    world.background = background
    world.addObject(Actor(), 70, 28)
    world.show()
}` },
  ], [{ path: 'images/blue.png', data }]);
  await expect.poll(() => worldPixel(stage, 19, 20, 80, 40)).toEqual([200, 0, 0]);
  expect(await worldPixel(stage, 21, 20, 80, 40)).toEqual([0, 0, 200]);
  await expect.poll(() => worldPixel(stage, 50, 20, 80, 40)).toEqual([127, 127, 227]);
  expect(await worldPixel(stage, 43, 13, 80, 40)).toEqual([255, 255, 255]);
  const backgroundPixel = await worldPixel(stage, 1, 1, 80, 40);
  [127, 227, 127].forEach((value, index) => expect(Math.abs(backgroundPixel[index] - value)).toBeLessThanOrEqual(1));
  expect(await worldPixel(stage, 5, 1, 80, 40)).toEqual([255, 255, 255]);
  expect(await worldPixel(stage, 60, 20, 80, 40)).toEqual([180, 180, 190]);
});


test('RT-47 step during Run is ignored and World.show pauses the scheduler', async ({ page }) => {
  const stage = await bluePlayProject(page, [
    { fileName: 'Main.kt', kind: 'functions', source: 'val world = PausingWorld(); fun main() { world.show() }' },
    { fileName: 'PausingWorld.kt', source: 'class PausingWorld : World(40, 30, 1) { var calls = 0; override fun act() { calls += 1; step(); if (calls == 2) { setBackground(0, 0, 200); show() } } }' },
  ]);
  await stage.getByRole('button', { name: 'Run BluePlay world' }).click();
  await expect.poll(() => worldPixel(stage, 10, 10, 40, 30)).toEqual([0, 0, 200]);
  await expect(stage).toHaveAttribute('data-simulation', 'paused');
  const input = page.getByLabel('Codepad input');
  await input.fill('world.calls'); await input.press('Enter');
  await expect(page.locator('.codepad-entry').last()).toContainText('2');
});
