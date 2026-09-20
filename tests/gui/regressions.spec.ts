import { test, expect, type Page } from '@playwright/test';

async function project(page: Page, source = '') {
  const payload = { format: 'bluek-project', version: 1, files: source
    ? [{ fileName: 'Hund.kt', kind: 'class', source }] : [] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
}

async function evaluate(page: Page, code: string) {
  const input = page.getByLabel('Codepad input');
  const entries = page.locator('.codepad-entry');
  const count = await entries.count();
  await input.fill(code);
  await input.press('Enter');
  await expect(entries).toHaveCount(count + 1);
  await expect(entries.last().locator('.codepad-error')).toHaveCount(0);
  return entries.last();
}

test('GUI-11 codepad works without Compile in an empty project', async ({ page }) => {
  await project(page);
  await evaluate(page, '1 + 2');
  await evaluate(page, 'val answer = 42');
  await evaluate(page, 'answer');
});

test('RT-04 original Timer sleeps and resumes while the UI remains interactive', async ({ page }) => {
  await project(page, `class Timer {
    var min: Int = 0
    var max: Int = 0
    fun starten() {
      val bis = if (max <= min) max else min + (0..(max - min)).random()
      for (i in 0 until bis) {
        try { Thread.sleep(1000) }
        catch (e: Exception) { e.printStackTrace() }
      }
      println("Timer abgelaufen!")
    }
  }`);
  await evaluate(page, 'val timer = Timer(); timer.min = 2; timer.max = 2');
  const input = page.getByLabel('Codepad input');
  await input.fill('timer.starten()');
  const started = Date.now();
  await input.press('Enter');
  await expect(input).toBeDisabled();
  await expect(page.getByLabel('Program active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  // A visible interactive dialog while still running proves this is not a busy wait.
  await expect(page.getByLabel('Program active', { exact: true })).toBeVisible();
  await expect(page.locator('.codepad-entry')).toHaveCount(1);
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('Timer abgelaufen!\n');
  expect(Date.now() - started).toBeGreaterThanOrEqual(2000);
  await expect(input).toBeEnabled();
  await expect(page.locator('.codepad-error')).toHaveCount(0);
  await evaluate(page, 'timer.min = 0; timer.max = 0; timer.starten()');
  await expect(page.locator('.terminal-output pre')).toHaveText('Timer abgelaufen!\nTimer abgelaufen!\n');
});

test('RT-04 reset cancels a sleeping program without stale output', async ({ page }) => {
  await project(page);
  const input = page.getByLabel('Codepad input');
  await input.fill('println("before sleep"); Thread.sleep(1000); println("stale output")');
  await input.press('Enter');
  await expect(page.locator('.terminal-output pre')).toHaveText('before sleep\n');
  await expect(input).toBeDisabled();
  await page.getByRole('button', { name: 'Reset runtime', exact: true }).click();
  await expect(input).toBeEnabled();
  await evaluate(page, 'println("after reset")');
  await page.waitForTimeout(1200);
  await expect(page.locator('.terminal-output pre')).toContainText('after reset');
  await expect(page.locator('.terminal-output pre')).not.toContainText('stale output');
  await expect(page.locator('.codepad-error')).toHaveCount(0);
});

test('GUI-45 restores the current project from browser storage', async ({ page }) => {
  await project(page, 'class Hund {}');
  await expect(page.locator('.classcard')).toHaveAttribute('aria-label', 'Hund');
  await page.goto('/');
  await expect(page.locator('.classcard')).toHaveAttribute('aria-label', 'Hund');
});

test('GUI-24 project statements fail before execution, marked in the editor; Codepad still runs statements', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Init.kt', kind: 'functions', source: 'fun initialize(): Int { println("MUST NOT RUN"); return 1 }\nval initialized = initialize()' },
    { fileName: 'Actions.kt', kind: 'functions', source: '// Add top-level Kotlin functions here\n  println("Hallo")' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  // The error belongs to Actions.kt, so its editor opens and marks the line.
  const editor = page.locator('.editor-dialog');
  await expect(editor.locator('.editor-header h3')).toHaveText('Actions.kt');
  await expect(editor.locator('.cm-bluek-error-line')).toContainText('println("Hallo")');
  await expect(editor.locator('.editor-diagnostics')).toContainText('Only declarations');
  await expect(page.getByRole('dialog', { name: 'Compiler errors' })).toHaveCount(0);
  await expect(page.locator('.terminal-window')).toHaveCount(0);
  // Compile-on-demand must not bypass a previously failed validation.
  await page.getByLabel('Codepad input').fill('println("bypass")');
  await page.getByLabel('Codepad input').press('Enter');
  await expect(editor.locator('.editor-diagnostics')).toContainText('Only declarations');
  await expect(page.locator('.terminal-window')).toHaveCount(0);
  await expect(page.locator('.codepad-entry')).toHaveCount(0);
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: /^Empty Project/ }).click();
  await expect(page.locator('.classcard')).toHaveCount(0);
  await evaluate(page, 'println("Hallo")');
  await expect(page.locator('.terminal-output pre')).toHaveText('Hallo\n');
});

test('GUI-25 editor does not open automatic code completion', async ({ page }) => {
  await project(page, 'class Hund {\n}');
  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog .cm-editor');
  await editor.click();
  await page.keyboard.type('prin');
  await expect(page.locator('.cm-tooltip-autocomplete')).toHaveCount(0);
});

test('GUI-25 editor uses four spaces for manual indentation', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog .cm-editor');
  await editor.click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Tab');
  await expect(editor.locator('.cm-line').first()).toHaveText('    class Hund {}');
});

test('GUI-26 Cmd/Ctrl-Shift-I auto-formats the complete file', async ({ page }) => {
  await project(page, 'class Hund {\nfun bellen() {\nprintln("Wuff")\n}\n}');
  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog .cm-editor');
  await editor.click();
  await page.keyboard.press('Control+Shift+I');
  await expect(editor.locator('.cm-line')).toHaveCount(5);
  await expect(editor.locator('.cm-line').nth(0)).toHaveText('class Hund {');
  await expect(editor.locator('.cm-line').nth(1)).toHaveText('    fun bellen() {');
  await expect(editor.locator('.cm-line').nth(2)).toHaveText('        println("Wuff")');
  await expect(editor.locator('.cm-line').nth(3)).toHaveText('    }');
  await expect(editor.locator('.cm-line').nth(4)).toHaveText('}');
});

test('GUI-26 Cmd-Shift-I also formats the complete file', async ({ page }) => {
  await project(page, 'class Hund {\nfun bellen() {\nprintln("Wuff")\n}\n}');
  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog .cm-editor');
  await editor.click();
  await page.keyboard.press('Meta+Shift+I');
  await expect(editor.locator('.cm-line').nth(1)).toHaveText('    fun bellen() {');
  await expect(editor.locator('.cm-line').nth(2)).toHaveText('        println("Wuff")');
});

