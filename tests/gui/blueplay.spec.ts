import { test, expect, type Page } from '@playwright/test';
import { STANDARD_IMAGES } from '../../frontend/src/standardImages.generated';
import { STANDARD_SOUNDS } from '../../frontend/src/standardSounds.generated';

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
  expect(Math.abs(after.x + after.width / 2 - targetCenter.x)).toBeLessThanOrEqual(10);
  expect(Math.abs(after.y + after.height / 2 - targetCenter.y)).toBeLessThanOrEqual(10);
  const worldZ = await world.evaluate((element) => Number(getComputedStyle(element).zIndex));
  const edgeZ = await page.locator('.inheritance-edge').evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).zIndex)),
  );
  expect(worldZ).toBeGreaterThan(Math.max(...initialEdgeZ));
  expect(edgeZ).toContain(worldZ);
  await world.click();
  const clickedWorldZ = await world.evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(clickedWorldZ).toBeGreaterThan(worldZ);
  expect(await page.locator('.inheritance-edge').evaluateAll((elements) =>
    elements.map((element) => Number(getComputedStyle(element).zIndex)),
  )).toContain(clickedWorldZ);
  const topCard = await page.evaluate(({ x, y }) =>
    document.elementFromPoint(x, y)?.closest('.classcard')?.getAttribute('aria-label'), {
      x: targetCenter.x,
      y: targetCenter.y,
    });
  expect(topCard).toBe('World');

  await world.dblclick();
  const api = page.getByRole('dialog', { name: 'World API' });
  await expect(api).toBeVisible();
  await expect(api).toContainText('World(width: Int, height: Int, cellSize: Int)');
  await api.getByRole('button', { name: 'Close' }).click();

  await page.locator('.classcard[aria-label="Actor"]').click({ button: 'right' });
  const menu = page.locator('.popup');
  await expect(menu.getByRole('button', { name: 'Show API documentation' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Compile', exact: true })).toHaveCount(0);
});

test('GUI-59 new classes are laid out after the current BluePlay cards', async ({ page }) => {
  await loadBluePlay(page);
  await page.getByRole('button', { name: 'New File', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Kotlin File' });
  await dialog.getByLabel('Name').fill('NewActor');
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const card = page.locator('.classcard[aria-label="NewActor"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('style', /left: 920px; top: 200px/);
});

test('GUI-76 BluePlay templates use the reference card order and shared grid spacing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Create New Project' });
  await dialog.getByRole('button', { name: /^BluePlay Example/ }).click();
  await expect(dialog).toBeHidden();

  async function expectCards(names: string[], expectedPositions: Array<[number, number]>) {
    const cards = page.locator('.classcard');
    await expect(cards).toHaveCount(names.length);
    await expect.poll(() => cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))).toEqual(names);
    const positions = await cards.evaluateAll((elements) => elements.map((element) => {
      const card = element as HTMLElement;
      return [Number.parseFloat(card.style.left), Number.parseFloat(card.style.top)];
    }));
    expect(positions).toEqual(expectedPositions);
    for (const [x, y] of positions) {
      expect(x % 20).toBe(0);
      expect(y % 20).toBe(0);
    }
  }

  await expectCards(
    ['BluePlayFunctions', 'World', 'Actor', 'Image', 'Main', 'MyWorld', 'Figure'],
    [[80, 40], [360, 40], [640, 40], [920, 40], [80, 200], [360, 200], [640, 200]],
  );

  page.once('dialog', (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Create New Project' });
  await dialog.getByRole('button', { name: /^Space Invaders Demo/ }).click();
  await expect(dialog).toBeHidden();
  await expectCards(
    ['BluePlayFunctions', 'World', 'Actor', 'Image', 'Main', 'SpaceInvadersWorld', 'Invader', 'Laser', 'Defender'],
    [[80, 40], [360, 40], [640, 40], [920, 40], [80, 200], [360, 200], [640, 200], [920, 200], [80, 360]],
  );
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

test('GUI-81 codepad evaluation does not reopen a closed BluePlay world', async ({ page }) => {
  const stage = await loadBluePlay(page);
  await stage.getByRole('button', { name: 'Close BluePlay world' }).click();
  await expect(stage).toHaveCount(0);

  const input = page.getByLabel('Codepad input');
  await input.fill('5 + 3');
  await input.press('Enter');
  await expect(page.locator('.codepad-entry').last()).toContainText('8');
  await expect(page.locator('.stage-window')).toHaveCount(0);

  await page.getByRole('button', { name: 'Start main' }).click();
  await expect(page.getByRole('dialog', { name: 'BluePlay – World' })).toBeVisible();
});

test('GUI-73 the terminal split resize handle stays behind the BluePlay world window', async ({ page }) => {
  await loadBluePlay(page);
  await page.getByLabel('Show terminal', { exact: true }).click();
  await page.getByLabel('Split terminal to the right').click();
  // The handle lives in the terminal's stacking layer (GUI-99), which is below the world window.
  await expect(page.locator('.terminal-modal .terminal-split-divider')).toHaveCount(1);
  const terminalZ = await page.locator('.terminal-modal').evaluate((el) => getComputedStyle(el).zIndex);
  const stageZ = await page.locator('.stage-window').evaluate((el) => getComputedStyle(el).zIndex);
  expect(Number(terminalZ)).toBeLessThan(Number(stageZ));
});

test('GUI-82 inherited BluePlay methods are visible without scrolling the context menu', async ({ page }) => {
  const stage = await loadBluePlay(page);
  await stage.getByRole('button', { name: 'Close BluePlay world' }).click();
  const entry = page.locator('.codepad textarea');
  await entry.fill('MyWorld()');
  await entry.press('Enter');
  const result = page.locator('.codepad-entry').last();
  await result.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('myWorld1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();

  const object = page.locator('.bench .object').filter({ hasText: 'myWorld1' });
  await object.click({ button: 'right' });
  const popup = page.locator('.popup');
  const superclass = popup.locator('.popup-submenu-trigger', { hasText: 'inherited from World' });
  await superclass.hover();
  const submenu = popup.locator('.popup-submenu-panel');
  await expect(submenu).toBeVisible();
  await expect(submenu.locator('.method-menu-item').filter({ hasText: 'show()' })).toBeVisible();
  await expect(submenu.locator('.method-menu-item').filter({ hasText: 'addObject' })).toBeVisible();
  await expect(popup).toHaveCSS('overflow-x', 'visible');

  const box = await submenu.boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  if (!box) throw new Error('Inherited-method submenu bounds unavailable');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

  // The panel is as wide as its longest signature, so no entry needs horizontal scrolling.
  const overflow = await submenu.evaluate((el) => ({
    scrollLeft: el.scrollLeft,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(overflow.scrollLeft).toBe(0);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  const longest = submenu.locator('.method-menu-item').filter({ hasText: 'getObjectsAt(x: Int, y: Int): List<Actor>' });
  const longestBox = (await longest.boundingBox())!;
  expect(longestBox.x).toBeGreaterThanOrEqual(box.x);
  expect(longestBox.x + longestBox.width).toBeLessThanOrEqual(box.x + box.width);
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
  await input.fill('val smallWorld = World(100, 100, 1); smallWorld.show()');
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
  await input.fill('val wideWorld = World(1000, 100, 1); wideWorld.show()');
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
  await input.fill('val fullWorld = World(100, 100, 1); fullWorld.show()');
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

test('GUI-94 BluePlay Reset preserves maximized and restored window sizes', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const canvas = stage.locator('.game-stage');
  // The canvas is drawn on the next animation frame, after the window appears.
  await expect(canvas).toHaveAttribute('width', '600');
  const originalWorldWidth = await canvas.getAttribute('width');
  const input = page.getByLabel('Codepad input');
  await input.fill('val resetProbeWorld = World(100, 100, 1); resetProbeWorld.show()');
  await input.press('Enter');
  await expect(canvas).toHaveAttribute('width', '100');
  await stage.getByRole('button', { name: 'Maximize BluePlay world', exact: true }).click();
  const maximizedBounds = (await stage.boundingBox())!;

  await stage.getByRole('button', { name: 'Reset BluePlay world', exact: true }).click();
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await expect(canvas).toHaveAttribute('width', originalWorldWidth!);
  await expect(stage.getByRole('button', { name: 'Restore BluePlay world', exact: true })).toBeVisible();
  expect(await stage.boundingBox()).toEqual(maximizedBounds);

  await stage.getByRole('button', { name: 'Restore BluePlay world', exact: true }).click();
  const restoredBounds = (await stage.boundingBox())!;
  await stage.getByRole('button', { name: 'Act once', exact: true }).click();
  await stage.getByRole('button', { name: 'Reset BluePlay world', exact: true }).click();
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await expect(stage.getByRole('button', { name: 'Maximize BluePlay world', exact: true })).toBeVisible();
  expect(await stage.boundingBox()).toEqual(restoredBounds);
});

test('RT-11 Run stays active, Pause stops it, and speed can be dragged during Run', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const run = stage.getByRole('button', { name: 'Run BluePlay world' });
  const pause = stage.getByRole('button', { name: 'Pause BluePlay world' });
  // Act, Run, Reset from left to right; Run turns into Pause; sizes never change.
  const buttons = stage.locator('.game-buttons button');
  const names = ['Act once', 'Run BluePlay world', 'Reset BluePlay world'];
  await expect(buttons).toHaveCount(3);
  for (const [index, name] of names.entries()) await expect(buttons.nth(index)).toHaveAccessibleName(name);
  const sizes = () => buttons.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return `${Math.round(box.width)}x${Math.round(box.height)}`;
  }));
  const pausedSizes = await sizes();
  expect(new Set(pausedSizes).size).toBe(1);
  await expect(pause).toHaveCount(0);
  await run.click();
  await expect(stage).toHaveAttribute('data-simulation', 'running');
  await expect(stage.locator('.game-stage')).toBeFocused();
  await expect(run).toHaveCount(0);
  await expect(buttons.nth(1)).toHaveAccessibleName('Pause BluePlay world');
  await expect(pause).toBeEnabled();
  await expect(buttons.nth(0)).toBeDisabled();
  await expect(buttons.nth(2)).toBeDisabled();
  expect(await sizes()).toEqual(pausedSizes);

  const slider = stage.locator('input[type="range"]');
  const sliderBox = (await slider.boundingBox())!;
  await page.mouse.move(sliderBox.x + sliderBox.width * 0.25, sliderBox.y + sliderBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sliderBox.x + sliderBox.width * 0.85, sliderBox.y + sliderBox.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(Number(await slider.inputValue())).toBeGreaterThan(70);

  await pause.click();
  await expect(stage).toHaveAttribute('data-simulation', 'paused');
  await expect(pause).toHaveCount(0);
  await expect(run).toBeEnabled();
  expect(await sizes()).toEqual(pausedSizes);
});

test('PERF-01 Space Invaders advances in coherent frames while a key is held', async ({ page }) => {
  // Match the reported scenario without changing the shipped example.
  await page.route('**/examples/space-invaders.bluek.json', async route => {
    const response = await route.fetch();
    const project = await response.json();
    for (const file of project.files) file.source = file.source.replaceAll('x -= 5', 'x -= 1').replaceAll('x += 5', 'x += 1');
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
  await input.fill('val clickWorld = MyWorld(); val clickActor = Figure(); clickWorld.addObject(clickActor, 100, 100); clickWorld.show()');
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

test('GUI-69 standard graphics are available everywhere and a missing name is reported', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const input = page.getByLabel('Codepad input');
  const entries = page.locator('.codepad-entry');

  // A graphic BlueK ships with, used without importing anything into the project.
  await input.fill('Image("duck.png").width > 1 && Image("pizza.png").height > 1');
  await input.press('Enter');
  await expect(entries).toHaveCount(2);
  await expect(entries.last()).toContainText('true');

  // The stage draws it, so the standard graphics reach the renderer as well.
  await input.fill('val duckWorld = MyWorld(); val duck = Figure(); duck.image = Image("duck.png"); duckWorld.addObject(duck, 100, 100); duckWorld.show()');
  await input.press('Enter');
  await expect(entries).toHaveCount(3);
  await expect(stage).toBeVisible();
  const drawn = await stage.locator('.game-stage').evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')!;
    const scaleX = element.width / 600, scaleY = element.height / 400;
    const data = context.getImageData(
      Math.round(80 * scaleX), Math.round(80 * scaleY),
      Math.round(40 * scaleX), Math.round(40 * scaleY),
    ).data;
    let coloured = 0;
    for (let index = 0; index < data.length; index += 4)
      if (data[index] < 235 || data[index + 1] < 235 || data[index + 2] < 235) coloured += 1;
    return coloured;
  });
  expect(drawn).toBeGreaterThan(50);

  // A typo must fail loudly instead of leaving an invisible placeholder.
  await input.fill('val missing = Image("duckk.png")');
  await input.press('Enter');
  await expect(entries).toHaveCount(4);
  await expect(entries.last()).toContainText('Image file not found: duckk.png');
  await expect(entries.last()).toContainText("images/");
});

// The pixel masks of the standard graphics are generated at build time; a
// mismatch would make pixel-perfect clicks and isTouching wrong for them.
test('GUI-70 generated masks of the standard graphics match the browser', async ({ page }) => {
  await page.goto('/');
  expect(STANDARD_IMAGES.length).toBeGreaterThan(20);
  for (const entry of STANDARD_IMAGES) {
    const decoded = await page.evaluate(async (data) => {
      const image = new Image();
      await new Promise((resolve) => { image.onload = resolve; image.src = data; });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let alpha = '';
      for (let index = 3; index < pixels.length; index += 4) alpha += pixels[index].toString(16).padStart(2, '0');
      return { alpha, width: canvas.width, height: canvas.height };
    }, entry.data);
    expect(decoded.width, entry.path).toBe(entry.imageWidth);
    expect(decoded.height, entry.path).toBe(entry.imageHeight);
    expect(decoded.alpha, entry.path).toBe(entry.alphaHex);
  }
});


test('GUI-91 BluePlay help contains the exact reference API and stays compact', async ({ page }) => {
  await loadBluePlay(page);
  await page.getByRole('button', { name: 'Close BluePlay world' }).click();
  const required: Record<string, string[]> = {
    World: ['World(width: Int, height: Int, cellSize: Int)', 'fun allObjects(): List<Actor>', 'fun getObjects<T : Actor>(): List<T>', 'var background: Image'],
    Actor: ['val world: World', 'var image: Image?', 'fun turnTowards(x: Int, y: Int)', 'fun getOneIntersecting<T : Actor>(): T?'],
    Image: ['Image(width: Int, height: Int)', 'Image(fileName: String)', 'Image(other: Image)', 'fun fillRect(x: Int, y: Int, w: Int, h: Int)', 'fun scale(width: Int, height: Int)'],
    BluePlayFunctions: ['fun isKeyDown(key: String): Boolean', 'fun playSound(fileName: String)', 'fun step()'],
  };
  for (const [name, signatures] of Object.entries(required)) {
    await page.locator(`.classcard[aria-label="${name}"]`).dblclick();
    const help = page.getByRole('dialog', { name: `${name} API` });
    await expect(help).toBeVisible();
    for (const signature of signatures) await expect(help).toContainText(signature);
    await expect(help.locator('a, pre')).toHaveCount(0);
    await expect(help).not.toContainText(/showWorld|setImage|setLocation|drawingJson|Example/);
    expect(await help.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(help.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
    if (name === 'Image') await page.screenshot({ path: '/tmp/blueplay-api-desktop.png' });
    await help.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByLabel('Dark mode', { exact: true }).check();
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('.classcard[aria-label="Actor"]').dblclick();
  const darkHelp = page.getByRole('dialog', { name: 'Actor API' });
  await expect(darkHelp.locator('code').first()).toHaveCSS('color', 'rgb(145, 194, 241)');
  await page.screenshot({ path: '/tmp/blueplay-api-dark.png' });
  await darkHelp.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.classcard[aria-label="World"]').dblclick();
  const help = page.getByRole('dialog', { name: 'World API' });
  await expect(help).toBeVisible();
  expect(await help.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await help.locator('.blueplay-api-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(help.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  await page.screenshot({ path: '/tmp/blueplay-api-mobile.png' });
});

test('GUI-103 World.show() from the codepad reopens a closed world window every time', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const input = page.getByLabel('Codepad input');
  await input.fill('val codepadWorld = World(100, 100, 1); codepadWorld.show()');
  await input.press('Enter');
  await expect(input).toBeEnabled();
  for (let round = 0; round < 3; round += 1) {
    await expect(stage).toBeVisible();
    await stage.getByRole('button', { name: 'Close BluePlay world' }).click();
    await expect(stage).toBeHidden();
    // Other codepad calls keep a closed window closed.
    await input.fill('codepadWorld.width');
    await input.press('Enter');
    await expect(input).toBeEnabled();
    await expect(stage).toBeHidden();
    await input.fill('codepadWorld.show()');
    await input.press('Enter');
    await expect(input).toBeEnabled();
  }
  await expect(stage).toBeVisible();
});

/** A short silent PCM WAV, decodable by every browser. */
function silentWav(samples = 800) {
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + samples * 2, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}

test('GUI-131 the Audio dialog adds, previews and removes sounds; playSound() plays project and standard sounds', async ({ page }) => {
  // Count started sound playbacks; audible output itself cannot be checked here.
  await page.addInitScript(() => {
    const started = { buffers: 0 };
    (window as unknown as { soundsStarted: typeof started }).soundsStarted = started;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      started.buffers += 1;
      return start.apply(this, args);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: /^BluePlay Example/ }).click();
  await expect(page.locator('.classcard[aria-label="World"]')).toBeVisible();
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  const audio = page.getByRole('dialog', { name: 'Audio' });
  await expect(audio).toContainText('WAV or MP3');
  const chooser = audio.getByLabel('Add sound');

  // Unsupported, oversized and broken files are rejected with a reason.
  await chooser.setInputFiles([
    { name: 'theme.ogg', mimeType: 'audio/ogg', buffer: Buffer.from('OggS') },
    { name: 'long.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(1024 * 1024 + 1) },
    { name: 'broken.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('not a sound') },
  ]);
  const error = audio.getByRole('alert');
  await expect(error).toContainText('theme.ogg is not a WAV or MP3 file.');
  await expect(error).toContainText('long.wav is larger than 1 MB.');
  await expect(error).toContainText('broken.mp3 could not be read as a sound.');
  await expect(audio).toContainText('Your project has no sounds of its own yet.');

  const standard = audio.getByRole('list', { name: 'Standard sounds' });
  await expect(standard.getByRole('listitem')).toHaveCount(STANDARD_SOUNDS.length);
  await expect(standard.getByRole('button', { name: /^Remove / })).toHaveCount(0);
  await expect(standard).toContainText('explosion.wav');

  await chooser.setInputFiles({ name: 'pop.wav', mimeType: 'audio/wav', buffer: silentWav() });
  const list = audio.getByRole('list', { name: 'Project sounds' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('pop.wav');
  await expect(list).toContainText('2 KB');
  await expect(error).toHaveCount(0);
  await audio.getByRole('button', { name: 'Play pop.wav' }).click();
  await expect(audio.getByRole('button', { name: /^(Stop|Play) pop\.wav$/ })).toBeVisible();
  await audio.getByRole('button', { name: 'Close', exact: true }).click();

  // The new resource needs a compile; then playSound works without a shown world.
  const startMain = page.getByRole('button', { name: 'Start main', exact: true });
  await expect(startMain).toBeDisabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(startMain).toBeEnabled();
  const input = page.getByLabel('Codepad input');
  const entries = page.locator('.codepad-entry');
  await expect(input).toBeEnabled();
  await input.fill('playSound("pop.wav"); playSound("sounds/pop.wav")');
  await input.press('Enter');
  await expect(entries).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { soundsStarted: { buffers: number } }).soundsStarted.buffers)).toBe(2);

  await input.fill('playSound("popp.wav")');
  await input.press('Enter');
  await expect(entries).toHaveCount(2);
  await expect(entries.last()).toContainText("Sound file not found: popp.wav (expected e.g. in the folder 'sounds/'). Available: beep.wav, cat.wav,");

  // BluePlay's standard sounds play without being part of the project.
  await input.fill('playSound("explosion.wav")');
  await input.press('Enter');
  await expect(entries).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => (window as unknown as { soundsStarted: { buffers: number } }).soundsStarted.buffers)).toBe(3);

  // The sound is part of the saved project and can be removed after confirmation.
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  page.once('dialog', (confirmation) => confirmation.dismiss());
  await audio.getByRole('button', { name: 'Remove pop.wav' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  page.once('dialog', (confirmation) => {
    expect(confirmation.message()).toBe('Remove the sound pop.wav from the project?');
    void confirmation.accept();
  });
  await audio.getByRole('button', { name: 'Remove pop.wav' }).click();
  await expect(audio).toContainText('Your project has no sounds of its own yet.');
  await page.keyboard.press('Escape');
  await expect(audio).toHaveCount(0);
});

test('GUI-132 own sounds can be renamed, keeping their file type; standard sounds cannot', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: /^BluePlay Example/ }).click();
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  const audio = page.getByRole('dialog', { name: 'Audio' });
  await audio.getByLabel('Add sound').setInputFiles([
    { name: 'pop.wav', mimeType: 'audio/wav', buffer: silentWav() },
    { name: 'click.wav', mimeType: 'audio/wav', buffer: silentWav(400) },
  ]);
  const own = audio.getByRole('list', { name: 'Project sounds' });
  await expect(own.getByRole('listitem')).toHaveCount(2);
  await expect(audio.getByRole('list', { name: 'Standard sounds' }).getByRole('button', { name: /^Rename / })).toHaveCount(0);

  const rename = async (current: string, answer: string | null) => {
    page.once('dialog', (prompt) => {
      expect(prompt.message()).toBe(`New name for ${current}:`);
      expect(prompt.defaultValue()).toBe(current);
      void (answer === null ? prompt.dismiss() : prompt.accept(answer));
    });
    await audio.getByRole('button', { name: `Rename ${current}`, exact: true }).click();
  };
  const error = audio.getByRole('alert');

  // Refused names leave the sound unchanged and explain why.
  await rename('pop.wav', 'pop.mp3');
  await expect(error).toHaveText('The file type cannot change; keep the extension .wav.');
  await rename('pop.wav', 'click.wav');
  await expect(error).toHaveText('The project already has a sound named click.wav.');
  await rename('pop.wav', 'sub/pop');
  await expect(error).toHaveText('sub/pop is not a valid file name.');
  await rename('pop.wav', '   ');
  await expect(error).toHaveText('A sound needs a name.');
  await rename('pop.wav', null);
  await expect(own).toContainText('pop.wav');

  // A name without extension keeps the file type; the old name is gone.
  await rename('pop.wav', ' boom ');
  await expect(error).toHaveCount(0);
  await expect(own.getByRole('listitem')).toHaveCount(2);
  await expect(own).toContainText('boom.wav');
  await expect(own).not.toContainText('pop.wav');
  await audio.getByRole('button', { name: 'Close', exact: true }).click();

  const startMain = page.getByRole('button', { name: 'Start main', exact: true });
  await expect(startMain).toBeDisabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(startMain).toBeEnabled();
  const input = page.getByLabel('Codepad input');
  const entries = page.locator('.codepad-entry');
  await input.fill('playSound("boom.wav")');
  await input.press('Enter');
  await expect(entries).toHaveCount(1);
  await expect(entries.last()).not.toContainText('Sound file not found');
  await input.fill('playSound("pop.wav")');
  await input.press('Enter');
  await expect(entries).toHaveCount(2);
  await expect(entries.last()).toContainText('Sound file not found: pop.wav');
});

test('GUI-133 own PNG/JPEG images are added, renamed and removed; PNG transparency and JPEG rectangles decide collisions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: /^BluePlay Template/ }).click();
  await expect(page.locator('.classcard[aria-label="World"]')).toBeVisible();
  // ring.png: only its top-left 10x10 pixels are opaque. wall.jpg: no transparency.
  const encoded = await page.evaluate(async () => {
    const make = (type: string, width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      draw(canvas.getContext('2d')!);
      return canvas.toDataURL(type, 0.9).split(',')[1];
    };
    return {
      ring: make('image/png', 40, 40, (context) => { context.fillStyle = '#d22'; context.fillRect(0, 0, 10, 10); }),
      wall: make('image/jpeg', 40, 40, (context) => { context.fillStyle = '#4a7'; context.fillRect(0, 0, 40, 40); }),
      wide: make('image/png', 2049, 4, (context) => { context.fillRect(0, 0, 2049, 4); }),
    };
  });
  const file = (name: string, mimeType: string, base64: string) => ({ name, mimeType, buffer: Buffer.from(base64, 'base64') });

  await page.getByRole('button', { name: 'Images', exact: true }).click();
  const images = page.getByRole('dialog', { name: 'Images' });
  await expect(images).toContainText('PNG or JPEG');
  await expect(images).toContainText('Your project has no images of its own yet.');
  const chooser = images.locator('input[type="file"]');
  await chooser.setInputFiles([
    file('anim.gif', 'image/gif', Buffer.from('GIF89a').toString('base64')),
    file('wide.png', 'image/png', encoded.wide),
    file('broken.png', 'image/png', Buffer.from('not an image').toString('base64')),
  ]);
  const error = images.getByRole('alert');
  await expect(error).toContainText('anim.gif is not a PNG or JPEG file.');
  await expect(error).toContainText('wide.png is larger than 2048 pixels per side.');
  await expect(error).toContainText('broken.png could not be read as an image.');

  await chooser.setInputFiles([file('ring.png', 'image/png', encoded.ring), file('wall.jpg', 'image/jpeg', encoded.wall)]);
  await expect(error).toHaveCount(0);
  await expect(images.getByRole('group', { name: 'ring.png' }).getByRole('img', { name: 'ring.png' })).toBeVisible();
  await expect(images.getByRole('group', { name: 'wall.jpg' })).toBeVisible();
  // Standard images can be seen but not renamed or removed.
  await expect(images.getByLabel('duck.png', { exact: true })).toBeVisible();
  await expect(images.getByRole('button', { name: 'Rename duck.png' })).toHaveCount(0);
  await expect(images.getByRole('button', { name: 'Remove duck.png' })).toHaveCount(0);

  const rename = (current: string, answer: string) => {
    page.once('dialog', (prompt) => {
      expect(prompt.message()).toBe(`New name for ${current}:`);
      void prompt.accept(answer);
    });
    return images.getByRole('button', { name: `Rename ${current}`, exact: true }).click();
  };
  await rename('wall.jpg', 'wall.png');
  await expect(error).toHaveText('The file type cannot change; keep the extension .jpg.');
  await rename('wall.jpg', 'ring.png');
  await expect(error).toHaveText('The file type cannot change; keep the extension .jpg.');
  await rename('wall.jpg', 'wall.jpeg'); // .jpg and .jpeg are the same type
  await expect(images.getByRole('group', { name: 'wall.jpeg' })).toBeVisible();
  await rename('wall.jpeg', 'block');
  await expect(images.getByRole('group', { name: 'block.jpeg' })).toBeVisible();

  page.once('dialog', (confirmation) => {
    expect(confirmation.message()).toBe('Remove the image ring.png from the project?');
    void confirmation.dismiss();
  });
  await images.getByRole('button', { name: 'Remove ring.png' }).click();
  await expect(images.getByRole('group', { name: 'ring.png' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(images).toHaveCount(0);

  // The template has no main, so the codepad compiles on first use.
  const input = page.getByLabel('Codepad input');
  const entries = page.locator('.codepad-entry');
  await expect(input).toBeEnabled();
  const evaluate = async (code: string, count: number) => {
    await input.fill(code);
    await input.press('Enter');
    await expect(entries).toHaveCount(count);
    return entries.last();
  };
  // Bounding boxes overlap only where ring.png is transparent: no collision.
  await expect(await evaluate('val world = World(200, 200, 1); val ring = Actor(); ring.image = Image("ring.png"); val block = Actor(); block.image = Image("block.jpeg"); world.addObject(ring, 50, 50); world.addObject(block, 85, 85); \"${Image("ring.png").width} ${Image("block.jpeg").height} ${ring.intersects(block)}\"', 1))
    .toContainText('"40 40 false"');
  // The opaque pixels of ring.png on the corner of the JPEG rectangle collide.
  await expect(await evaluate('ring.x = 120; ring.y = 120; ring.intersects(block)', 2)).toContainText('true');
  await expect(await evaluate('Image("wall.jpg")', 3)).toContainText('Image file not found: wall.jpg');

  // Removing the image after confirmation makes it unavailable after Compile.
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  page.once('dialog', (confirmation) => void confirmation.accept());
  await images.getByRole('button', { name: 'Remove ring.png' }).click();
  await expect(images.getByRole('group', { name: 'ring.png' })).toHaveCount(0);
  await images.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(await evaluate('Image("ring.png")', 1)).toContainText('Image file not found: ring.png');
});

test('GUI-135 the world window can only be closed while paused and reopens when Run starts', async ({ page }) => {
  const stage = await loadBluePlay(page);
  const close = stage.getByRole('button', { name: 'Close BluePlay world' });
  await expect(close).toBeEnabled();
  await stage.getByRole('button', { name: 'Run BluePlay world' }).click();
  await expect(stage).toHaveAttribute('data-simulation', 'running');
  await expect(close).toBeDisabled();
  await expect(close).toHaveAttribute('title', 'Pause the world to close it.');
  // Escape does not hide a running world either.
  await page.keyboard.press('Escape');
  await expect(stage).toBeVisible();

  await stage.getByRole('button', { name: 'Pause BluePlay world' }).click();
  await expect(stage).toHaveAttribute('data-simulation', 'paused');
  await expect(close).toBeEnabled();
  await close.click();
  await expect(stage).toHaveCount(0);

  // Run started from the codepad brings the closed world back, so it can be paused.
  const input = page.getByLabel('Codepad input');
  await input.fill('start()');
  await input.press('Enter');
  await expect(stage).toBeVisible();
  await expect(stage).toHaveAttribute('data-simulation', 'running');
  await expect(close).toBeDisabled();
  await stage.getByRole('button', { name: 'Pause BluePlay world' }).click();
  await expect(close).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(stage).toHaveCount(0);
});
