import { test, expect, type Page } from '@playwright/test';

async function loadBluePlay(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Project' });
  await dialog.getByRole('button', { name: /^BluePlay Example/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.classcard[aria-label="World"]')).toBeVisible();
  const input = page.getByLabel('Codepad input');
  await expect(input).toBeEnabled();
  await input.fill('main()');
  await input.press('Enter');
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  await expect(stage).toBeVisible();
  return stage;
}

async function loadSpaceInvaders(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Project' });
  await dialog.getByRole('button', { name: /^Space Invaders Demo/ }).click();
  await expect(dialog).toBeHidden();
  const input = page.getByLabel('Codepad input');
  await input.fill('main()');
  await input.press('Enter');
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  await expect(stage).toBeVisible();
  return stage;
}

test('GUI-58 BluePlay library cards are normal movable cards with per-file API docs', async ({ page }) => {
  const stage = await loadBluePlay(page);
  await stage.getByRole('button', { name: 'Close BluePlay world' }).click();
  await expect(page.locator('.blueplay-library-strip')).toHaveCount(0);
  await expect(page.locator('.classcard')).toHaveCount(7);
  for (const name of ['BluePlayFunctions', 'World', 'Actor', 'Image']) {
    const card = page.locator(`.classcard[aria-label="${name}"]`);
    await expect(card).toBeVisible();
    await expect(card).not.toContainText('built-in');
    await expect(card).not.toContainText('BluePlay API');
  }

  await expect(page.locator('.inheritance-edge')).toHaveCount(2);
  const initialEdgeZ = await page.locator('.inheritance-edge').evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).zIndex)),
  );

  const world = page.locator('.classcard[aria-label="World"]');
  const myWorld = page.locator('.classcard[aria-label="MyWorld"]');
  const before = (await world.boundingBox())!;
  const myWorldBounds = (await myWorld.boundingBox())!;
  const targetCenter = {
    x: myWorldBounds.x + myWorldBounds.width / 2 + 40,
    y: myWorldBounds.y + myWorldBounds.height / 2 + 30,
  };
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    targetCenter.x,
    targetCenter.y,
    { steps: 4 },
  );
  await page.mouse.up();
  const after = (await world.boundingBox())!;
  expect(Math.abs(after.x + after.width / 2 - targetCenter.x)).toBeLessThan(4);
  expect(Math.abs(after.y + after.height / 2 - targetCenter.y)).toBeLessThan(4);
  const worldZ = await world.evaluate((element) => Number(getComputedStyle(element).zIndex));
  const edgeZ = await page.locator('.inheritance-edge').evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).zIndex)),
  );
  expect(worldZ).toBeGreaterThan(Math.max(...initialEdgeZ));
  expect(edgeZ).toContain(worldZ);
  const topCard = await page.evaluate(({ x, y }) =>
    document.elementFromPoint(x, y)?.closest('.classcard')?.getAttribute('aria-label'), {
      x: targetCenter.x,
      y: targetCenter.y,
    });
  expect(topCard).toBe('World');

  await world.dblclick();
  const api = page.getByRole('dialog', { name: 'World API' });
  await expect(api).toBeVisible();
  await expect(api).toContainText('World(width: Int, height: Int, cellSize: Int = 1)');
  await api.getByRole('button', { name: 'Close' }).click();

  await page.locator('.classcard[aria-label="Actor"]').click({ button: 'right' });
  const menu = page.locator('.popup');
  await expect(menu.getByRole('button', { name: 'Show API documentation' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Compile', exact: true })).toHaveCount(0);
});

test('GUI-59 new classes are laid out after the BluePlay library cards', async ({ page }) => {
  await loadBluePlay(page);
  await page.getByRole('button', { name: 'New File', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Kotlin File' });
  await dialog.getByLabel('Name').fill('NewActor');
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const card = page.locator('.classcard[aria-label="NewActor"]');
  await expect(card).toBeVisible();
  // The README note owns the corner, so the card grid starts 46px further right.
  await expect(card).toHaveAttribute('style', /left: 356px; top: 372px/);
});

test('GUI-52 BluePlay keeps chrome, world and controls in one draggable window', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const windowBefore = (await stage.boundingBox())!;
  const header = stage.locator('.stage-window-chrome');
  const headerBefore = (await header.boundingBox())!;
  const canvas = (await stage.locator('.game-stage').boundingBox())!;
  const controls = (await stage.locator('.game-controls').boundingBox())!;
  expect(Math.abs(headerBefore.x - windowBefore.x)).toBeLessThan(3);
  expect(canvas.y).toBeGreaterThan(headerBefore.y + headerBefore.height - 1);
  expect(controls.y).toBeGreaterThan(canvas.y + canvas.height - 1);

  await page.mouse.move(headerBefore.x + headerBefore.width / 2, headerBefore.y + headerBefore.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBefore.x + headerBefore.width / 2 + 35, headerBefore.y + headerBefore.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  const windowAfter = (await stage.boundingBox())!;
  expect(Math.abs(windowAfter.x - windowBefore.x - 35)).toBeLessThan(4);
  expect(Math.abs(windowAfter.y - windowBefore.y - 20)).toBeLessThan(4);

  await stage.getByRole('button', { name: 'Close BluePlay world' }).click();
  await expect(stage).toBeHidden();
  await expect(page.locator('.stage-window .game-stage')).toHaveCount(0);
});

test('GUI-54 a world without a custom background is rendered on white', async ({ page }) => {
  const stage = await loadBluePlay(page);
  await expect(stage.locator('.stage-window-body')).toHaveCSS('background-color', 'rgb(210, 210, 210)');
  await expect(stage.locator('.stage-window-body')).toHaveCSS('padding', '0px');
  await expect(stage.locator('.game-stage')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('GUI-55 small worlds keep their pixel size and receive a grey surround', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const input = page.getByLabel('Codepad input');
  await input.fill('val smallWorld = World(100, 100, 1); showWorld(smallWorld)');
  await input.press('Enter');
  await expect(input).toBeEnabled();
  const canvas = stage.locator('.game-stage');
  const body = stage.locator('.stage-window-body');
  const box = (await canvas.boundingBox())!;
  expect(box.width).toBeCloseTo(100, 0);
  expect(box.height).toBeCloseTo(100, 0);
  await expect(body).toHaveCSS('background-color', 'rgb(210, 210, 210)');
});

test('GUI-56 the world window grows to fit a large unscaled world before scrolling', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const input = page.getByLabel('Codepad input');
  await input.fill('val wideWorld = World(1000, 100, 1); showWorld(wideWorld)');
  await input.press('Enter');
  await expect(input).toBeEnabled();
  const canvas = stage.locator('.game-stage');
  const body = stage.locator('.stage-window-body');
  const box = (await canvas.boundingBox())!;
  const overflow = await body.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(box.width).toBeCloseTo(1000, 0);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test('GUI-57 maximize fills the browser viewport without scaling the world', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const input = page.getByLabel('Codepad input');
  await input.fill('val fullWorld = World(100, 100, 1); showWorld(fullWorld)');
  await input.press('Enter');
  await expect(input).toBeEnabled();
  await stage.getByRole('button', { name: 'Maximize BluePlay world' }).click();
  await expect(stage.getByRole('button', { name: 'Restore BluePlay world' })).toBeVisible();
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const windowBox = (await stage.boundingBox())!;
  const canvasBox = (await stage.locator('.game-stage').boundingBox())!;
  const bodyBox = (await stage.locator('.stage-window-body').boundingBox())!;
  expect(windowBox.x).toBeCloseTo(0, 0);
  expect(windowBox.y).toBeCloseTo(0, 0);
  expect(windowBox.width).toBeCloseTo(viewport.width, 0);
  expect(windowBox.height).toBeCloseTo(viewport.height, 0);
  expect(canvasBox.width).toBeCloseTo(100, 0);
  expect(canvasBox.height).toBeCloseTo(100, 0);
  expect(Math.abs((canvasBox.x - bodyBox.x) - (bodyBox.x + bodyBox.width - canvasBox.x - canvasBox.width))).toBeLessThan(1);
  expect(Math.abs((canvasBox.y - bodyBox.y) - (bodyBox.y + bodyBox.height - canvasBox.y - canvasBox.height))).toBeLessThan(1);
  await expect(stage.locator('.stage-window-body')).toHaveCSS('background-color', 'rgb(210, 210, 210)');
});

test('RT-11 Run stays active, Pause stops it, and speed can be dragged during Run', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const run = stage.getByRole('button', { name: 'Run BluePlay world' });
  const pause = stage.getByRole('button', { name: 'Pause BluePlay world' });
  await run.click();
  await expect(stage).toHaveAttribute('data-simulation', 'running');
  await expect(stage.locator('.game-stage')).toBeFocused();
  await expect(run).toBeDisabled();
  await expect(pause).toBeEnabled();

  const slider = stage.locator('input[type="range"]');
  const sliderBox = (await slider.boundingBox())!;
  await page.mouse.move(sliderBox.x + sliderBox.width * 0.25, sliderBox.y + sliderBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sliderBox.x + sliderBox.width * 0.85, sliderBox.y + sliderBox.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(Number(await slider.inputValue())).toBeGreaterThan(70);

  await pause.click();
  await expect(stage).toHaveAttribute('data-simulation', 'paused');
  await expect(pause).toBeDisabled();
  await expect(run).toBeEnabled();
});

test('PERF-01 Space Invaders advances in coherent frames while a key is held', async ({ page }) => {
  // Match the reported scenario without changing the shipped example.
  await page.route('**/examples/space-invaders.bluek.json', async route => {
    const response = await route.fetch();
    const project = await response.json();
    for (const file of project.files) file.source = file.source.replaceAll('x - 5', 'x - 1').replaceAll('x + 5', 'x + 1');
    await route.fulfill({ json: project });
  });
  const stage = await loadSpaceInvaders(page);
  const slider = stage.locator('input[type="range"]');
  await slider.fill('95');
  await stage.evaluate((element) => {
    const frameTimes: number[] = [];
    let previous = element.getAttribute('data-frame-version');
    const observer = new MutationObserver(() => {
      const next = element.getAttribute('data-frame-version');
      if (next !== previous) {
        frameTimes.push(performance.now());
        previous = next;
      }
    });
    observer.observe(element, { attributes: true, attributeFilter: ['data-frame-version'] });
    (element as HTMLElement & { __bluekFrameTimes?: number[]; __bluekFrameObserver?: MutationObserver }).__bluekFrameTimes = frameTimes;
    (element as HTMLElement & { __bluekFrameTimes?: number[]; __bluekFrameObserver?: MutationObserver }).__bluekFrameObserver = observer;
  });
  await stage.getByRole('button', { name: 'Run BluePlay world' }).click();
  await expect(stage).toHaveAttribute('data-simulation', 'running');
  const initialFrame = Number(await stage.getAttribute('data-frame-version'));
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('Space');
  await page.waitForTimeout(4000);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('Space');
  const finalFrame = Number(await stage.getAttribute('data-frame-version'));
  expect(finalFrame - initialFrame).toBeGreaterThanOrEqual(120);
  const frameGaps = await stage.evaluate((element) => {
    const target = element as HTMLElement & { __bluekFrameTimes?: number[]; __bluekFrameObserver?: MutationObserver };
    target.__bluekFrameObserver?.disconnect();
    const times = target.__bluekFrameTimes || [];
    return times.slice(1).map((time, index) => time - times[index]);
  });
  const sortedGaps = frameGaps.slice().sort((a, b) => a - b);
  console.log('PERF-01 high speed + shooting', { frames: frameGaps.length, p95: sortedGaps[Math.floor(sortedGaps.length * .95)], max: Math.max(...frameGaps) });
  expect(frameGaps.length).toBeGreaterThanOrEqual(120);
  expect(sortedGaps[Math.floor(sortedGaps.length * .95)]).toBeLessThan(50);
  expect(Math.max(...frameGaps)).toBeLessThan(150);
  await stage.getByRole('button', { name: 'Pause BluePlay world' }).click();
});

test('GUI-53 canvas clicks target visible Actor pixels and ignore transparent pixels', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const input = page.getByLabel('Codepad input');
  const entries = page.locator('.codepad-entry');
  await input.fill('val clickWorld = MyWorld(); val clickActor = Figure(); clickWorld.addObject(clickActor, 100, 100); showWorld(clickWorld)');
  await input.press('Enter');
  await expect(entries).toHaveCount(2);

  const canvas = (await stage.locator('.game-stage').boundingBox())!;
  await stage.locator('.game-stage').click();
  await expect(input).toBeEnabled();
  await input.fill('clickWorld.isClicked');
  await input.press('Enter');
  await expect(entries.last()).toContainText('true');

  const pixels = await stage.locator('.game-stage').evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')!;
    const scaleX = element.width / 600;
    const scaleY = element.height / 400;
    const centerX = 100.5 * scaleX;
    const centerY = 100.5 * scaleY;
    let visible = { x: centerX, y: centerY, distance: -1 };
    const isStrongActorPixel = (x: number, y: number) => {
      const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
      return red < 225 || green < 225 || blue < 225;
    };
    for (let y = Math.floor(centerY - 20 * scaleY); y < Math.ceil(centerY + 20 * scaleY); y += 1) {
      for (let x = Math.floor(centerX - 20 * scaleX); x < Math.ceil(centerX + 20 * scaleX); x += 1) {
        const distance = Math.hypot(x - centerX, y - centerY);
        const interior = [-1, 0, 1].every(offsetY => [-1, 0, 1].every(offsetX => isStrongActorPixel(x + offsetX, y + offsetY)));
        if (interior && distance > 5 * Math.max(scaleX, scaleY) && distance > visible.distance)
          visible = { x, y, distance };
      }
    }
    return {
      transparent: { x: (centerX - 19 * scaleX) / element.width, y: (centerY - 19 * scaleY) / element.height },
      visible: { x: visible.x / element.width, y: visible.y / element.height },
      visibleDistance: visible.distance / Math.max(scaleX, scaleY),
    };
  });
  expect(pixels.visibleDistance).toBeGreaterThan(4);

  await page.mouse.click(canvas.x + pixels.transparent.x * canvas.width, canvas.y + pixels.transparent.y * canvas.height);
  await input.fill('clickActor.isClicked');
  await input.press('Enter');
  await expect(entries.last()).toContainText('false');

  await page.mouse.click(canvas.x + pixels.visible.x * canvas.width, canvas.y + pixels.visible.y * canvas.height);
  await expect(input).toBeEnabled();
  await input.fill('clickActor.isClicked');
  await input.press('Enter');
  await expect(entries.last()).toContainText('true');
});