test('GUI-27 editor window has maximize, close and format controls', async ({ page }) => {
  await project(page, 'class Hund {\nfun bellen() {\nprintln("Wuff")\n}\n}');
  await page.locator('.classcard').dblclick();
  const dialog = page.locator('.editor-dialog');
  await expect(dialog.getByRole('button', { name: 'Format Kotlin file' })).toHaveAttribute(
    'title',
    /Format Kotlin file \((Cmd|Ctrl)\+Shift\+I\)/,
  );
  await dialog.getByRole('button', { name: 'Format Kotlin file' }).click();
  await expect(dialog.locator('.cm-line').nth(1)).toHaveText('    fun bellen() {');
  await dialog.getByRole('button', { name: 'Maximize editor window' }).click();
  await expect(dialog).toHaveClass(/maximized/);
  await dialog.getByRole('button', { name: 'Close editor' }).click();
  await expect(dialog).toHaveCount(0);
});

test('GUI-34 failed formatting shows a dismissible error and clears it on retry', async ({ page }) => {
  await page.route('**/kotlin_fmt.wasm.br', (route) =>
    route.fulfill({ status: 200, body: 'not a wasm module' }),
  );
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  const dialog = page.locator('.editor-dialog');
  const format = dialog.getByRole('button', { name: 'Format Kotlin file' });
  await format.click();
  const error = dialog.getByRole('alert');
  await expect(error).toBeVisible();
  await expect(error.getByRole('button', { name: 'Close format error' })).toBeVisible();
  await error.getByRole('button', { name: 'Close format error' }).click();
  await expect(error).toHaveCount(0);
  await format.click();
  await expect(error).toBeVisible();
});

test('GUI-28 editor window can be moved and resized', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  const dialog = page.locator('.editor-dialog');
  const header = dialog.locator('.editor-header');
  const beforeMove = await dialog.boundingBox();
  const headerBox = await header.boundingBox();
  if (!beforeMove || !headerBox) throw new Error('Editor bounds unavailable');
  await page.mouse.move(headerBox.x + 100, headerBox.y + 15);
  await page.mouse.down();
  await page.mouse.move(headerBox.x + 180, headerBox.y + 75);
  await page.mouse.up();
  const afterMove = await dialog.boundingBox();
  expect(afterMove?.x).toBeGreaterThan(beforeMove.x + 50);
  expect(afterMove?.y).toBeGreaterThan(beforeMove.y + 50);
  const resize = dialog.locator('.editor-resize-se');
  const resizeBox = await resize.boundingBox();
  if (!resizeBox || !afterMove) throw new Error('Editor resize bounds unavailable');
  await page.mouse.move(resizeBox.x + 3, resizeBox.y + 3);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 100, resizeBox.y + 80);
  await page.mouse.up();
  const afterResize = await dialog.boundingBox();
  expect(afterResize?.width).toBeGreaterThan(afterMove.width + 50);
  expect(afterResize?.height).toBeGreaterThan(afterMove.height + 30);
});

test('GUI-38 editor uses 16px code font', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  await expect(page.locator('.editor-dialog .cm-content')).toHaveCSS('font-size', '16px');
});

