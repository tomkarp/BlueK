import { test, expect } from '@playwright/test';

for (const locale of ['en', 'de'] as const) {
  test(`DBG-21 ${locale} file-level values remain visible after input and refresh on Step`, async ({ page }) => {
    await page.addInitScript(language => localStorage.setItem('bluek-language', language), locale);
    const labels = locale === 'de'
      ? { input: 'Codepad-Eingabe', globals: 'Globale Variablen', locals: 'Lokale Variablen', step: 'Schritt', next: 'Als Nächstes: Main.kt, Zeile 8', open: 'globalBox öffnen', inspector: 'Objektinspektor', close: 'Schließen', continue: 'Weiter' }
      : { input: 'Codepad input', globals: 'Global variables', locals: 'Local variables', step: 'Step', next: 'Next: Main.kt, line 8', open: 'Open globalBox', inspector: 'Object inspector', close: 'Close', continue: 'Continue' };
    const payload = {
      format: 'bluek-project', version: 1,
      files: [
        { fileName: 'Main.kt', kind: 'functions', source: `val a = 5
var globalCounter = 1
val globalBox = Box()
fun tuwas() {
    val input = readln()
    val a = 7
    globalCounter += 1
    for (i in 1..2)
        println(input)
}` },
        { fileName: 'Box.kt', kind: 'class', source: 'class Box { val value = 9 }' },
      ],
    };
    await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
    await expect(page.getByLabel(labels.input)).toBeEnabled();
    await page.getByRole('button', { name: 'Main', exact: true }).dblclick();
    await page.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(7).click();
    await expect(page.locator('.cm-breakpoint-marker')).toHaveCount(1);
    await page.getByLabel(labels.input).fill('tuwas()');
    await page.getByLabel(labels.input).press('Enter');
    const terminalInput = page.locator('.terminal-window input');
    await expect(terminalInput).toBeEnabled();
    await terminalInput.fill('l');
    await terminalInput.press('Enter');
    const debug = page.locator('.debugger-window');
    const globals = debug.getByRole('region', { name: labels.globals, exact: true });
    const locals = debug.getByRole('region', { name: labels.locals, exact: true });
    const value = (section: typeof globals, name: string) => section.locator('dl>div')
      .filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${name}$`) }) }).locator('dd');
    await expect(value(globals, 'a')).toHaveText('5');
    await expect(value(locals, 'a')).toHaveText('7');
    await expect(value(locals, 'input')).toHaveText('"l"');
    await expect(value(globals, 'globalCounter')).toHaveText('1');
    await expect(globals.locator('dt')).toHaveText(['a', 'globalCounter', 'globalBox']);
    await debug.getByRole('button', { name: labels.step, exact: true }).click();
    await expect(debug).toContainText(labels.next);
    await expect(value(globals, 'globalCounter')).toHaveText('2');
    await globals.getByRole('button', { name: labels.open, exact: true }).click();
    const inspector = page.getByRole('dialog', { name: labels.inspector, exact: true });
    await expect(inspector.locator('.inspect-row').filter({ hasText: 'value : Int' }).locator('output')).toHaveText('9');
    await expect(inspector.locator('input,.inspect-edit')).toHaveCount(0);
    await inspector.getByRole('button', { name: labels.close, exact: true }).click();
    await debug.getByRole('button', { name: labels.continue, exact: true }).click();
    await expect(debug).toHaveCount(0);
    await expect(page.locator('.terminal-output pre')).toHaveText('l\nl\nl\n');
  });
}

test('DBG-22 automatic Codepad compilation registers every breakpoint before execution and after edits', async ({ page }) => {
  const payload = {
    format: 'bluek-project', version: 1,
    files: [{ fileName: 'Main.kt', kind: 'functions', source: `fun go() {
    val first = 1
    println(first)
}
fun second() {
    println(2)
}` }],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  const input = page.getByLabel('Codepad input');
  await expect(input).toBeEnabled();
  await page.getByRole('button', { name: 'Main', exact: true }).dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Main.kt' });
  for (const line of [2, 3, 6]) {
    await editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(line).click();
  }
  await expect(editor.locator('.cm-breakpoint-marker')).toHaveCount(3);
  const debug = page.locator('.debugger-window');
  for (let run = 0; run < 2; run++) {
    if (run) {
      await page.getByRole('button', { name: 'Hide terminal', exact: true }).click();
      await editor.locator('.cm-content').click();
      const mod = await page.evaluate(() => /Mac/.test(navigator.platform) ? 'Meta' : 'Control');
      await page.keyboard.press(mod + '+End');
      await page.keyboard.insertText('\n// changed source');
      await expect(editor.locator('.cm-content')).toContainText('// changed source');
      await expect(editor.locator('.cm-breakpoint-marker')).toHaveCount(3);
    }
    await input.fill('go(); second()');
    await input.press('Enter');
    for (const line of [2, 3, 6]) {
      await expect(debug).toContainText(`Next: Main.kt, line ${line}`);
      if (line === 3) await expect(debug.locator('.debug-variables')).toContainText('first');
      await debug.getByRole('button', { name: 'Continue', exact: true }).click();
    }
    await expect(debug).toHaveCount(0);
    await expect(page.locator('.terminal-output pre')).toHaveText('1\n2\n'.repeat(run + 1));
  }
});

test('DBG-01 a breakpoint starts debugging main and stepping follows a call', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [{
      fileName: 'Main.kt',
      kind: 'functions',
      source: `fun main() {
    val answer = twice(1)
    println(answer)
}
fun twice(n: Int): Int {
    val result = n * 2
    return result
}`,
    }],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await expect(page.getByRole('button', { name: /step by step/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.locator('.classcard[aria-label="Main"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await page.locator('.classcard[aria-label="Main"]').dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Main.kt' });
  const lineFour = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(4);
  await lineFour.click();
  await expect(lineFour.locator('.cm-breakpoint-marker')).toHaveCount(0);
  const lineTwo = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(2);
  await lineTwo.click();
  await expect(lineTwo.locator('.cm-breakpoint-marker')).toHaveCount(1);
  const plainBreakpointX = await lineTwo.locator('.cm-breakpoint-marker').evaluate((marker) => {
    const rect = marker.getBoundingClientRect();
    return rect.left + rect.width / 2;
  });
  const gutterCount = await editor.locator('.cm-gutters .cm-gutter').count();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 2');
  const stepInButton = page.locator('.debugger-window').getByRole('button', { name: 'Step in', exact: true });
  await expect(stepInButton).toBeEnabled();
  await expect(editor.locator('.editor-breakpoint')).toBeEnabled();
  await expect(editor.locator('.editor-comment')).toBeDisabled();
  await expect(editor.locator('.editor-format')).toBeDisabled();
  const lineThree = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(3);
  await lineThree.click();
  await expect(lineThree.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await lineThree.click();
  await expect(lineThree.locator('.cm-breakpoint-marker')).toHaveCount(0);
  await expect(page.locator('.cm-debug-current-line')).toHaveCount(1);
  await expect(editor.locator('.cm-gutters .cm-gutter')).toHaveCount(gutterCount);
  await expect(editor.locator('.cm-debug-arrow-marker')).toHaveCount(1);
  await expect(editor.locator('.cm-combined-debug-marker')).toHaveCount(1);
  const arrowPresentation = () => editor.locator('.cm-debug-arrow-marker').evaluate((arrow) => {
    const rect = arrow.getBoundingClientRect();
    const gutter = arrow.closest('.cm-breakpoint-gutter')!;
    const gutterRect = gutter.getBoundingClientRect();
    const rowRect = arrow.parentElement!.parentElement!.getBoundingClientRect();
    const point = arrow.parentElement!.querySelector<HTMLElement>('.cm-breakpoint-marker')!;
    const pointRect = point.getBoundingClientRect();
    const path = arrow.querySelector('path')!;
    return {
      width: rect.width,
      height: rect.height,
      arrowContainedInGutter: rect.left >= gutterRect.left - 0.5 && rect.right <= gutterRect.right + 0.5,
      arrowCenteredOnRow: Math.abs(rect.top + rect.height / 2 - (rowRect.top + rowRect.height / 2)) <= 0.15,
      filledArrow: path.getAttribute('fill') === 'currentColor' && !path.hasAttribute('stroke'),
      pointInsideArrowShaft: pointRect.left + pointRect.width / 2 > rect.left + 2
        && pointRect.left + pointRect.width / 2 < rect.left + 16,
      pointCenteredOnRow: Math.abs(pointRect.top + pointRect.height / 2 - (rowRect.top + rowRect.height / 2)) <= 0.15,
    };
  });
  await expect.poll(arrowPresentation).toEqual({
    width: 18,
    height: 18,
    arrowContainedInGutter: true,
    arrowCenteredOnRow: true,
    filledArrow: true,
    pointInsideArrowShaft: true,
    pointCenteredOnRow: true,
  });
  await expect.poll(() => editor.locator('.cm-combined-debug-marker .cm-breakpoint-marker').evaluate((marker) => {
    const rect = marker.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }).then((combinedX) => Math.abs(combinedX - plainBreakpointX))).toBeLessThan(0.5);
  const combinedOrder = () => editor.locator('.cm-combined-debug-marker').evaluate((marker) =>
    [...marker.children].map((child) => child.className),
  );
  await expect.poll(combinedOrder).toEqual(['cm-debug-arrow-marker', 'cm-breakpoint-marker']);
  const arrowMatchesHighlight = () => editor.evaluate((root) => {
    const arrow = root.querySelector<HTMLElement>('.cm-debug-arrow-marker');
    const highlight = root.querySelector<HTMLElement>('.cm-debug-current-line');
    if (!arrow || !highlight) return false;
    const arrowRect = arrow.getBoundingClientRect();
    const highlightRect = highlight.getBoundingClientRect();
    return Math.abs(
      arrowRect.top + arrowRect.height / 2 - (highlightRect.top + highlightRect.height / 2),
    ) < 0.15;
  });
  await expect.poll(arrowMatchesHighlight).toBe(true);
  const highlightMatchesLineTwo = () => editor.evaluate((root) => {
    const highlight = root.querySelector<HTMLElement>('.cm-debug-current-line');
    const lineTwo = root.querySelectorAll<HTMLElement>('.cm-content .cm-line')[1];
    return Boolean(highlight && lineTwo && Math.abs(highlight.getBoundingClientRect().top - lineTwo.getBoundingClientRect().top) < 2);
  });
  await expect.poll(highlightMatchesLineTwo).toBe(true);
  const outlinedArrowSize = await editor.locator('.cm-debug-arrow-marker').evaluate((arrow) => {
    const rect = arrow.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  await stepInButton.click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 6');
  await expect(stepInButton).toBeDisabled();
  await expect(editor.locator('.cm-debug-arrow-marker')).toHaveCount(1);
  await expect.poll(() => editor.locator('.cm-debug-arrow-marker').evaluate((arrow) => {
    const rect = arrow.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  })).toEqual(outlinedArrowSize);
  await expect(editor.locator('.cm-combined-debug-marker')).toHaveCount(0);
  await expect(page.locator('.debug-variables')).toContainText('n');
  await expect(page.locator('.debug-variables')).toContainText('1');

  await page.locator('.debugger-window').getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 7');
  await page.locator('.debugger-window').getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 3');
  await expect(page.locator('.debug-variables')).toContainText('answer');
  await expect(page.locator('.debug-variables')).toContainText('2');

  await page.locator('.debugger-window').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.debugger-window')).toHaveCount(0);
  await expect(page.locator('.cm-debug-current-line')).toHaveCount(0);
  await expect(page.locator('.cm-debug-arrow-marker')).toHaveCount(0);
  await expect(page.locator('.terminal-output pre')).toHaveText('2\n');
});

test('DBG-02 editor gutter breakpoints stop an ordinary main run', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [{ fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    println("first")\n    println("last")\n}' }],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.locator('.classcard').dblclick();
  const firstGutter = page.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(2);
  const lastGutter = page.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(3);
  await firstGutter.click();
  await lastGutter.click();
  await expect(firstGutter.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await expect(lastGutter.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await expect(firstGutter.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await expect(lastGutter.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 2');
  await expect(page.locator('.debugger-window').getByRole('button', { name: 'Step in', exact: true })).toBeDisabled();
  await page.locator('.debugger-window').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 3');
  await page.locator('.debugger-window').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.debugger-window')).toHaveCount(0);
  await expect(page.locator('.terminal-output pre')).toHaveText('first\nlast\n');
});

test('DBG-06 breakpoint dots stay horizontally aligned with two-digit line numbers', async ({ page }) => {
  const source = [
    'fun main() {',
    ...Array.from({ length: 10 }, (_, index) => `    println(${index + 1})`),
    '}',
  ].join('\n');
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [{ fileName: 'Main.kt', kind: 'functions', source }],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.locator('.classcard').dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Main.kt' });
  const firstBreakpoint = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(2);
  const twoDigitBreakpoint = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(10);
  await firstBreakpoint.click();
  await twoDigitBreakpoint.click();
  await expect(editor.locator('.cm-lineNumbers .cm-gutterElement').filter({ hasText: /^10$/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 2');
  await expect(editor.locator('.cm-combined-debug-marker')).toHaveCount(1);
  await expect(twoDigitBreakpoint.locator('.cm-breakpoint-marker')).toHaveCount(1);
  const dotGeometry = () => editor.evaluate((root) => {
    const combined = root.querySelector<HTMLElement>('.cm-combined-debug-marker .cm-breakpoint-marker');
    const standalone = root.querySelectorAll<HTMLElement>('.cm-breakpoint-gutter .cm-gutterElement .cm-breakpoint-marker')[1];
    if (!combined || !standalone) return null;
    const combinedRect = combined.getBoundingClientRect();
    const standaloneRect = standalone.getBoundingClientRect();
    const rowCenter = (marker: HTMLElement) => {
      const row = marker.closest('.cm-gutterElement')!.getBoundingClientRect();
      return row.top + row.height / 2;
    };
    return {
      combined: {
        center: combinedRect.left + combinedRect.width / 2,
        rowOffsetY: combinedRect.top + combinedRect.height / 2 - rowCenter(combined),
        width: combinedRect.width,
        height: combinedRect.height,
      },
      standalone: {
        center: standaloneRect.left + standaloneRect.width / 2,
        rowOffsetY: standaloneRect.top + standaloneRect.height / 2 - rowCenter(standalone),
        width: standaloneRect.width,
        height: standaloneRect.height,
      },
    };
  });
  await expect.poll(() => dotGeometry().then((dots) => Boolean(dots
    && Math.abs(dots.combined.center - dots.standalone.center) < 0.5
    && Math.abs(dots.combined.rowOffsetY) < 0.15
    && Math.abs(dots.standalone.rowOffsetY) < 0.15
    && Math.abs(dots.combined.width - dots.standalone.width) < 0.5
    && Math.abs(dots.combined.height - dots.standalone.height) < 0.5))).toBe(true);
  const dotsHaveMatchingFlatStyle = () => editor.evaluate((root) => {
    const combined = root.querySelector<HTMLElement>('.cm-combined-debug-marker .cm-breakpoint-marker');
    const standalone = root.querySelectorAll<HTMLElement>('.cm-breakpoint-gutter .cm-gutterElement .cm-breakpoint-marker')[1];
    if (!combined || !standalone) return false;
    const styleOf = (marker: HTMLElement) => {
      const style = getComputedStyle(marker);
      return [style.backgroundColor, style.borderRadius, style.boxShadow, style.textShadow, style.filter];
    };
    const combinedStyle = styleOf(combined);
    const standaloneStyle = styleOf(standalone);
    return combinedStyle.every((value, index) => value === standaloneStyle[index])
      && combinedStyle.slice(2).every((value) => value === 'none');
  });
  await expect.poll(dotsHaveMatchingFlatStyle).toBe(true);
  await page.locator('.debugger-window').getByRole('button', { name: 'Stop', exact: true }).click();
});

test('DBG-14 BluePlay simulation breakpoints pause on each game tick', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    library: { id: 'blueplay', version: 1 },
    files: [
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    val world = TestWorld()\n    world.show()\n}' },
      { fileName: 'TestWorld.kt', kind: 'class', source: 'class TestWorld : World(5, 5, 20) {\n    var ticks = 0\n    override fun act() {\n        ticks += 1\n        println("tick $ticks")\n    }\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();

  const worldCard = page.locator('.classcard[aria-label="TestWorld"]');
  await worldCard.dblclick();
  const worldEditor = page.getByRole('dialog', { name: 'Editor: TestWorld.kt' });
  const actLine = worldEditor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(4);
  await actLine.click();
  await expect(actLine.locator('.cm-breakpoint-marker')).toHaveCount(1);

  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  await expect(stage).toBeVisible();
  await expect(page.locator('.debugger-window')).toHaveCount(0);

  await stage.getByRole('button', { name: 'Act once', exact: true }).click();
  const debuggerWindow = page.locator('.debugger-window');
  await expect(debuggerWindow).toContainText('Next: TestWorld.kt, line 4');
  await debuggerWindow.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debuggerWindow).toContainText('Next: TestWorld.kt, line 5');
  await expect(debuggerWindow).toContainText('ticks');
  await expect(debuggerWindow).toContainText('1');
  await debuggerWindow.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(debuggerWindow).toHaveCount(0);
  await expect(page.locator('.terminal-output pre')).toContainText('tick 1');

  await stage.getByText('BluePlay – World', { exact: true }).click();
  await stage.getByRole('button', { name: 'Act once', exact: true }).click();
  await expect(debuggerWindow).toContainText('Next: TestWorld.kt, line 4');
  await actLine.click();
  await expect(actLine.locator('.cm-breakpoint-marker')).toHaveCount(0);
  await debuggerWindow.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(debuggerWindow).toHaveCount(0);
  await expect(page.locator('.terminal-output pre')).toContainText('tick 2');
});

test('DBG-15 releasing a game key while paused does not leave it held after Continue', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    library: { id: 'blueplay', version: 1 },
    files: [
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    val world = TestWorld()\n    world.addObject(Shooter(), 2, 2)\n    world.show()\n}' },
      { fileName: 'TestWorld.kt', kind: 'class', source: 'class TestWorld : World(5, 5, 20) {\n    override fun act() {}\n}' },
      { fileName: 'Shooter.kt', kind: 'class', source: 'class Shooter : Actor() {\n    var shots = 0\n    override fun act() {\n        if (isKeyDown("space")) {\n            shots += 1\n            println("shot")\n        }\n    }\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();

  const shooterCard = page.locator('.classcard[aria-label="Shooter"]');
  await shooterCard.dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Shooter.kt' });
  const shotLine = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(5);
  await shotLine.click();
  await expect(shotLine.locator('.cm-breakpoint-marker')).toHaveCount(1);

  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  await expect(stage).toBeVisible();
  await stage.getByRole('button', { name: 'Run BluePlay world', exact: true }).click();
  await expect(stage).toHaveAttribute('data-simulation', 'running');

  await page.keyboard.down('Space');
  const debuggerWindow = page.locator('.debugger-window');
  await expect(debuggerWindow).toContainText('Next: Shooter.kt, line 5');
  await page.keyboard.up('Space');
  await debuggerWindow.getByRole('button', { name: 'Continue', exact: true }).click();

  // With Space released during the pause, later ticks must not enter this body
  // or hit its breakpoint again. This catches a stale true key state.
  await expect(debuggerWindow).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(debuggerWindow).toHaveCount(0);
  await stage.getByText('BluePlay – World', { exact: true }).click();
  await stage.getByRole('button', { name: 'Pause BluePlay world', exact: true }).click();
  const output = await page.locator('.terminal-output pre').textContent();
  expect((output?.match(/shot/g) || []).length).toBe(1);
});

test('DBG-16 a click received while paused is delivered once after Continue', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    library: { id: 'blueplay', version: 1 },
    files: [
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    val world = TestWorld()\n    world.addObject(Clicker(), 2, 2)\n    world.show()\n}' },
      { fileName: 'TestWorld.kt', kind: 'class', source: 'class TestWorld : World(5, 5, 20) {\n    var ticks = 0\n    override fun act() {\n        ticks += 1\n    }\n}' },
      { fileName: 'Clicker.kt', kind: 'class', source: 'class Clicker : Actor() {\n    var clicks = 0\n    override fun act() {\n        if (isClicked) {\n            clicks += 1\n            println("clicked $clicks")\n        }\n    }\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();

  await page.locator('.classcard[aria-label="Clicker"]').dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Clicker.kt' });
  const clickLine = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(4);
  await clickLine.click();
  await expect(clickLine.locator('.cm-breakpoint-marker')).toHaveCount(1);

  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  await expect(stage).toBeVisible();
  await stage.getByRole('button', { name: 'Run BluePlay world', exact: true }).click();
  const debuggerWindow = page.locator('.debugger-window');
  await expect(debuggerWindow).toContainText('Next: Clicker.kt, line 4');

  const canvas = stage.getByRole('button', { name: 'BluePlay world', exact: true });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('BluePlay canvas is not visible.');
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  // The click lands while the actor is paused before checking isClicked.
  // Remove the stop marker so later ticks can prove the click was consumed.
  await clickLine.click();
  await expect(clickLine.locator('.cm-breakpoint-marker')).toHaveCount(0);
  await debuggerWindow.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(debuggerWindow).toHaveCount(0);
  await page.waitForTimeout(250);
  await expect(debuggerWindow).toHaveCount(0);
  await stage.getByRole('button', { name: 'Pause BluePlay world', exact: true }).click();

  const output = await page.locator('.terminal-output pre').textContent();
  expect((output?.match(/clicked 1/g) || []).length).toBe(1);
  expect((output?.match(/clicked /g) || []).length).toBe(1);
});

test('DBG-05 debug marker follows the reported row when stepping into another file at the same line number', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    val t: Tier = Tier()\n    t.bellen()\n}' },
      { fileName: 'Tier.kt', kind: 'class', source: 'class Tier {\n    var name = "Wuffi"\n\n    fun bellen() {\n        println(name)\n    }\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.locator('.classcard[aria-label="Main"]').dblclick();
  const mainEditor = page.getByRole('dialog', { name: 'Editor: Main.kt' });
  const constructorBreakpoint = mainEditor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(2);
  const callBreakpoint = mainEditor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(3);
  await constructorBreakpoint.click();
  await callBreakpoint.click();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await expect(constructorBreakpoint.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await expect(callBreakpoint.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 2');
  await page.locator('.debugger-window').getByRole('button', { name: 'Step in', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Tier.kt, line 2');
  const tierEditor = page.getByRole('dialog', { name: 'Editor: Tier.kt' });
  await tierEditor.getByRole('tab', { name: /Main\.kt/ }).click();
  await expect(mainEditor.locator('.cm-breakpoint-marker')).toHaveCount(2);
  await mainEditor.getByRole('tab', { name: /Tier\.kt/ }).click();
  const highlightedLine = tierEditor.locator('.cm-debug-current-line');
  const lineTwo = tierEditor.locator('.cm-content .cm-line').nth(1);
  await expect.poll(() => tierEditor.evaluate((root) => {
    const highlight = root.querySelector<HTMLElement>('.cm-debug-current-line');
    const sourceLine = root.querySelectorAll<HTMLElement>('.cm-content .cm-line')[1];
    return Boolean(highlight && sourceLine && Math.abs(
      highlight.getBoundingClientRect().top - sourceLine.getBoundingClientRect().top,
    ) < 1);
  })).toBe(true);
  await expect(highlightedLine).toHaveCount(1);
  await expect(lineTwo).toContainText('var name');
  await expect(tierEditor.locator('.cm-debug-arrow-marker')).toHaveCount(1);
  await page.locator('.debugger-window').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 3');
  await expect(mainEditor.locator('.cm-breakpoint-marker')).toHaveCount(2);
  await page.locator('.debugger-window').getByRole('button', { name: 'Stop', exact: true }).click();
});

test('DBG-07 Step over a constructor call stays in the calling function', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    val t: Tier = Tier()\n    t.bellen()\n}' },
      { fileName: 'Tier.kt', kind: 'class', source: 'class Tier {\n    var name = "Wuffi"\n    fun bellen() {\n        println(name)\n    }\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.locator('.classcard[aria-label="Main"]').dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Main.kt' });
  await editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(2).click();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 2');
  await page.locator('.debugger-window').getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 3');
  await page.locator('.debugger-window').getByRole('button', { name: 'Stop', exact: true }).click();
});

test('DBG-12 Step in pauses on a primary-constructor property assignment', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    val box = NamedBox("Bello")\n    println(box.value)\n}' },
      { fileName: 'NamedBox.kt', kind: 'class', source: 'class NamedBox(val name: String) {\n    val value = 1\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  const mainCard = page.locator('.classcard[aria-label="Main"]');
  const mainEditor = page.getByRole('dialog', { name: 'Editor: Main.kt' });
  await mainCard.dblclick();
  await mainEditor.locator('.cm-content .cm-line').nth(1).click({ position: { x: 10, y: 8 } });
  await mainEditor.getByRole('button', { name: 'Toggle breakpoint on current line' }).click();
  const namedBoxCard = page.locator('.classcard[aria-label="NamedBox"]');
  await namedBoxCard.dblclick();
  const namedBoxEditor = page.getByRole('dialog', { name: 'Editor: NamedBox.kt' });

  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 2');
  await expect(page.locator('.debugger-window').getByRole('button', { name: 'Step in', exact: true })).toBeEnabled();
  await page.locator('.debugger-window').getByRole('button', { name: 'Step in', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: NamedBox.kt, line 1');
  await expect(namedBoxEditor.locator('.cm-debug-current-line')).toHaveCount(1);
  const attributes = page.locator('[aria-label="Properties"]');
  await expect(attributes).toContainText('name');
  await expect(attributes).toContainText('value');
  await expect(attributes).toContainText('not initialized');
  const valueOutput = attributes.locator('.inspect-row').filter({ hasText: 'value : Int' }).locator('output');
  await expect(valueOutput).toHaveCSS('color', 'rgb(136, 136, 136)');

  await page.locator('.debugger-window').getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: NamedBox.kt, line 2');
  await expect(attributes).toContainText('"Bello"');
  await expect(attributes.locator('.inspect-row').filter({ hasText: 'name : String' }).locator('output')).not.toHaveCSS('color', 'rgb(136, 136, 136)');
  await page.locator('.debugger-window').getByRole('button', { name: 'Stop', exact: true }).click();
});

test('DBG-03 a method breakpoint works through the ordinary object menu without main', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [{ fileName: 'Counter.kt', kind: 'class', source: 'class Counter {\n    val name = "Wuffi"\n    val label: String\n        get() = "Tier: " + name\n    fun speak(n: Int) {\n        for (i in 1..3) {\n            println(n + i)\n        }\n    }\n}' }],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Compile', exact: true })).toBeEnabled();
  const card = page.locator('.classcard[aria-label="Counter"]');
  await card.dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Counter.kt' });
  const lineSeven = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(7);
  await lineSeven.click();
  await expect(lineSeven.locator('.cm-breakpoint-marker')).toHaveCount(1);

  await card.click({ button: 'right' });
  await page.locator('.popup').getByRole('button', { name: /Counter\(/ }).click();
  await page.locator('.create-object-dialog').getByRole('button', { name: 'Create', exact: true }).click();
  const object = page.locator('.bench .object');
  await expect(object).toHaveCount(1);
  await object.click({ button: 'right' });
  await page.locator('.popup').getByRole('button', { name: /speak\(n: Int\)/ }).click();
  const invoke = page.locator('.method-dialog');
  await invoke.getByLabel('n: Int', { exact: true }).fill('4');
  await invoke.getByRole('button', { name: 'Invoke', exact: true }).click();

  await expect(page.locator('.debugger-window')).toContainText('Next: Counter.kt, line 7');
  await expect(editor.locator('.cm-debug-current-line')).toHaveCount(1);
  await expect(editor.locator('.cm-debug-arrow-marker')).toHaveCount(1);
  const highlightMatchesLineSeven = () => editor.evaluate((root) => {
    const highlight = root.querySelector<HTMLElement>('.cm-debug-current-line');
    const lineSeven = root.querySelectorAll<HTMLElement>('.cm-content .cm-line')[6];
    return Boolean(highlight && lineSeven && Math.abs(highlight.getBoundingClientRect().top - lineSeven.getBoundingClientRect().top) < 2);
  });
  await expect.poll(highlightMatchesLineSeven).toBe(true);
  const variables = page.locator('.debugger-values[aria-label="Local variables"] .debug-variables');
  await expect(variables).toContainText('n');
  await expect(variables).toContainText('4');
  await expect(variables).toContainText('i');
  await expect(variables).toContainText('1');
  const attributes = page.locator('[aria-label="Properties"]');
  await expect(attributes).toContainText('name');
  await expect(attributes).toContainText('Wuffi');
  await expect(attributes).toContainText('label');
  await expect(attributes.locator('.inspect-row').filter({ hasText: 'label : String' })).toContainText('\"Tier: Wuffi\"');
  await expect(attributes.locator('input,.inspect-edit')).toHaveCount(0);
  await expect(page.locator('.sidebar')).not.toContainText('Variables');
  // Breakpoint controls are locked while paused, so Continue reaches the same
  // source line on the next loop iteration and then completes after the final one.
  await page.locator('.debugger-window').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Counter.kt, line 7');
  await page.locator('.debugger-window').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Counter.kt, line 7');
  await page.locator('.debugger-window').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.debugger-window')).toHaveCount(0);
  await expect(page.locator('.terminal-output pre')).toHaveText('5\n6\n7\n');
});

test('DBG-13 object inspector evaluates computed properties in debug mode and refreshes after steps', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [
      { fileName: 'Animal.kt', kind: 'class', source: 'class Animal {\n    var age = 0\n    val remaining: Int\n        get() = 100 - age\n}' },
    { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    val animal = Animal()\n    animal.age = 5\n    println(animal.remaining)\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  const editor = page.getByRole('dialog', { name: 'Editor: Main.kt' });
  await page.locator('.classcard[aria-label="Main"]').dblclick();
  const breakpoint = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(3);
  await breakpoint.click();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 3');

  await page.locator('.debug-variables').getByRole('button', { name: 'Open animal' }).click();
  const inspector = page.locator('.inspector');
  await expect(inspector.locator('.inspect-row').filter({ hasText: 'remaining' })).toContainText('100');
  await expect(inspector.getByRole('button', { name: 'Run getter for remaining' })).toHaveCount(0);
  await expect(page.locator('.debugger-window')).not.toContainText('100');
  const stepButton = page.locator('.debugger-window').getByRole('button', { name: 'Step', exact: true });
  await expect(stepButton).toBeEnabled();
  await stepButton.click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line 4');
  await expect(inspector.locator('.inspect-row').filter({ hasText: 'remaining' })).toContainText('95');
  await expect(inspector).toHaveClass(/window-active/);
  const inspectorAboveEditor = await page.evaluate(() => {
    const inspector = document.querySelector<HTMLElement>('.inspector.window-active');
    const editor = document.querySelector<HTMLElement>('.editor-modal');
    if (!inspector || !editor) return false;
    return Number(getComputedStyle(inspector).zIndex) > Number(getComputedStyle(editor).zIndex);
  });
  expect(inspectorAboveEditor).toBe(true);
  await page.locator('.debugger-window').getByRole('button', { name: 'Stop', exact: true }).click();
});

test('DBG-04 Pause stops a running loop at the next safe project step', async ({ page }) => {
  const payload = {
    format: 'bluek-project',
    version: 1,
    files: [{ fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    var i = 0\n    while (true) {\n        i += 1\n    }\n}' }],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.locator('.classcard[aria-label="Main"]')).toBeVisible();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const runningPanel = page.locator('.debugger-window');
  await expect(runningPanel).toHaveCount(0);
  await page.locator('.sidebar').getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: Main.kt, line', { timeout: 10000 });
  await page.locator('.debugger-window').getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.debugger-window')).toHaveCount(0);
});

test('DBG-18 integrated inspector refreshes getters, follows references and stays readonly', async ({ page }) => {
  const animalSource = `class Animal {
    var age = 0
    val name = "Wuffi"
    val friend = Friend()
    val remaining: Int
        get() = 100 - age
    val broken: Int
        get() = error("getter failure")
    fun birthday() {
        age = 5
        age = 15
        println(age)
    }
}`;
  const payload = {
    format: 'bluek-project', version: 1,
    files: [
      { fileName: 'Animal.kt', kind: 'class', source: animalSource },
      { fileName: 'Friend.kt', kind: 'class', source: 'class Friend { val name = "Buddy" }' },
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    val animal = Animal()\n    animal.birthday()\n    println("done")\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await page.locator('.classcard[aria-label="Animal"]').dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Animal.kt' });
  await editor.locator('.cm-content .cm-line').nth(9).click({ position: { x: 12, y: 8 } });
  await editor.getByRole('button', { name: 'Toggle breakpoint on current line', exact: true }).click();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const debug = page.locator('.debugger-window');
  await expect(debug).toContainText('Next: Animal.kt, line 10');
  const integrated = debug.locator('.debugger-inspector');
  const row = (name: string) => integrated.locator('.inspect-row').filter({ has: page.locator('span').filter({ hasText: new RegExp(`^${name} :`) }) });
  await expect(row('name').locator('output')).toHaveText('"Wuffi"');
  await expect(row('age').locator('output')).toHaveText('0');
  await expect(row('remaining').locator('output')).toHaveText('100');
  await expect(row('friend').locator('output')).toHaveText('<object>');
  await expect(row('friend').locator('output')).toHaveCSS('color', 'rgb(136, 136, 136)');
  await integrated.getByRole('button', { name: 'Open referenced object age', exact: true }).click();
  const ageInspector = page.getByRole('dialog', { name: 'Object inspector', exact: true });
  await expect(ageInspector.locator('.inspect-scalar-value')).toHaveText('0');
  await expect(ageInspector.locator('input,.inspect-edit')).toHaveCount(0);
  await ageInspector.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(integrated.locator('input,.inspect-edit')).toHaveCount(0);
  await expect(page.locator('.inspector')).toHaveCount(0);
  await integrated.getByRole('button', { name: 'Show error for broken' }).click();
  const error = page.locator('.inspector-error-dialog');
  await expect(error).toContainText('getter failure');
  await error.getByRole('button', { name: 'Close', exact: true }).click();
  await integrated.getByRole('button', { name: 'Open referenced object friend' }).click();
  const friend = page.getByRole('dialog', { name: 'Object inspector', exact: true });
  await expect(friend).toContainText('Buddy');
  await expect(friend.locator('input,.inspect-edit')).toHaveCount(0);
  await debug.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debug).toContainText('Next: Animal.kt, line 11');
  await expect(row('age').locator('output')).toHaveText('5');
  await expect(row('remaining').locator('output')).toHaveText('95');
  await debug.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debug).toContainText('Next: Animal.kt, line 12');
  await expect(row('remaining').locator('output')).toHaveText('85');
  await debug.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debug).toContainText('Next: Main.kt, line 4');
  await expect(integrated).toHaveCount(0);
  await debug.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(debug).toHaveCount(0);
  await expect(page.locator('.terminal-output pre')).toHaveText('15\ndone\n');
});

test('DBG-19 finishing a debugged tick resumes Run while Act once stays paused', async ({ page }) => {
  const payload = {
    format: 'bluek-project', version: 1, library: { id: 'blueplay', version: 1 },
    files: [
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() { TestWorld().show() }' },
      { fileName: 'TestWorld.kt', kind: 'class', source: 'class TestWorld : World(5, 5, 20) {\n    var ticks = 0\n    override fun act() {\n        ticks += 1\n        println("tick $ticks")\n    }\n}' },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await page.locator('.classcard[aria-label="TestWorld"]').dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: TestWorld.kt' });
  const breakpoint = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(4);
  await breakpoint.click();
  await expect(breakpoint.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  const debug = page.locator('.debugger-window');
  await stage.getByRole('button', { name: 'Run BluePlay world', exact: true }).click();
  await expect(debug).toContainText('Next: TestWorld.kt, line 4');
  await breakpoint.click();
  await expect(breakpoint.locator('.cm-breakpoint-marker')).toHaveCount(0);
  await debug.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debug).toContainText('Next: TestWorld.kt, line 5');
  await debug.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debug).toHaveCount(0);
  await expect(stage).toHaveAttribute('data-simulation', 'running');
  await expect(page.locator('.terminal-output pre')).toContainText('tick 2');
  // This callback only prints: no drawing has returned the world to the front.
  await stage.getByText('BluePlay – World', { exact: true }).click();
  await stage.getByRole('button', { name: 'Pause BluePlay world', exact: true }).click();
  await expect(stage).toHaveAttribute('data-simulation', 'paused');
  await page.getByRole('button', { name: 'Hide terminal', exact: true }).click();

  await breakpoint.click();
  await expect(breakpoint.locator('.cm-breakpoint-marker')).toHaveCount(1);
  await stage.getByRole('button', { name: 'Act once', exact: true }).click();
  await expect(debug).toContainText('Next: TestWorld.kt, line 4');
  await breakpoint.click();
  await debug.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debug).toContainText('Next: TestWorld.kt, line 5');
  const manualTick = await debug.locator('.inspect-row').filter({ hasText: 'ticks : Int' }).locator('output').textContent();
  await debug.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debug).toHaveCount(0);
  await expect(stage).toHaveAttribute('data-simulation', 'paused');
  await expect(page.locator('.terminal-output pre')).toContainText(`tick ${manualTick?.trim()}`);
  const output = await page.locator('.terminal-output pre').textContent();
  await page.waitForTimeout(150);
  await expect(page.locator('.terminal-output pre')).toHaveText(output || '');
});

test('DBG-20 BluePlay yields to breakpoint source and regains front and keyboard focus after drawing', async ({ page }) => {
  const source = `class TestWorld : World(6, 4, 30) {
    var ticks = 0
    var presses = 0
    override fun act() {
        ticks += 1
        if (isKeyDown("right")) presses += 1
        showText("tick $ticks keys $presses", 2, 2)
    }
}`;
  const payload = {
    format: 'bluek-project', version: 1, library: { id: 'blueplay', version: 1 },
    files: [
      { fileName: 'Main.kt', kind: 'functions', source: 'val world = TestWorld()\nfun main() { world.show() }' },
      { fileName: 'TestWorld.kt', kind: 'class', source },
    ],
  };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await page.locator('.classcard[aria-label="TestWorld"]').dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: TestWorld.kt' });
  await editor.locator('.cm-content .cm-line').nth(4).click({ position: { x: 12, y: 8 } });
  await editor.getByRole('button', { name: 'Toggle breakpoint on current line', exact: true }).click();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  const canvas = stage.getByRole('button', { name: 'BluePlay world', exact: true });
  const worldAboveEditor = () => page.evaluate(() => {
    const world = document.querySelector('.stage-window');
    const editor = document.querySelector('.editor-modal');
    return !!world && !!editor && Number(getComputedStyle(world).zIndex) > Number(getComputedStyle(editor).zIndex);
  });
  await expect.poll(worldAboveEditor).toBe(true);
  await expect(canvas).toBeFocused();

  await stage.getByRole('button', { name: 'Run BluePlay world', exact: true }).click();
  const debug = page.locator('.debugger-window');
  await expect(debug).toContainText('Next: TestWorld.kt, line 5');
  await expect(editor.locator('.cm-debug-current-line')).toHaveCount(1);
  await expect.poll(worldAboveEditor).toBe(false);
  // Automatic getter snapshots and a non-graphical step must not raise the world.
  await expect(debug.locator('.inspect-row').filter({ hasText: 'isClicked : Boolean' }).locator('output')).toHaveText('false');
  await expect.poll(worldAboveEditor).toBe(false);
  // The globals/receiver window can cover the editor's bottom action buttons.
  // Its gutter remains visible and offers the same breakpoint action.
  await editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(5).click();
  await expect(editor.locator('.cm-breakpoint-marker')).toHaveCount(0);
  await debug.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(debug).toContainText('Next: TestWorld.kt, line 6');
  await expect.poll(worldAboveEditor).toBe(false);
  await debug.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(debug).toHaveCount(0);
  await expect.poll(worldAboveEditor).toBe(true);
  await expect(canvas).toBeFocused();

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowRight');
  await stage.getByRole('button', { name: 'Pause BluePlay world', exact: true }).click();
  await expect(stage).toHaveAttribute('data-simulation', 'paused');
  const input = page.getByLabel('Codepad input', { exact: true });
  await input.fill('world.presses > 0');
  await input.press('Enter');
  await expect(page.getByRole('log', { name: 'Codepad history' })).toContainText('true');
});
