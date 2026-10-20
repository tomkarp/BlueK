import { test, expect } from '@playwright/test';

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
  await expect(editor.locator('.editor-breakpoint')).toBeDisabled();
  await expect(editor.locator('.editor-comment')).toBeDisabled();
  await expect(editor.locator('.editor-format')).toBeDisabled();
  const lineThree = editor.locator('.cm-breakpoint-gutter .cm-gutterElement').nth(3);
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
  await expect(twoDigitBreakpoint).toContainText('10');
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
  await tierEditor.getByRole('tab', { name: /Tier\.kt/ }).click();
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
  const attributes = page.locator('[aria-label="Attributes"]');
  await expect(attributes).toContainText('name');
  await expect(attributes).toContainText('value');
  await expect(attributes).toContainText('not initialized');

  await page.locator('.debugger-window').getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.locator('.debugger-window')).toContainText('Next: NamedBox.kt, line 2');
  await expect(attributes).toContainText('"Bello"');
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
  const variables = page.locator('.debugger-values[aria-label="Variables"] .debug-variables');
  await expect(variables).toContainText('n');
  await expect(variables).toContainText('4');
  await expect(variables).toContainText('i');
  await expect(variables).toContainText('1');
  const attributes = page.locator('[aria-label="Attributes of this"]');
  await expect(attributes).toContainText('name');
  await expect(attributes).toContainText('Wuffi');
  await expect(attributes).toContainText('label');
  await expect(attributes).toContainText('computed, getter not run');
  await expect(attributes).toContainText('Calculated properties are listed without running their getters.');
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