test('GUI-39 editor font size is configurable in Settings', async ({ page }) => {
  await project(page, 'class Hund {\n}');
  await page.locator('.classcard').dblclick();
  await page.getByLabel('Settings', { exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const fontSize = settings.getByLabel('Editor font size');
  await expect(fontSize.locator('option')).toHaveCount(21);
  await expect(fontSize.locator('option').first()).toHaveAttribute('value', '10');
  await expect(fontSize.locator('option').last()).toHaveAttribute('value', '30');
  await fontSize.selectOption('18');
  await expect(page.locator('.editor-dialog .cm-content')).toHaveCSS('font-size', '18px');
  await expect(page.locator('.editor-dialog .cm-gutterElement').first()).toHaveCSS('font-size', '18px');
  await fontSize.selectOption('30');
  await expect.poll(() => page.locator('.editor-dialog').evaluate((editor) => {
    const gutterLines = [...editor.querySelectorAll('.cm-lineNumbers .cm-gutterElement')];
    const codeLines = [...editor.querySelectorAll('.cm-line')];
    return [0, 1].every((index) => {
      const gutter = gutterLines.find((node) => node.textContent?.trim() === String(index + 1));
      return gutter && codeLines[index] && Math.abs(gutter.getBoundingClientRect().top - codeLines[index].getBoundingClientRect().top) < 1;
    });
  })).toBe(true);
});

test('GUI-40 Settings and New File dialog stay above windows', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  for (const [button, dialogName, closeButton] of [['Settings', 'Settings', 'Close'], ['New File', 'Create New Kotlin File', 'Cancel']] as const) {
    await page.getByRole('button', { name: button, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('..')).toHaveCSS('z-index', '100');
    await dialog.getByRole('button', { name: closeButton, exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'New Functions', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'New File', exact: true }).click();
  const newFileDialog = page.getByRole('dialog', { name: 'Create New Kotlin File' });
  await newFileDialog.getByRole('radio', { name: 'Kotlin Functions' }).check();
  await newFileDialog.getByLabel('Name').fill('Actions');
  await newFileDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Actions', exact: true })).toBeVisible();
});

test('GUI-41 project and file dialogs stay above windows', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  const dialogs = [
    ['New Project', 'Create New Project', 'Cancel'],
    ['Open / Import', 'Open / Import', 'Cancel'],
    ['Save / Export', 'Save / Export', 'Cancel'],
    ['Files', 'Files', 'Close'],
  ] as const;
  for (const [button, dialogName, closeButton] of dialogs) {
    if (button === 'New Project') await page.getByRole('button', { name: button, exact: true }).click();
    else if (button === 'Files') await page.getByRole('button', { name: button, exact: true }).click();
    else await page.getByRole('button', { name: button, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('..')).toHaveCSS('z-index', '100');
    await dialog.getByRole('button', { name: closeButton, exact: true }).click();
  }
});

test('GUI-42 Escape does not close an editor window', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  await expect(page.locator('.editor-dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.editor-dialog')).toHaveCount(1);
});

test('GUI-29 editor uses terminal window chrome without a bottom gap', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  const dialog = page.locator('.editor-dialog');
  const header = dialog.locator('.editor-header');
  const editorHost = dialog.locator('.svelte-editor-host');
  await expect(header).toHaveCSS('cursor', 'move');
  await expect(dialog).toHaveCSS('background-color', 'rgb(245, 244, 241)');
  await expect(dialog).toHaveCSS('border-top-width', '2px');
  await expect(editorHost).toHaveCSS('margin-bottom', '0px');
  const dialogBox = await dialog.boundingBox();
  const editorBox = await editorHost.boundingBox();
  if (!dialogBox || !editorBox) throw new Error('Editor bounds unavailable');
  expect(dialogBox.y + dialogBox.height - (editorBox.y + editorBox.height)).toBeLessThan(30);
});

test('GUI-30 clicking editor or terminal brings that window to the front', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  await page.getByLabel('Show terminal', { exact: true }).click();
  const editorModal = page.locator('.editor-modal');
  const terminalModal = page.locator('.terminal-modal');
  await expect(terminalModal).toHaveClass(/window-active/);
  await expect(editorModal).not.toHaveClass(/window-active/);
  const editorHeader = editorModal.locator('.editor-header');
  const terminalHeader = terminalModal.locator('.terminal-header');
  const terminalHeaderBeforeMove = await terminalHeader.boundingBox();
  if (!terminalHeaderBeforeMove) throw new Error('Terminal header bounds unavailable');
  await page.mouse.move(terminalHeaderBeforeMove.x + 80, terminalHeaderBeforeMove.y + 12);
  await page.mouse.down();
  await page.mouse.move(terminalHeaderBeforeMove.x + 680, terminalHeaderBeforeMove.y + 12);
  await page.mouse.up();
  const editorHeaderBeforeClick = await editorHeader.boundingBox();
  if (!editorHeaderBeforeClick) throw new Error('Editor header bounds unavailable');
  await page.mouse.click(editorHeaderBeforeClick.x + 12, editorHeaderBeforeClick.y + 12);
  await expect(editorModal).toHaveClass(/window-active/);
  await expect(terminalModal).not.toHaveClass(/window-active/);
  const editorBoxAfterClick = await editorModal.locator('.editor-dialog').boundingBox();
  const editorHeaderBox = await editorHeader.boundingBox();
  if (!editorHeaderBox) throw new Error('Editor header bounds unavailable');
  await page.mouse.move(editorHeaderBox.x + 80, editorHeaderBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(editorHeaderBox.x - 250, editorHeaderBox.y + 12);
  await page.mouse.up();
  const terminalHeaderBox = await terminalHeader.boundingBox();
  if (!terminalHeaderBox || !editorBoxAfterClick) throw new Error('Window bounds unavailable');
  const terminalClickX = Math.max(terminalHeaderBox.x + 12, editorBoxAfterClick.x + editorBoxAfterClick.width + 12);
  await page.mouse.click(terminalClickX, terminalHeaderBox.y + 12);
  await expect(terminalModal).toHaveClass(/window-active/);
  await expect(editorModal).not.toHaveClass(/window-active/);
});

test('GUI-31 one editor window can stay open per project file', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {}' },
    { fileName: 'Katze.kt', kind: 'class', source: 'class Katze {}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByLabel('Hund', { exact: true }).dblclick();
  await page.getByLabel('Katze', { exact: true }).dblclick();
  await expect(page.locator('.editor-dialog')).toHaveCount(2);
  await expect(page.locator('.editor-dialog').filter({ hasText: 'Hund.kt' })).toHaveCount(1);
  await expect(page.locator('.editor-dialog').filter({ hasText: 'Katze.kt' })).toHaveCount(1);
});

test('GUI-32 editor and terminal share controls, minimum size and full frame handles', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  await page.getByLabel('Show terminal', { exact: true }).click();

  const editor = page.locator('.editor-dialog');
  const terminal = page.locator('.terminal-window');
  const editorButtons = editor.locator('.editor-header button');
  const terminalButtons = terminal.locator('.terminal-header button');
  await expect(editorButtons.nth(0)).toHaveText('□');
  await expect(editorButtons.nth(1).locator('svg.window-icon')).toHaveCount(1);
  await expect(editorButtons.nth(2)).toHaveText('×');
  await expect(terminalButtons.nth(0)).toHaveText('□');
  await expect(terminalButtons.nth(2)).toHaveText('×');
  await expect(terminalButtons.nth(1)).toHaveCSS('height', await terminalButtons.nth(0).evaluate((node) => getComputedStyle(node).height));

  await terminalButtons.nth(2).click();
  await expect(terminal).toHaveCount(0);
  for (const windowLocator of [editor]) {
    const west = windowLocator.locator('[class$="resize-w"]');
    const south = windowLocator.locator('[class$="resize-s"]');
    await expect(west).toHaveCSS('width', '24px');
    await expect(south).toHaveCSS('height', '24px');
    await expect(west).toHaveCSS('touch-action', 'none');
    const box = await windowLocator.boundingBox();
    const westBox = await west.boundingBox();
    if (!box || !westBox) throw new Error('Window resize bounds unavailable');
    await page.mouse.move(westBox.x + 12, westBox.y + 12);
    await page.mouse.down();
    await page.mouse.move(westBox.x + 600, westBox.y + 12);
    await page.mouse.up();
    const resized = await windowLocator.boundingBox();
    if (!resized) throw new Error('Window bounds unavailable after resize');
    expect(resized.width).toBeGreaterThanOrEqual(420);
    expect(resized.height).toBeGreaterThanOrEqual(260);
    const southBox = await south.boundingBox();
    if (!southBox) throw new Error('Window bottom resize bounds unavailable');
    await page.mouse.move(southBox.x + 12, southBox.y + 12);
    await page.mouse.down();
    await page.mouse.move(southBox.x + 12, southBox.y - 600);
    await page.mouse.up();
    const resizedHeight = await windowLocator.boundingBox();
    if (!resizedHeight) throw new Error('Window bounds unavailable after height resize');
    expect(resizedHeight.height).toBeGreaterThanOrEqual(260);
  }
  await page.getByLabel('Show terminal', { exact: true }).click();
  const terminalWest = terminal.locator('[class$="resize-w"]');
  const terminalSouth = terminal.locator('[class$="resize-s"]');
  const terminalWestBox = await terminalWest.boundingBox();
  if (!terminalWestBox) throw new Error('Terminal resize bounds unavailable');
  await page.mouse.move(terminalWestBox.x + 12, terminalWestBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(terminalWestBox.x + 600, terminalWestBox.y + 12);
  await page.mouse.up();
  const terminalResized = await terminal.boundingBox();
  if (!terminalResized) throw new Error('Terminal bounds unavailable after resize');
  expect(terminalResized.width).toBeGreaterThanOrEqual(420);
  expect(terminalResized.height).toBeGreaterThanOrEqual(260);
  const terminalSouthBox = await terminalSouth.boundingBox();
  if (!terminalSouthBox) throw new Error('Terminal bottom resize bounds unavailable');
  await page.mouse.move(terminalSouthBox.x + 12, terminalSouthBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(terminalSouthBox.x + 12, terminalSouthBox.y - 600);
  await page.mouse.up();
  const terminalResizedHeight = await terminal.boundingBox();
  if (!terminalResizedHeight) throw new Error('Terminal bounds unavailable after height resize');
  expect(terminalResizedHeight.height).toBeGreaterThanOrEqual(260);
});

test('GUI-33 editor windows can be collected into tabs and ungrouped again', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {}' },
    { fileName: 'Katze.kt', kind: 'class', source: 'class Katze {}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByLabel('Hund', { exact: true }).dblclick();
  await page.getByLabel('Katze', { exact: true }).dblclick();
  await expect(page.locator('.editor-dialog')).toHaveCount(2);
  await expect(page.locator('.editor-dialog:not(.editor-tabbed-dialog) .editor-window-controls').first()).toHaveCSS('gap', '4px');
  await expect(page.locator('.editor-dialog:not(.editor-tabbed-dialog) .editor-header').first()).toHaveCSS('margin-bottom', '0px');
  await page.getByLabel('Collect editor windows into tabs').last().click();
  await expect(page.locator('.editor-tabbed-dialog')).toHaveCount(1);
  await expect(page.locator('.editor-tabbed-dialog .editor-window-controls')).toHaveCSS('gap', '4px');
  await expect(page.locator('.editor-tabs [role="tab"]')).toHaveCount(2);
  const firstTab = page.locator('.editor-tabs [role="tab"]').first();
  const firstTabLabel = firstTab.locator('span').first();
  await expect(firstTab).toHaveCSS('flex-shrink', '1');
  const firstTabBox = await firstTab.boundingBox();
  const firstTabLabelBox = await firstTabLabel.boundingBox();
  if (!firstTabBox || !firstTabLabelBox) throw new Error('Tab bounds unavailable');
  expect(firstTabBox.width).toBeGreaterThan(firstTabLabelBox.width + 20);
  await page.locator('.editor-tabs [role="tab"]').filter({ hasText: 'Hund.kt' }).click();
  const activeTab = page.locator('.editor-tabs [role="tab"][aria-selected="true"]');
  await expect(activeTab).toHaveText(/Hund\.kt/);
  await expect(activeTab).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(activeTab).toHaveCSS('border-bottom-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.editor-tabbed-dialog .cm-content')).toContainText('class Hund {}');
  await page.getByLabel('Close Katze.kt').click();
  await expect(page.locator('.editor-tabbed-dialog')).toHaveCount(0);
  await expect(page.locator('.editor-dialog')).toHaveCount(1);
  await page.getByLabel('Katze', { exact: true }).dblclick();
  await page.getByLabel('Collect editor windows into tabs').last().click();
  await page.getByLabel('Ungroup editor tabs').click();
  await expect(page.locator('.editor-tabbed-dialog')).toHaveCount(0);
  await expect(page.locator('.editor-dialog')).toHaveCount(2);
  await page.getByLabel('Collect editor windows into tabs').last().click();
  await page.getByLabel('Close all editors').click();
  await expect(page.locator('.editor-dialog')).toHaveCount(0);
});

test('GUI-03 GUI-04 computed values update after every inspector edit', async ({ page }) => {
  await project(page, 'class Hund(var alter: Int = 1) { val steuer: Int get() = alter * 10 }');
  const entry = await evaluate(page, 'Hund()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  const computed = inspector.locator('.inspect-row').filter({ hasText: 'steuer :' }).locator('output');
  await expect(computed).toHaveText('10');
  for (const age of [2, 3, 7]) {
    await inspector.getByLabel('Edit alter', { exact: true }).click();
    await inspector.getByLabel('Value of alter').fill(String(age));
    await inspector.getByLabel('Value of alter').press('Enter');
    await expect(computed).toHaveText(String(age * 10));
  }
  await evaluate(page, 'hund1.alter = 9');
  await expect(computed).toHaveText('90');
});

test('GUI-48 private fields are readable and private setters stay visible but cannot be edited', async ({ page }) => {
  await project(page, 'class Timer { private val secret: Int = 7\nvar min: Int = 0\nprivate set }');
  const entry = await evaluate(page, 'Timer()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('timer1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  const privateRow = inspector.locator('.inspect-row').filter({ hasText: 'secret :' });
  await expect(privateRow).toHaveClass(/private-field/);
  await expect(privateRow).toHaveCSS('background-color', 'rgb(222, 222, 222)');
  await expect(privateRow.locator('output')).toHaveCSS('color', 'rgb(102, 102, 102)');
  const row = inspector.locator('.inspect-row').filter({ hasText: 'min :' });
  const edit = row.getByRole('button', { name: 'Edit min', exact: true });
  await expect(edit).toBeVisible();
  await expect(edit).toBeDisabled();
  await expect(edit).toHaveAttribute('title', 'The setter is private');
  await expect(edit).toHaveCSS('color', 'rgb(119, 119, 119)');
  await row.dblclick();
  await expect(row.getByLabel('Value of min')).toHaveCount(0);
});

test('GUI-49 context-menu method names stay on one line', async ({ page }) => {
  await project(page, 'class Timer { fun setzeSehrLangenBereich(neuesMinimum: Int, neuesMaximum: Int) {} }');
  const entry = await evaluate(page, 'Timer()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('timer1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').click({ button: 'right' });
  const method = page.locator('.method-menu-item').filter({ hasText: 'setzeSehrLangenBereich' });
  await expect(method).toBeVisible();
  await expect(method).toHaveCSS('white-space', 'nowrap');
  expect((await method.boundingBox())!.height).toBeLessThan(40);
});

test('GUI-07 every value can be placed on the bench', async ({ page }) => {
  await project(page);
  for (const [code, name, display] of [['5', 'zahl', '5 : Int'], ['"Hallo"', 'text', '"Hallo" : String']]) {
    const entry = await evaluate(page, code);
    await expect(entry.getByRole('button')).toBeEnabled();
    await expect(entry.getByRole('button')).toHaveText(display);
    await entry.getByRole('button').click();
    await page.getByLabel('Name of instance').fill(name);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.locator('.bench')).toContainText(name);
    const alias = await evaluate(page, name);
    await expect(alias.getByRole('button')).toHaveText(display);
  }
});

test('GUI-18 primitive inspectors show their type and the active inspector is on top', async ({ page }) => {
  await project(page);
  for (const [code, name] of [['5', 'zahl'], ['"Hallo"', 'text']]) {
    const entry = await evaluate(page, code);
    await entry.getByRole('button').click();
    await page.getByLabel('Name of instance').fill(name);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
  }
  const objects = page.locator('.bench .object');
  await objects.nth(0).dblclick();
  await objects.nth(1).dblclick();
  const inspectors = page.locator('.inspect-window');
  await expect(inspectors).toHaveCount(2);
  await expect(inspectors.nth(0).locator('h2')).toHaveText('zahl : Int');
  await expect(inspectors.nth(1).locator('h2')).toHaveText('text : String');
  await expect(inspectors.nth(0).locator('.inspect-no-fields')).toHaveText('No fields');
  await expect(inspectors.nth(1).locator('.inspect-no-fields')).toHaveText('No fields');
  const secondBox = (await inspectors.nth(1).boundingBox())!;
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + 16);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + secondBox.width / 2 + 300, secondBox.y + 216);
  await page.mouse.up();
  const zIndexes = await inspectors.evaluateAll((items) => items.map((item) => Number(getComputedStyle(item).zIndex)));
  expect(zIndexes[1]).toBeGreaterThan(zIndexes[0]);
  await page.keyboard.press('Escape');
  await expect(inspectors).toHaveCount(1);
});

test('GUI-19 codepad rows use uniform compact spacing without separator lines', async ({ page }) => {
  await project(page);
  await evaluate(page, '5');
  await evaluate(page, '3');
  const entries = page.locator('.codepad-entry');
  const rows = page.locator('.codepad-entry > div, .codepad-entry > button');
  await expect(rows).toHaveCount(4);
  const gaps = await rows.evaluateAll((items) => items.slice(1).map((item, index) => {
    const previous = items[index].getBoundingClientRect();
    const current = item.getBoundingClientRect();
    return current.top - previous.bottom;
  }));
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(3);
  for (let index = 0; index < await entries.count(); index++)
    await expect(entries.nth(index)).toHaveCSS('border-bottom-width', '0px');
});

test('GUI-20 long codepad values retain their type and reveal the full value on hover', async ({ page }) => {
  await project(page);
  const entry = await evaluate(page, `"${'a'.repeat(200)}"`);
  const result = entry.locator('.codepad-result, .codepad-object-label');
  const value = result.locator('.codepad-result-value');
  const full = await value.getAttribute('title');
  const visible = await result.textContent();
  const metrics = await value.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    textOverflow: getComputedStyle(element).textOverflow,
  }));
  expect(full).toContain(': String');
  expect(visible).toContain(': String');
  expect(metrics.clientWidth).toBeLessThan(metrics.scrollWidth);
  expect(metrics.textOverflow).toBe('ellipsis');
});

test('GUI-21 the same codepad object can be added under two reference names', async ({ page }) => {
  await project(page, 'class Hund {}');
  const entry = await evaluate(page, 'Hund()');
  for (const name of ['hund1', 'hund2']) {
    await entry.getByRole('button').click();
    await page.getByLabel('Name of instance').fill(name);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
  }
  await expect(page.locator('.bench .object')).toHaveCount(2);
  await expect(page.locator('.bench')).toContainText('hund1');
  await expect(page.locator('.bench')).toContainText('hund2');
  const objects = page.locator('.bench .object');
  await objects.nth(0).dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  await expect(inspector.locator('h2')).toHaveText('hund1 : Hund');
  await objects.nth(1).dblclick();
  await expect(page.locator('.inspect-window')).toHaveCount(1);
  await expect(inspector.locator('h2')).toHaveText('hund2 : Hund');
});

test('GUI-22 top actions are grouped, ordered and switch to icon-only mode together', async ({ page }) => {
  await project(page, 'class Hund {}');
  const actions = page.locator('.toolbar-main-action');
  await expect(actions).toHaveCount(4);
  await expect(actions.nth(0)).toHaveText(/New Project/);
  await expect(actions.nth(1)).toHaveText(/Open \/ Import/);
  await expect(actions.nth(2)).toHaveText(/Save \/ Export/);
  await expect(actions.nth(3)).toHaveText(/Files/);
  await actions.nth(1).click();
  const openDialog = page.getByRole('dialog', { name: 'Open / Import' });
  await expect(openDialog.locator('.project-dropzone')).toContainText('JSON');
  await expect(openDialog.locator('.project-dropzone')).toContainText('BlueJ ZIP');
  await expect(openDialog.locator('.project-dropzone')).toContainText('Project directory');
  await openDialog.getByRole('button', { name: 'Cancel' }).click();
  await actions.nth(2).click();
  const saveDialog = page.getByRole('dialog', { name: 'Save / Export' });
  await expect(saveDialog.getByRole('button', { name: /Project JSON/ })).toBeEnabled();
  await expect(saveDialog.getByRole('button', { name: /Full Project Link/ })).toBeEnabled();
  await expect(saveDialog.getByRole('button', { name: /BlueJ/ })).toBeDisabled();
  await expect(saveDialog.getByRole('button', { name: /Short Link/ })).toBeEnabled();
  await saveDialog.getByRole('button', { name: 'Cancel' }).click();
  await actions.nth(3).click();
  await expect(page.getByRole('dialog', { name: 'Files' })).toContainText('not implemented');
  await page.setViewportSize({ width: 800, height: 1000 });
  for (const action of await actions.all())
    await expect(action.locator('span:not(.toolbar-action-icon)')).toBeHidden();
});

test('GUI-23 Save / Export is disabled for an empty project', async ({ page }) => {
  await project(page);
  await expect(page.locator('.toolbar-main-action').nth(2)).toBeDisabled();
});

test('GUI-35 short project links can be saved and loaded', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Hund.kt', kind: 'class', source: 'class Hund {}' }] };
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST')
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ code: 'green-lamp-river', expiresAt: new Date(Date.now() + 86400000).toISOString() }) });
    else await route.continue();
  });
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Save / Export' }).click();
  await page.getByRole('dialog', { name: 'Save / Export' }).getByRole('button', { name: /Short Link/ }).click();
  const linkDialog = page.getByRole('dialog', { name: 'Short project link' });
  await expect(linkDialog.getByLabel('Three-word project code')).toHaveText('green-lamp-river');
  await expect(linkDialog.getByLabel('Complete project link')).toHaveText('http://127.0.0.1:5194/load/green-lamp-river');
});

test('GUI-43 loading a saved project clears the load URL', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Gespeichert.kt', kind: 'class', source: 'class Gespeichert {}' }] };
  await page.route('**/api/projects/green-lamp-river', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: payload }) });
  });
  await page.goto('/load/green-lamp-river');
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: /^BluePlay Template/ }).click();
  await expect(page.locator('.classcard').first()).toBeVisible();
});

test('GUI-50 loading a full project link clears the link URL', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Vollstaendig.kt', kind: 'class', source: 'class Vollstaendig {}' }] };
  const link = '/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
  await page.goto(link);
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await expect(page.locator('.classcard')).toContainText('Vollstaendig');
  await expect(page).toHaveURL(/\/$/);
});

test('GUI-44 Open / Import loads a shared project from three words', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Geteilt.kt', kind: 'class', source: 'class Geteilt {}' }] };
  await page.route('**/api/projects/green-lamp-river', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: payload }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open / Import', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Open / Import' });
  await dialog.getByLabel('Three-word project code').fill('green lamp river');
  await dialog.getByRole('button', { name: 'Load project', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.classcard')).toContainText('Geteilt');
});

test('GUI-05 history works immediately after execution and terminal output', async ({ page }) => {
  await project(page);
  for (const code of ['5', 'println("Hallo")']) {
    await evaluate(page, code);
    const input = page.getByLabel('Codepad input');
    await expect(input).toBeFocused();
    await input.press('ArrowUp');
    await expect(input).toHaveValue(code);
  }
});

test('GUI-01 new project offers all templates and can be cancelled', async ({ page }) => {
  await project(page);
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Project' });
  const choices = ['Empty Project', 'BluePlay Template', 'BluePlay Example', 'BlueK Demo Project', 'Space Invaders Demo']
    .map(name => dialog.getByRole('button', { name: new RegExp('^' + name) }));
  for (const choice of choices) await expect(choice).toBeEnabled();
  const boxes = await Promise.all(choices.map(choice => choice.boundingBox()));
  for (let index = 1; index < boxes.length; index++) {
    expect(boxes[index]!.y).toBeGreaterThan(boxes[index - 1]!.y);
    expect(Math.abs(boxes[index]!.x - boxes[0]!.x)).toBeLessThan(2);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('GUI-17 Escape cancels constructor and method parameter dialogs', async ({ page }) => {
  await project(page, 'class Hund(var alter: Int) { fun laufen(weite: Int) {} }');
  await evaluate(page, '1');
  await page.locator('.classcard').click({ button: 'right' });
  await page.locator('.constructor-menu-item').click();
  const constructorDialog = page.getByRole('dialog', { name: 'Create Hund' });
  await expect(constructorDialog).toBeVisible();
  await expect(constructorDialog.locator('input').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(constructorDialog).toBeHidden();

  const objectEntry = await evaluate(page, 'Hund(1)');
  await objectEntry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').click({ button: 'right' });
  await page.locator('.method-menu-item').first().click();
  const methodDialog = page.getByRole('dialog', { name: /hund1/ });
  await expect(methodDialog).toBeVisible();
  await expect(methodDialog.locator('input').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(methodDialog).toBeHidden();
});

test('GUI-02 constructor suggests numbered names', async ({ page }) => {
  await project(page, 'class Hund {}');
  await evaluate(page, '1');
  for (const name of ['hund1', 'hund2']) {
    await page.locator('.classcard').click({ button: 'right' });
    await page.locator('.constructor-menu-item').click();
    const dialog = page.getByRole('dialog', { name: 'Create Hund' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name of instance')).toHaveValue(name);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('.bench')).toContainText(name);
  }
});

for (const name of ['Empty Project']) {
  test(`GUI-01 creates ${name}`, async ({ page }) => {
    await project(page);
    await page.getByRole('button', { name: 'New Project', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create New Project' });
    await dialog.getByRole('button', { name: new RegExp('^' + name) }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.classcard')).toHaveCount(0);
  });
}

for (const name of ['BluePlay Template', 'BluePlay Example']) {
  test(`GUI-01 creates ${name} with the built-in library`, async ({ page }) => {
    await project(page);
    await page.getByRole('button', { name: 'New Project', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create New Project' });
    await dialog.getByRole('button', { name: new RegExp('^' + name) }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.blueplay-library-strip')).toHaveCount(0);
    await expect(page.locator('.classcard[aria-label="World"]')).toBeVisible();
    await expect(page.locator('.classcard[aria-label="World"]')).not.toContainText('built-in');
    await expect(page.locator('.classcard[aria-label="World"]')).not.toContainText('BluePlay API');
  });
}

for (const name of ['BlueK Demo Project', 'Space Invaders Demo']) {
  test(`GUI-01 creates ${name}`, async ({ page }) => {
    await project(page);
    await page.getByRole('button', { name: 'New Project', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create New Project' });
    await dialog.getByRole('button', { name: new RegExp('^' + name) }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.classcard').first()).toBeVisible();
  });
}

test('GUI-09 bench splitter follows first drag without jumping', async ({ page }) => {
  await project(page);
  const splitter = page.getByRole('separator', { name: 'Resize object bench and codepad' });
  for (const delta of [35, -20]) {
    const before = (await splitter.boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + delta, before.y + before.height / 2, { steps: 5 });
    await page.mouse.up();
    const after = (await splitter.boundingBox())!;
    expect(Math.abs(after.x - before.x - delta)).toBeLessThan(3);
  }
});

test('GUI-06 terminal splitter spans viewport and resizes both panels', async ({ page }) => {
  await project(page);
  await page.getByLabel('Show terminal', { exact: true }).click();
  await page.getByLabel('Split terminal to the right').click();
  const splitter = page.locator('.terminal-split-divider');
  const before = (await splitter.boundingBox())!;
  expect(before.y).toBe(0);
  expect(before.height).toBe(page.viewportSize()!.height);
  const terminalBefore = (await page.locator('.terminal-window').boundingBox())!;
  expect(Math.abs(before.x + before.width / 2 - terminalBefore.x)).toBeLessThan(2);
  const benchBefore = (await page.locator('.lower').boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, 40);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 - 40, 40, { steps: 5 });
  await page.mouse.up();
  const terminalAfter = (await page.locator('.terminal-window').boundingBox())!;
  const benchAfter = (await page.locator('.lower').boundingBox())!;
  expect(Math.abs(terminalAfter.width - terminalBefore.width - 40)).toBeLessThan(3);
  expect(Math.abs(benchAfter.width - benchBefore.width + 40)).toBeLessThan(3);
});

test('GUI-37 terminal splitter stays behind an active editor window', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.getByLabel('Show terminal', { exact: true }).click();
  await page.getByLabel('Split terminal to the right').click();
  await page.locator('.classcard').dblclick();
  const splitter = page.locator('.terminal-split-divider');
  const editor = page.locator('.editor-dialog');
  const dividerBox = (await splitter.boundingBox())!;
  const editorBox = (await editor.boundingBox())!;
  const x = dividerBox.x + dividerBox.width / 2;
  const y = Math.max(editorBox.y + 20, Math.min(editorBox.y + editorBox.height - 20, dividerBox.y + 120));
  await expect.poll(() => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.editor-dialog') !== null, { x, y })).toBe(true);
});

test('GUI-08 GUI-10 editor renames files even after empty content', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  const dialog = page.locator('.editor-dialog');
  const editor = dialog.locator('.cm-content');
  await expect(editor).toBeFocused();
  await editor.fill('class Tier {}');
  await expect(dialog.locator('h3')).toHaveText('Tier.kt');
  await editor.fill('');
  await editor.fill('class Katze {}');
  await expect(dialog.locator('h3')).toHaveText('Katze.kt');
  // The editor uses the shared window chrome; Close is intentionally in the
  // title bar. The old assertion measured empty space below a former footer
  // button and no longer describes the current layout.
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.classcard')).toHaveAttribute('aria-label', 'Katze');
  await evaluate(page, 'Katze()');
});

test('GUI-12 GUI-13 GUI-15 input echo order and clearing preserve the app', async ({ page }) => {
  await project(page);
  const code = 'println("A"); val x = readln(); println("B"); println(x)';
  await page.getByLabel('Codepad input').fill(code);
  await page.getByLabel('Codepad input').press('Enter');
  const terminal = page.locator('.terminal-window');
  const input = terminal.locator('input');
  await expect(input).toBeEnabled();
  await expect(terminal.locator('pre')).toHaveText('A\n');
  await input.fill('Test');
  await input.press('Enter');
  await expect(terminal.locator('pre')).toHaveText('A\nTest\nB\nTest\n');
  await expect(terminal.locator('.terminal-input-echo')).toHaveText('Test');
  await expect(input).toBeDisabled();
  await expect(terminal.locator('.terminal-notice')).toHaveCount(0);
  await terminal.getByLabel('Split terminal to the right').click();
  await terminal.getByLabel('Clear terminal').click();
  await expect(terminal.locator('.terminal-output pre')).toHaveText('');
  await expect(page.getByRole('button', { name: 'New Project', exact: true })).toBeVisible();
  await evaluate(page, 'println("after")');
  await expect(terminal.locator('pre')).toHaveText('after\n');
  await evaluate(page, 'println("\\u000C")');
  await expect(terminal.locator('pre')).not.toContainText('after');
});

test('GUI-16 Files remains an informational placeholder', async ({ page }) => {
  await project(page);
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Files' })).toContainText('not implemented');
});

test('GUI-14 output is visible before a long loop finishes', async ({ page }) => {
  await project(page);
  await page.getByLabel('Codepad input').fill('var i = 0; while (i < 100000000) { println(i); i++ }');
  await page.getByLabel('Codepad input').press('Enter');
  await expect(page.locator('.terminal-output pre')).toContainText('0\n');
  await expect(page.getByLabel('Codepad input')).toBeDisabled();
  await expect(page.locator('.codepad-entry')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset runtime', exact: true }).click();
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
});

test('GUI-63 the sidebar links the offline bundle, which the build always provides', async ({ page }) => {
  await project(page);
  const link = page.getByRole('link', { name: /Offline Version/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('download', 'BlueK-offline.zip');

  const href = await link.getAttribute('href') ?? '';
  expect(new URL(href, 'http://x/').pathname).toBe('/downloads/BlueK-offline.zip');
  const zip = await page.request.get(new URL(href, page.url()).toString());
  expect(zip.status()).toBe(200);
  expect((await zip.body()).byteLength).toBeGreaterThan(100_000);
});

test('GUI-64 a compiler error is marked in the source and reported below the editor', async ({ page }) => {
  await project(page, 'class Hund {\n    var name = "Rex"\n    fun bellen() {\n        printlx("Wuff")\n    }\n}');
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  // The editor of the file opens by itself and marks the line it happened on.
  const editor = page.locator('.editor-dialog');
  await expect(editor.locator('.editor-header h3')).toHaveText('Hund.kt');
  await expect(editor.locator('.cm-bluek-error-line')).toContainText('printlx("Wuff")');
  await expect(editor.locator('.cm-bluek-error-span')).toHaveCount(1);
  // The message goes below the editor, where the formatter reports as well.
  const message = editor.locator('.editor-diagnostics');
  await expect(message).toContainText('Line 4:');
  await expect(message).toContainText('printlx');
  // The position in the combined session source would contradict the line.
  await expect(message).not.toContainText('<BlueK project>');
  await expect(page.getByRole('dialog', { name: 'Compiler errors' })).toHaveCount(0);

  // It closes like the format error above it, marks included.
  await message.getByRole('button', { name: 'Close compiler errors' }).click();
  await expect(message).toHaveCount(0);
  await expect(editor.locator('.cm-bluek-error-line')).toHaveCount(0);
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(message).toContainText('printlx');

  // Editing is how the error gets fixed, so nothing about it may survive it.
  await editor.locator('.cm-line').filter({ hasText: 'printlx' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' ');
  await expect(message).toHaveCount(0);
  await expect(editor.locator('.cm-bluek-error-line')).toHaveCount(0);

  // The same error must be reported again by the next compile.
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(message).toContainText('printlx');

  // Fixing it clears the report and compiles the class.
  await editor.locator('.cm-line').filter({ hasText: 'printlx' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.type('println("Wuff")');
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.locator('.classcard.uncompiled')).toHaveCount(0);
  await expect(message).toHaveCount(0);
  await expect(editor.locator('.cm-bluek-error-line')).toHaveCount(0);
});

test('GUI-65 a syntax error reads compactly and the formatter marks its line too', async ({ page }) => {
  await project(page, 'class Tier {\n    var energie = 5\n\n    fn langweilen() {\n        energie = energie - 1\n    }\n}');
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  const editor = page.locator('.editor-dialog');
  // The dumped token and the repeated position used to hide the real problem.
  await expect(editor.locator('.editor-diagnostic')).toHaveText('Line 4: Unexpected token `fn`');
  await editor.getByRole('button', { name: 'Close compiler errors' }).click();
  await expect(editor.locator('.cm-bluek-error-line')).toHaveCount(0);

  // The formatter fails on the same line and must mark it the same way.
  await editor.getByRole('button', { name: 'Format Kotlin file' }).click();
  const parseError = editor.getByRole('alert').filter({ hasText: 'ParseError' });
  await expect(parseError).toBeVisible();
  const reported = Number((await parseError.textContent() ?? '').match(/(\d+):\d+/)?.[1]);
  expect(reported).toBeGreaterThan(0);
  await expect(editor.locator('.cm-line').nth(reported - 1)).toHaveClass(/cm-bluek-error-line/);
  await parseError.getByRole('button', { name: 'Close format error' }).click();
  await expect(editor.locator('.cm-bluek-error-line')).toHaveCount(0);
});

test('GUI-66 the README note sits in the corner, formats Markdown while typing and is saved only when written', async ({ page }) => {
  await project(page, 'class Hund');
  const note = page.getByRole('button', { name: 'README.md' });
  // Like BlueJ, every project has the note — an empty description shows one too.
  await expect(note).toBeVisible();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('bluek.current-project.v1') || '{}'));
  await expect.poll(() => stored().then((saved) => 'files' in saved)).toBe(true);
  expect(await stored()).not.toHaveProperty('readme');

  await note.click();
  const dialog = page.getByRole('dialog', { name: 'README.md' });
  const editor = dialog.locator('.readme-editor');
  // The description is there to be read first, so the text has no cursor yet.
  await expect(editor.locator('.cm-content')).not.toBeFocused();
  await editor.click();
  await page.keyboard.type('# Hunde\nEin Projekt mit **Hund**.\n- beissen\n');
  // Typing Markdown formats it right away, and the markers stay in the text.
  await expect(editor.locator('.cm-md-h1')).toHaveText('Hunde');
  await expect(editor.locator('.cm-md-strong')).toHaveText('Hund');
  await expect(editor.locator('.cm-md-list')).toHaveText('• beissen');

  // The cursor's own line keeps its markers, so a heading can be corrected.
  await editor.locator('.cm-md-h1').click();
  await expect(editor.locator('.cm-md-h1')).toHaveText('# Hunde');

  // The help names the syntax with an example of each construct, and a click
  // anywhere else puts it away again.
  await dialog.getByRole('button', { name: 'Markdown help' }).click();
  const help = dialog.locator('.readme-help');
  await expect(help.getByText('## Sub heading')).toBeVisible();
  await expect(help.locator('strong')).toHaveText('bold');
  await editor.locator('.cm-md-h1').click({ position: { x: 10, y: 8 } });
  await expect(help).toHaveCount(0);

  // A code block is revealed as a whole: inside it the fences say where it ends.
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('```kotlin\nval zahl = 12\n```');
  // Kotlin is coloured like in the editor, and the cursor inside the block
  // keeps both fences on screen.
  await expect(editor.locator('.cm-md-tok-keyword')).toHaveText('val');
  await expect(editor.locator('.cm-md-fence')).toHaveCount(2);
  await editor.locator('.cm-md-h1').click({ position: { x: 10, y: 8 } });
  await expect(editor.locator('.cm-md-fence')).toHaveCount(0);
  await expect(editor.locator('.cm-md-tok-keyword')).toHaveText('val');

  // The first Escape leaves the text — no line shows its markers any more —
  // and only the second one closes the window.
  await editor.locator('.cm-md-h1').click();
  await expect(editor.locator('.cm-md-h1')).toHaveText('# Hunde');
  await page.keyboard.press('Escape');
  await expect(editor.locator('.cm-md-h1')).toHaveText('Hunde');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await expect.poll(() => stored().then((saved) => saved.readme)).toContain('# Hunde');
  await note.click();
  await expect(editor.locator('.cm-md-h1')).toHaveText('Hunde');
});

test('GUI-67 a link can open the README, and the export dialog attaches that to it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const payload = {
    format: 'bluek-project', version: 1,
    files: [{ fileName: 'Hund.kt', kind: 'class', source: 'class Hund' }],
    readme: '# Hunde\nDas Projekt stellt sich vor.',
  };
  const link = '/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url');

  // Without the flag the project opens as usual, with the note in the corner.
  await page.goto(link);
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await expect(page.getByRole('dialog', { name: 'README.md' })).toHaveCount(0);

  // With it the description is the first thing the reader sees.
  await page.goto(link + '&readme=1');
  // Only the hash changed, which is no new visit — a reload is one.
  await page.reload();
  const dialog = page.getByRole('dialog', { name: 'README.md' });
  await expect(dialog.locator('.cm-md-h1')).toHaveText('Hunde');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // The dialog offers exactly that for the links it copies.
  await page.getByRole('button', { name: 'Save / Export' }).click();
  const save = page.getByRole('dialog', { name: 'Save / Export' });
  // The links come first, then the file exports.
  await expect(save.locator('.project-choice-list button strong')).toHaveText([
    'Copy Full Project Link', 'Copy Short Link', 'Export Project JSON', 'Export BlueJ Project (.zip)',
  ]);
  // Each link box carries the option at its right edge; both mean the same.
  await expect(save.getByLabel(/Open README.md with the link/)).toHaveCount(2);
  await save.getByLabel(/Open README.md with the link/).first().check();
  await expect(save.getByLabel(/Open README.md with the link/).last()).toBeChecked();
  // Headless Chromium may refuse the clipboard; then the app offers the link in
  // a prompt instead. Either way it is the link that has to carry the flag.
  let prompted = '';
  page.on('dialog', (dialog) => {
    prompted = dialog.defaultValue();
    void dialog.dismiss();
  });
  await save.getByRole('button', { name: 'Copy Full Project Link' }).click();
  await expect
    .poll(async () => prompted || page.evaluate(() => navigator.clipboard.readText().catch(() => '')))
    .toContain('&readme=1');

  // An empty README has nothing to open, so the option goes with it.
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify({ ...payload, readme: '' })).toString('base64url'));
  await page.reload();
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Save / Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Save / Export' }).getByLabel(/Open README.md with the link/).first()).toBeDisabled();
});

test('GUI-68 the editor has a Vim mode that stays off until it is switched on', async ({ page }) => {
  await project(page, 'class Hund {\n    var name = "Bello"\n    var alter = 3\n}');
  await page.getByRole('button', { name: 'Hund', exact: true }).dblclick();
  const editor = page.locator('.editor-dialog');
  const panel = editor.locator('.cm-panels');
  // Nobody gets Vim without asking for it: typing inserts what was typed.
  await expect(panel).toHaveCount(0);
  await editor.locator('.cm-line').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('j');
  await expect(editor.locator('.cm-line').first()).toHaveText('jclass Hund {');
  await page.keyboard.press('Backspace');

  // The shortcut switches it on, and the mode line says where one is.
  await page.keyboard.press('ControlOrMeta+Shift+V');
  await expect(panel).toHaveText('--NORMAL--');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
  await page.keyboard.press('j');
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await expect(editor.locator('.cm-line').nth(1)).toHaveText('    var alter = 3');
  await page.keyboard.press('u');
  await expect(editor.locator('.cm-line').nth(1)).toHaveText('    var name = "Bello"');

  // The settings show the same switch, and switching it off there ends the mode.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const toggle = settings.getByLabel('Vim mode in the editor');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await editor.locator('.cm-line').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('j');
  await expect(editor.locator('.cm-line').first()).toHaveText('jclass Hund {');
});
