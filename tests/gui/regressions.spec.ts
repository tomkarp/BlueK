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
  await expect(dialog).toHaveRole('dialog');
  await expect(dialog).toHaveAttribute('aria-label', 'Editor: Hund.kt');
  await expect(dialog.locator('.svelte-editor-host')).toHaveRole('group', { name: 'Code editor content' });
  await expect(dialog.getByRole('button', { name: 'Format Kotlin file' })).toHaveAttribute(
    'title',
    /Format Kotlin file \((Cmd|Ctrl)\+I\)/,
  );
  await dialog.getByRole('button', { name: 'Format Kotlin file' }).click();
  await expect(dialog.locator('.cm-line').nth(1)).toHaveText('    fun bellen() {');
  await dialog.getByRole('button', { name: 'Maximize editor window' }).click();
  await expect(dialog).toHaveClass(/maximized/);
  await dialog.getByRole('button', { name: 'Close editor' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Show terminal', exact: true }).click();
  await expect(page.locator('.terminal-modal')).toHaveAttribute('role', 'presentation');
});

test('GUI-80 maximized editor and terminal fill the browser viewport', async ({ page }) => {
  await project(page, 'class Hund {}');
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));

  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog');
  await editor.getByRole('button', { name: 'Maximize editor window' }).click();
  const editorBox = await editor.boundingBox();
  expect(editorBox).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
  await editor.getByRole('button', { name: 'Close editor' }).click();

  await page.getByRole('button', { name: 'Show terminal', exact: true }).click();
  const terminal = page.locator('.terminal-window');
  await terminal.getByRole('button', { name: 'Maximize terminal window' }).click();
  const terminalBox = await terminal.boundingBox();
  expect(terminalBox).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
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
  const fontSize = settings.getByLabel('Font size', { exact: true });
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
  ] as const;
  for (const [button, dialogName, closeButton] of dialogs) {
    await page.getByRole('button', { name: button, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('..')).toHaveCSS('z-index', '100');
    await dialog.getByRole('button', { name: closeButton, exact: true }).click();
  }
});

test('GUI-42 Escape closes an editor immediately without Vim', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  await expect(page.locator('.editor-dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.editor-dialog')).toHaveCount(0);
});

test('GUI-42 Vim Escape leaves insert mode immediately and never closes the editor by itself', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog');
  await page.keyboard.press('ControlOrMeta+Shift+V');
  await page.keyboard.press('i');
  await expect(editor.locator('.cm-panels')).toHaveText('--INSERT--');
  await page.keyboard.press('Escape');
  await expect(editor.locator('.cm-panels')).toHaveText('--NORMAL--');
  await expect(editor).toHaveCount(1);
  // Repeated plain Escapes in normal mode must not close the editor either —
  // Vim's own keymap owns a bare Escape entirely while Vim is on.
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape', { delay: 100 });
  await expect(editor).toHaveCount(1);
});

test('GUI-42 Shift+Escape closes the active editor tab while Vim is on', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {}' },
    { fileName: 'Katze.kt', kind: 'class', source: 'class Katze {}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Hund', exact: true }).dblclick();
  await page.getByRole('button', { name: 'Katze', exact: true }).dblclick();
  await page.keyboard.press('ControlOrMeta+Shift+V');
  await expect(page.locator('.editor-tabbed-dialog')).toHaveCount(1);
  await expect(page.locator('.editor-tabs [role="tab"]')).toHaveCount(2);
  await page.keyboard.press('Shift+Escape');
  await expect(page.locator('.editor-dialog')).toHaveCount(1);
  await expect(page.locator('.editor-tabbed-dialog')).toHaveCount(0);
  await expect(page.locator('.editor-header h3')).toHaveText('Hund.kt');
  await page.keyboard.press('Shift+Escape');
  await expect(page.locator('.editor-dialog')).toHaveCount(0);
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

test('GUI-83 terminal output brings the terminal above an open editor', async ({ page }) => {
  await project(page, 'class Hund {}');
  // Terminal and editor open at the same centered default place, so an editor
  // opened after the terminal covers it completely (see GUI-30 for clicks).
  await page.getByRole('button', { name: 'Show terminal', exact: true }).click();
  await page.locator('.classcard').dblclick();
  const editorModal = page.locator('.editor-modal');
  const terminalModal = page.locator('.terminal-modal');
  await expect(editorModal).toHaveClass(/window-active/);
  await expect(terminalModal).not.toHaveClass(/window-active/);
  await evaluate(page, 'println("Terminal output")');
  await expect(terminalModal.locator('.terminal-output pre')).toContainText('Terminal output');
  await expect(terminalModal).toHaveClass(/window-active/);
  await expect(editorModal).not.toHaveClass(/window-active/);
  await expect(terminalModal).toHaveCSS('z-index', '30');
});

test('GUI-84 object creation dialog stays above an open editor', async ({ page }) => {
  await project(page, 'class Hund(var alter: Int) {}');
  const classCard = page.locator('.classcard');
  await classCard.dblclick();
  const editorModal = page.locator('.editor-modal.window-active');
  await expect(editorModal).toBeVisible();
  await evaluate(page, '1');
  await classCard.evaluate((element) => element.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, button: 2, clientX: 180, clientY: 180,
  })));
  await page.locator('.constructor-menu-item').click({ force: true });
  const createDialog = page.getByRole('dialog', { name: 'Create Hund' });
  await expect(createDialog).toBeVisible();
  const dialogLayer = page.locator('.modal.topmost-modal');
  await expect(dialogLayer).toHaveCSS('z-index', '100');
  const dialogIndex = Number(await dialogLayer.evaluate((element) => getComputedStyle(element).zIndex));
  const editorIndex = Number(await editorModal.evaluate((element) => getComputedStyle(element).zIndex));
  expect(dialogIndex).toBeGreaterThan(editorIndex);
});

test('GUI-85 method parameter dialog stays above an open editor', async ({ page }) => {
  await project(page, 'class Hund { fun laufen(weite: Int) {} }');
  const classCard = page.locator('.classcard');
  await classCard.dblclick();
  const editorModal = page.locator('.editor-modal.window-active');
  await expect(editorModal).toBeVisible();
  const expression = await evaluate(page, 'Hund()');
  await expression.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  const object = page.locator('.bench .object');
  await object.dispatchEvent('contextmenu', { button: 2, bubbles: true, clientX: 180, clientY: 180 });
  await page.locator('.method-menu-item').first().click();
  const methodDialog = page.getByRole('dialog', { name: /hund1\.laufen/ });
  await expect(methodDialog).toBeVisible();
  const dialogLayer = page.locator('.modal.topmost-modal');
  await expect(dialogLayer).toHaveCSS('z-index', '100');
  const dialogIndex = Number(await dialogLayer.evaluate((element) => getComputedStyle(element).zIndex));
  const editorIndex = Number(await editorModal.evaluate((element) => getComputedStyle(element).zIndex));
  expect(dialogIndex).toBeGreaterThan(editorIndex);
});

test('GUI-93 object methods and inherited submenus stay above inspectors', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Tier.kt', kind: 'class', source: 'open class Tier { fun fressen() { println("gefressen") } }' },
    { fileName: 'Hund.kt', kind: 'class', source: `class Hund : Tier() {
      var a = 1; var b = 2; var c = 3; var d = 4; var e = 5; var f = 6
      fun laufen(weite: Int) {}
    }` },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  const entry = await evaluate(page, 'Hund()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  const object = page.locator('.bench .object');
  await object.dblclick();
  const inspector = page.locator('.inspect-window');
  const objectBox = (await object.boundingBox())!;
  const before = (await inspector.boundingBox())!;
  await page.mouse.move(before.x + 16, before.y + 16);
  await page.mouse.down();
  await page.mouse.move(objectBox.x + objectBox.width + 28, objectBox.y - 144);
  await page.mouse.up();

  const assertAboveInspector = async (button: ReturnType<Page['locator']>) => {
    const menuBox = (await button.boundingBox())!;
    const inspectorBox = (await inspector.boundingBox())!;
    const left = Math.max(menuBox.x, inspectorBox.x), right = Math.min(menuBox.x + menuBox.width, inspectorBox.x + inspectorBox.width);
    const top = Math.max(menuBox.y, inspectorBox.y), bottom = Math.min(menuBox.y + menuBox.height, inspectorBox.y + inspectorBox.height);
    expect(right - left).toBeGreaterThan(10);
    expect(bottom - top).toBeGreaterThan(10);
    expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.popup')), {
      x: (left + right) / 2, y: (top + bottom) / 2,
    })).toBe(true);
  };
  await object.click({ button: 'right', position: { x: objectBox.width - 8, y: 12 } });
  const method = page.locator('.popup').getByRole('button', { name: 'laufen(weite: Int)', exact: true });
  await expect(method).toBeVisible();
  await assertAboveInspector(method);
  await method.click();
  const parameters = page.getByRole('dialog', { name: /hund1\.laufen/ });
  await expect(parameters).toBeVisible();
  await parameters.getByRole('button', { name: 'Cancel', exact: true }).click();

  await object.click({ button: 'right', position: { x: objectBox.width - 8, y: 12 } });
  await page.locator('.popup-submenu-trigger').filter({ hasText: 'inherited from Tier' }).hover();
  const inherited = page.locator('.popup-submenu-panel').getByRole('button', { name: 'fressen()', exact: true });
  await expect(inherited).toBeVisible();
  await assertAboveInspector(inherited);
  await inherited.click();
  await expect(page.locator('.terminal-output pre')).toContainText('gefressen');
});

test('GUI-95 method menus show the return type after the parameters', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Person.kt', kind: 'class', source: 'open class Person { fun name(): String = "Ada" }' },
    { fileName: 'Student.kt', kind: 'class', source: 'class Student : Person() { fun give(): Int = 1; fun speak() {}; fun <T> first(items: List<T>): T = items[0] }' },
    { fileName: 'Util.kt', kind: 'functions', source: 'fun summe(a: Int, b: Int): Int = a + b' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  const entry = await evaluate(page, 'Student()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('student1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();

  await page.locator('.bench .object').click({ button: 'right' });
  const popup = page.locator('.popup');
  await expect(popup.getByRole('button', { name: 'give(): Int', exact: true })).toBeVisible();
  await expect(popup.getByRole('button', { name: 'speak()', exact: true })).toBeVisible();
  await expect(popup.getByRole('button', { name: 'first<T>(items: List<T>): T', exact: true })).toBeVisible();
  await popup.locator('.popup-submenu-trigger').filter({ hasText: 'inherited from Person' }).hover();
  await expect(page.locator('.popup-submenu-panel').getByRole('button', { name: 'name(): String', exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await page.locator('.classcard[aria-label="Util"]').click({ button: 'right' });
  await expect(popup.getByRole('button', { name: 'summe(a: Int, b: Int): Int', exact: true })).toBeVisible();
});

test('RT-64 a Data Class from the New File dialog compiles, compares by value and hides its generated methods', async ({ page }) => {
  await project(page);
  await page.getByRole('button', { name: 'New File', exact: true }).click();
  const newFile = page.getByRole('dialog', { name: 'Create New Kotlin File' });
  await newFile.getByLabel('Name').fill('Punkt');
  await newFile.getByRole('radio', { name: 'Data Class' }).check();
  await newFile.getByRole('button', { name: 'Create', exact: true }).click();
  // The template `data class Punkt(val value: Any?)` used to fail with "`data` is unknown".
  await expect((await evaluate(page, 'Punkt(1) == Punkt(1)')).locator('.codepad-result-value')).toHaveText('true');
  await expect((await evaluate(page, '"${Punkt("a").copy(value = 2)}"')).locator('.codepad-result-value')).toHaveText('"Punkt(value=2)"');
  const entry = await evaluate(page, 'Punkt(3)');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('punkt1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').click({ button: 'right' });
  const popup = page.locator('.popup');
  await expect(popup).toBeVisible();
  for (const generated of ['copy', 'component1', 'toString', 'equals', 'hashCode']) {
    await expect(popup.getByRole('button', { name: new RegExp(`^${generated}\\(`) })).toHaveCount(0);
  }
});

test('RT-67 the class menu calls methods of an object and of a companion object', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Zaehler.kt', kind: 'class', source: 'object Zaehler {\n    var stand = 0\n    fun erhoehe(): Int { stand++; return stand }\n}' },
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund(val name: String) {\n    init { anzahl++ }\n    companion object {\n        var anzahl = 0\n        fun neu(name: String): Hund = Hund(name)\n    }\n}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  const popup = page.locator('.popup');
  const result = page.locator('.result-dialog');

  // An object has no constructor; its methods are called on its single instance.
  await page.locator('.classcard[aria-label="Zaehler"]').click({ button: 'right' });
  await expect(popup.locator('.constructor-menu-item')).toHaveCount(0);
  await popup.getByRole('button', { name: 'erhoehe(): Int', exact: true }).click();
  await expect(result.locator('.result-value')).toHaveText('1 : Int');
  await result.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('.classcard[aria-label="Zaehler"]').click({ button: 'right' });
  await popup.getByRole('button', { name: 'erhoehe(): Int', exact: true }).click();
  await expect(result.locator('.result-value')).toHaveText('2 : Int');
  await result.getByRole('button', { name: 'Close', exact: true }).click();

  // A class menu offers the constructor and the companion's methods (`Hund.neu(…)`).
  await page.locator('.classcard[aria-label="Hund"]').click({ button: 'right' });
  await expect(popup.locator('.constructor-menu-item')).toHaveText('Hund(name: String)');
  await popup.getByRole('button', { name: 'neu(name: String): Hund', exact: true }).click();
  const invoke = page.locator('.method-dialog');
  await expect(invoke.locator('h3')).toHaveText('Hund.neu()');
  await invoke.getByLabel('name: String').fill('"Rex"');
  await invoke.getByRole('button', { name: 'Invoke', exact: true }).click();
  await expect(result.locator('.result-value')).toContainText('Hund');
  await result.getByRole('button', { name: 'Close', exact: true }).click();
  await expect((await evaluate(page, 'Hund.anzahl')).locator('.codepad-result-value')).toHaveText('1');
  await expect((await evaluate(page, 'Zaehler.stand')).locator('.codepad-result-value')).toHaveText('2');
});

test('RT-70 a class formatted by BlueK still compiles (`val symbol =` with the value on the next line)', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Karte.kt', kind: 'class', source: "class Karte(\n    farbe: String,   // \"Herz\", \"Karo\", \"Pik\", \"Kreuz\"\n    rang: String     // \"2\"-\"10\", \"B\", \"D\", \"K\", \"A\"\n    ) {\n    var rang: String = kuerzeRang(rang)\n        set(value) { field = kuerzeRang(value) }\n    var farbe: String = farbe.trim().lowercase()\n\n    fun berechneWert(): Int {\n        return when (rang) {\n            \"A\" -> 11\n            \"B\", \"D\", \"K\" -> 10\n            else -> rang.toInt()\n        }\n    }\n\n    fun symbol(): String {\n        val symbol = when (farbe) { \"herz\" -> \"\\u2665\"; \"karo\" -> \"\\u2666\"; \"pik\" -> \"\\u2660\"; \"kreuz\" -> \"\\u2663\"; else -> \"?\" }\n        return symbol\n    }\n\n    private fun kuerzeRang(roherRang: String): String {\n        val normalisiert = roherRang.trim().lowercase()\n        return when (normalisiert) {\n            \"a\", \"ass\" -> \"A\"\n            \"k\", \"koenig\" -> \"K\"\n            \"d\", \"dame\" -> \"D\"\n            \"b\", \"bube\" -> \"B\"\n            else -> {\n                val zahl = normalisiert.toIntOrNull() ?: throw IllegalArgumentException(\"Unbekannter Rang: $roherRang\")\n                if (zahl in 2..10) zahl.toString() else throw IllegalArgumentException(\"Rang ausserhalb des Bereichs: $roherRang\")\n            }\n        }\n    }\n}\n" }] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.locator('.classcard').dblclick();
  const dialog = page.locator('.editor-dialog');
  await dialog.getByRole('button', { name: 'Format Kotlin file' }).click();
  // The formatter moves long `when` values to the next line; Kotlite rejected the line break after `=`.
  await expect(dialog.locator('.cm-line').filter({ hasText: /^\s*val symbol =$/ })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  // A compile error would reopen the editor with the message.
  await expect(page.locator('.editor-dialog')).toHaveCount(0);
  await expect((await evaluate(page, 'Karte("Herz", "Dame").berechneWert()')).locator('.codepad-result-value')).toHaveText('10');
  await expect((await evaluate(page, 'Karte("pik", "7").symbol()')).locator('.codepad-result-value')).toHaveText('"\u2660"');
});

test('GUI-96 the method result appears in front of an open editor', async ({ page }) => {
  await project(page, 'class Hund {\n    fun alter(): Int = 3\n}');
  const entry = await evaluate(page, 'Hund()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog');
  await expect(editor).toBeVisible();
  // The editor may cover the bench; open the object menu as a right click would.
  await page.locator('.bench .object').dispatchEvent('contextmenu', { button: 2 });
  await page.locator('.popup').getByRole('button', { name: 'alter(): Int', exact: true }).click();
  const result = page.locator('.result-dialog');
  await expect(result.locator('.result-value')).toHaveText('3 : Int');
  // The result dialog was behind the editor window: check what is on top at its centre.
  const box = (await result.boundingBox())!;
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.result-dialog')),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
  await result.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(editor).toBeVisible();
});

test('GUI-97 the terminal shows ANSI colours and handles control sequences like a terminal', async ({ page }) => {
  await project(page, `class Hund {
    fun karte(farbe: String) {
        val textfarbe = if (farbe == "herz") "\\u001B[31m" else "\\u001B[30m"
        val zuruecksetzen = "\\u001B[0m"
        println("┌─────┐")
        println("│  $textfarbe♥$zuruecksetzen  │")
        println("└─────┘")
    }
  }`);
  await evaluate(page, 'Hund().karte("herz")');
  const output = page.locator('.terminal-output pre');
  await expect(output).toHaveText('┌─────┐\n│  ♥  │\n└─────┘\n');
  const heart = output.locator('span', { hasText: '♥' });
  await expect(heart).toHaveText('♥');
  await expect(heart).toHaveCSS('color', 'rgb(205, 49, 49)');
  // The dark theme has its own palette.
  await evaluate(page, 'println("\\u001B[32mgrün\\u001B[0m")');
  const green = output.locator('span', { hasText: 'grün' });
  await expect(green).toHaveCSS('color', 'rgb(0, 188, 0)');
  await page.locator('.bluek').evaluate((root) => root.classList.add('dark'));
  await expect(green).toHaveCSS('color', 'rgb(13, 188, 121)');
  await page.locator('.bluek').evaluate((root) => root.classList.remove('dark'));
  // Clearing the screen and overwriting a line with \r, as console programs do.
  await evaluate(page, 'print("\\u001B[H\\u001B[2JLaden 10%\\rLaden 100%\\n\\u001B[1mfertig\\u001B[0m")');
  await expect(output).toHaveText('Laden 100%\nfertig');
  await expect(output.locator('span', { hasText: 'fertig' })).toHaveCSS('font-weight', '700');
});

test('GUI-98 sized text (kitty OSC 66) overlays the following lines', async ({ page }) => {
  await project(page, `class Karte {
    fun gross() {
        val karte = "" + 0xD83C.toChar() + 0xDCB1.toChar()
        print("Karte: \\u001B[31m\\u001B]66;s=7;$karte\\u0007\\u001B[0m daneben")
        print("\\n".repeat(7))
        println("unten")
    }
  }`);
  await evaluate(page, 'Karte().gross()');
  const output = page.locator('.terminal-output pre');
  await expect(output).toHaveText('Karte: \u{1F0B1} daneben\n\n\n\n\n\n\nunten\n');
  const box = output.locator('.terminal-sized');
  await expect(box).toHaveCount(1);
  await expect(box.locator('span')).toHaveCSS('font-size', '98px');
  await expect(box.locator('span')).toHaveCSS('color', 'rgb(205, 49, 49)');
  const geometry = await output.evaluate((pre) => {
    const range = document.createRange();
    const lineTop = (text: string) => {
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const index = node.textContent!.indexOf(text);
        if (index < 0) continue;
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        return range.getBoundingClientRect().top;
      }
      return NaN;
    };
    const sized = pre.querySelector('.terminal-sized')!.getBoundingClientRect();
    const cell = parseFloat(getComputedStyle(pre).fontSize);
    return { cell, box: { top: sized.top, height: sized.height, width: sized.width }, karte: lineTop('Karte'), daneben: lineTop('daneben'), unten: lineTop('unten') };
  });
  // The block is seven lines high and seven cells wide, starts in the first line and leaves the
  // following text where it would be without it: "daneben" beside it, "unten" seven lines lower.
  const line = (geometry.unten - geometry.karte) / 7;
  expect(line).toBeGreaterThan(geometry.cell);
  expect(Math.abs(geometry.box.height - 7 * line)).toBeLessThan(1);
  expect(Math.abs(geometry.box.top - geometry.karte)).toBeLessThan(line / 2);
  expect(Math.abs(geometry.daneben - geometry.karte)).toBeLessThan(1);
});

test('RT-82 an uncaught exception ends the call, the runtime stays usable', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Karte.kt', kind: 'class', source: 'class Karte(var rang: String) {\n    var aufrufe = 0\n    fun wert(): Int {\n        aufrufe++\n        val n = rang.toInt()\n        if (n !in 2..10) throw IllegalArgumentException("Rang außerhalb des Bereichs: $rang")\n        return n\n    }\n}\n' },
    { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    println("vorher")\n    println(Karte("70").wert())\n}\n' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  const entry = await evaluate(page, 'Karte("70")');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('karte1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  const object = page.locator('.bench .object');
  const popup = page.locator('.popup');

  // The user's case: the method throws. The dialog names the exception, not a compile error.
  await object.click({ button: 'right' });
  await popup.getByRole('button', { name: 'wert(): Int', exact: true }).click();
  const error = page.getByRole('dialog', { name: 'Exception', exact: true });
  await expect(error).toContainText('The call ended with an exception.');
  await expect(error.locator('pre')).toHaveText('IllegalArgumentException: Rang außerhalb des Bereichs: 70');
  await error.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.terminal-notice')).toHaveCount(0);
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();

  // The object stays on the bench with the change the call made before it failed.
  await expect(await evaluate(page, 'karte1.aufrufe')).toContainText('1');
  await evaluate(page, 'karte1.rang = "8"');
  await object.click({ button: 'right' });
  await popup.getByRole('button', { name: 'wert(): Int', exact: true }).click();
  const result = page.locator('.result-dialog');
  await expect(result.locator('.result-value')).toHaveText('8 : Int');
  await result.getByRole('button', { name: 'Close', exact: true }).click();

  // Codepad: the exception is shown in the entry, the next input runs.
  const input = page.getByLabel('Codepad input');
  await input.fill('"x".toInt()');
  await input.press('Enter');
  await expect(page.locator('.codepad-error').last()).toContainText('NumberFormatException');
  await expect(await evaluate(page, 'karte1.aufrufe + 1')).toContainText('3');

  // main(): the exception goes to the terminal like in Kotlin; main can run again.
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  const terminal = page.locator('.terminal-output pre');
  await expect(terminal).toHaveText('vorher\nException in thread "main" IllegalArgumentException: Rang außerhalb des Bereichs: 70\n    at Karte.wert(Karte.kt:6)\n    at main(Main.kt:3)\n');
  await expect(terminal.locator('span', { hasText: 'Exception in thread' })).toHaveCSS('color', 'rgb(205, 49, 49)');
  await expect(page.locator('.terminal-notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start main', exact: true })).toBeEnabled();
  await expect(await evaluate(page, '2 + 3')).toContainText('5');
});

test('RT-83 the class menu offers primary and secondary constructors and creates with each', async ({ page }) => {
  await project(page, 'class Hund(val name: String, val alter: Int) {\n    constructor(name: String) : this(name, 1)\n    constructor() : this("Bello")\n}');
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await page.locator('.classcard').click({ button: 'right' });
  const items = page.locator('.constructor-menu-item');
  await expect(items).toHaveText(['Hund(name: String, alter: Int)', 'Hund(name: String)', 'Hund()']);
  await items.nth(1).click();
  const dialog = page.locator('.create-object-dialog');
  await dialog.getByLabel('name: String', { exact: true }).fill('"Rex"');
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('.bench .object')).toHaveCount(1);
  await expect(await evaluate(page, 'hund1.name + hund1.alter')).toContainText('Rex1');
  await page.locator('.classcard').click({ button: 'right' });
  await items.nth(2).click();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('.bench .object')).toHaveCount(2);
  await expect(await evaluate(page, 'hund2.name + hund2.alter')).toContainText('Bello1');
});

test('GUI-100 constructor and method dialogs show the call as code like BlueJ', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Karte.kt', kind: 'class', source: 'class Karte(val farbe: String, val rang: String) {\n    constructor(farbe: String) : this(farbe, "A")\n    fun wert(faktor: Int, bonus: Int = 0): Int = faktor + bonus\n}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await page.locator('.classcard').click({ button: 'right' });
  await page.locator('.constructor-menu-item').first().click();
  const dialog = page.locator('.create-object-dialog');
  const call = dialog.getByRole('group', { name: 'Call' });
  // `Karte(` [farbe: String] `,` [rang: String] `)`: names and types are placeholders.
  await expect(call.locator('.call-prefix')).toHaveText('Karte(');
  await expect(call.locator('input')).toHaveCount(2);
  await expect(call.locator('input').nth(0)).toHaveAttribute('placeholder', 'farbe: String');
  await expect(call.locator('input').nth(1)).toHaveAttribute('placeholder', 'rang: String');
  await expect(call.locator('.call-separator')).toHaveText([',', ')']);
  await expect(call.locator('input').nth(0)).toBeFocused();
  await call.getByLabel('farbe: String', { exact: true }).fill('"herz"');
  await call.getByLabel('rang: String', { exact: true }).fill('"dame"');
  // The fields line up under each other, after the prefix.
  const first = (await call.locator('input').nth(0).boundingBox())!;
  const second = (await call.locator('input').nth(1).boundingBox())!;
  const prefix = (await call.locator('.call-prefix').boundingBox())!;
  expect(Math.abs(first.x - second.x)).toBeLessThan(1);
  expect(second.y).toBeGreaterThan(first.y + first.height - 1);
  expect(first.x).toBeGreaterThanOrEqual(prefix.x + prefix.width);
  // Choosing the secondary constructor shows its call.
  await dialog.getByLabel('Constructor').selectOption({ label: 'Karte(farbe: String)' });
  await expect(call.locator('input')).toHaveCount(1);
  await expect(call.locator('.call-separator')).toHaveText([')']);
  await call.getByLabel('farbe: String', { exact: true }).fill('"pik"');
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(await evaluate(page, 'karte1.farbe + karte1.rang')).toContainText('pikA');

  // Method calls look the same, with `= …` for a parameter with a default value.
  await page.locator('.bench .object').click({ button: 'right' });
  await page.locator('.popup').getByRole('button', { name: /^wert\(/ }).click();
  const invoke = page.locator('.method-dialog').getByRole('group', { name: 'Call' });
  await expect(invoke.locator('.call-prefix')).toHaveText('karte1.wert(');
  await expect(invoke.locator('input').nth(1)).toHaveAttribute('placeholder', 'bonus: Int = …');
  await invoke.getByLabel('faktor: Int', { exact: true }).fill('4');
  await invoke.getByLabel('faktor: Int', { exact: true }).press('Enter');
  await expect(page.locator('.result-dialog .result-value')).toHaveText('4 : Int');
});

test('RT-91 RT-92 nested and inner classes belong to their outer class card and inspect like other objects', async ({ page }) => {
  const source = [
    'class Liste {',
    '    private var kopf: Knoten? = null',
    '    fun add(wert: Int) { kopf = Knoten(wert, kopf) }',
    '    fun laeufer() = Laeufer()',
    '    class Knoten(val wert: Int, val naechster: Knoten?)',
    '    inner class Laeufer {',
    '        var aktuell = kopf',
    '        fun weiter(): Int { val w = aktuell!!.wert; aktuell = aktuell?.naechster; return w }',
    '    }',
    '}',
  ].join('\n');
  const payload = { format: 'bluek-project', version: 1, files: [{ fileName: 'Liste.kt', kind: 'class', source }] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  // One card per file: the nested classes are part of `Liste`.
  await expect(page.locator('.classcard')).toHaveCount(1);
  await evaluate(page, 'val l = Liste(); l.add(1); l.add(2)');
  await expect(await evaluate(page, 'Liste.Knoten(5, null).wert')).toContainText('5');
  const entry = await evaluate(page, 'l.laeufer()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('laeufer1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').filter({ hasText: 'laeufer1' }).dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  // The reference to the outer object is hidden, like the compiler's `this$0` in BlueJ.
  await expect(inspector.locator('.inspect-row')).toHaveCount(1);
  await expect(inspector.locator('.inspect-row').filter({ hasText: 'aktuell :' })).toBeVisible();
  await page.locator('.bench .object').filter({ hasText: 'laeufer1' }).click({ button: 'right' });
  await page.locator('.popup').getByRole('button', { name: /^weiter\(/ }).click();
  await expect(page.locator('.result-dialog .result-value')).toHaveText('2 : Int');
});

test('RT-96 arrays run in main(args), change in place and show in the inspector', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Spielfeld.kt', kind: 'class', source: 'class Spielfeld {\n    val zellen = IntArray(3)\n    fun setze(i: Int) { zellen[i] = zellen[i] + 1 }\n}\n' },
    // The AI-generated code from the user's report: a BooleanArray of flags.
    { fileName: 'Main.kt', kind: 'functions', source: 'fun main(args: Array<String>) {\n    val fertig = booleanArrayOf(false, false)\n    fertig[1] = true\n    println(fertig.contentToString() + " " + args.size)\n}\n' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('[false, true] 0\n');
  const entry = await evaluate(page, 'Spielfeld()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('feld1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(await evaluate(page, 'feld1.setze(2); feld1.zellen.contentToString()')).toContainText('[0, 0, 1]');
  await page.locator('.bench .object').filter({ hasText: 'feld1' }).dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  await expect(inspector.locator('.inspect-row').filter({ hasText: 'zellen' })).toContainText('IntArray');
});

test('GUI-31 additional editor files open in tabs by default', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {}' },
    { fileName: 'Katze.kt', kind: 'class', source: 'class Katze {}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByLabel('Hund', { exact: true }).dblclick();
  await page.getByLabel('Katze', { exact: true }).dblclick();
  await expect(page.locator('.editor-dialog')).toHaveCount(1);
  await expect(page.locator('.editor-tabbed-dialog')).toHaveCount(1);
  await expect(page.locator('.editor-tabs [role="tab"]')).toHaveCount(2);
  await expect(page.locator('.editor-tabs [role="tab"][aria-selected="true"]')).toHaveText(/Katze\.kt/);
  await expect(page.locator('.editor-tabbed-dialog .cm-content')).toContainText('class Katze {}');
});

test('GUI-32 editor and terminal share controls, minimum size and full frame handles', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.locator('.classcard').dblclick();
  await page.getByLabel('Show terminal', { exact: true }).click();

  const editor = page.locator('.editor-dialog');
  const terminal = page.locator('.terminal-window');
  const editorButtons = editor.locator('.editor-header button');
  const terminalButtons = terminal.locator('.terminal-header button');
  await expect(editorButtons.nth(0)).toHaveAccessibleName('Maximize editor window');
  await expect(editorButtons.nth(0).locator('svg.window-control-icon')).toHaveCount(1);
  await expect(editorButtons.nth(1).locator('svg.window-icon')).toHaveCount(1);
  await expect(editorButtons.nth(2)).toHaveText('×');
  await expect(terminalButtons.nth(0)).toHaveAccessibleName('Maximize terminal window');
  await expect(terminalButtons.nth(0).locator('svg.window-control-icon')).toHaveCount(1);
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

test('GUI-33 editor tabs can be ungrouped and collected again', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {}' },
    { fileName: 'Katze.kt', kind: 'class', source: 'class Katze {}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByLabel('Hund', { exact: true }).dblclick();
  await page.getByLabel('Katze', { exact: true }).dblclick();
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
  await expect(page.locator('.editor-tabbed-dialog')).toHaveCount(1);
  await page.getByLabel('Ungroup editor tabs').click();
  await expect(page.locator('.editor-tabbed-dialog')).toHaveCount(0);
  await expect(page.locator('.editor-dialog')).toHaveCount(2);
  await page.getByLabel('Collect editor windows into tabs').last().click();
  await page.getByLabel('Close all editors').click();
  await expect(page.locator('.editor-dialog')).toHaveCount(0);
});

test('GUI-03 GUI-04 computed values update after every inspector edit', async ({ page }) => {
  await project(page, 'class Hund(var alter: Int = 1) { var name: String = "Wuffi und ein langer Name"; val steuer: Int get() = alter * 10 }');
  const entry = await evaluate(page, 'Hund()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  const inspectorBox = (await inspector.boundingBox())!;
  expect(inspectorBox.width).toBeLessThanOrEqual(390);
  const computed = inspector.locator('.inspect-row').filter({ hasText: 'steuer :' }).locator('output');
  await expect(computed).toHaveCSS('font-size', '16px');
  const editIcon = inspector.getByLabel('Edit alter');
  await expect(editIcon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const nameRow = inspector.locator('.inspect-row').filter({ hasText: 'name :' });
  const nameValue = nameRow.locator('output');
  const nameLabel = nameRow.locator('span');
  await expect(nameValue).toHaveCSS('text-overflow', 'ellipsis');
  expect(await nameValue.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const labelBeforeEdit = (await nameLabel.boundingBox())!;
  await inspector.getByLabel('Edit name').click();
  const labelDuringEdit = (await nameLabel.boundingBox())!;
  expect(labelDuringEdit.width).toBeCloseTo(labelBeforeEdit.width, 1);
  const nameInput = inspector.getByLabel('Value of name');
  const [nameInputBox, nameCellBox] = await Promise.all([nameInput.boundingBox(), nameRow.locator('.inspect-value').boundingBox()]);
  expect(nameCellBox!.x + nameCellBox!.width - (nameInputBox!.x + nameInputBox!.width)).toBeLessThanOrEqual(4);
  await nameInput.press('Escape');
  const alterCell = inspector.locator('.inspect-row').filter({ hasText: 'alter :' }).locator('.inspect-value');
  const [editIconBox, valueBox, valueCellBox] = await Promise.all([editIcon.boundingBox(), alterCell.locator('output').boundingBox(), alterCell.boundingBox()]);
  expect(editIconBox).not.toBeNull();
  expect(valueBox).not.toBeNull();
  expect(editIconBox!.x).toBeGreaterThanOrEqual(valueBox!.x + valueBox!.width);
  expect(editIconBox!.x + editIconBox!.width).toBeLessThanOrEqual(valueCellBox!.x + valueCellBox!.width);
  expect(editIconBox!.x + editIconBox!.width).toBeLessThanOrEqual(inspectorBox.x + inspectorBox.width);
  await expect(computed).toHaveText('10');
  for (const age of [2, 3, 7]) {
    await inspector.getByLabel('Edit alter', { exact: true }).click();
    const input = inspector.getByLabel('Value of alter');
    const inputBox = (await input.boundingBox())!;
    const rowBox = (await input.locator('xpath=..').boundingBox())!;
    expect(rowBox.x + rowBox.width - (inputBox.x + inputBox.width)).toBeLessThanOrEqual(4);
    await input.fill(String(age));
    await input.press('Enter');
    await expect(computed).toHaveText(String(age * 10));
  }
  await evaluate(page, 'hund1.alter = 9');
  await expect(computed).toHaveText('90');
});

test('GUI-90 editing an object or list field starts empty and a bench click inserts an object name', async ({ page }) => {
  await project(page, 'class Hund { var freund: Hund? = null; var tricks = mutableListOf("Sitz"); var paar = Pair(1, "a"); var alter: Int = 3 }');
  const object = (name: string) => page.locator('.bench .object').filter({ hasText: new RegExp(`^${name}:`) });
  for (const name of ['hund1', 'hund2', 'hund3']) {
    const entry = await evaluate(page, 'Hund()');
    await entry.getByRole('button').click();
    await page.getByLabel('Name of instance').fill(name);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(object(name)).toBeVisible();
  }
  const check = async (code: string) =>
    expect((await evaluate(page, code)).locator('.codepad-result-value')).toHaveText('true');
  await evaluate(page, 'hund1.freund = hund2');
  await object('hund1').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  const input = inspector.getByLabel('Value of freund');
  // The field used to contain `Hund()`, so Enter created a new object.
  await inspector.getByLabel('Edit freund', { exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(input).toHaveAttribute('placeholder', 'expression');
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  await check('hund1.freund === hund2');
  // A collection summary is no expression either; plain values stay prefilled.
  await inspector.getByLabel('Edit tricks', { exact: true }).click();
  await expect(inspector.getByLabel('Value of tricks')).toHaveValue('');
  await inspector.getByLabel('Value of tricks').press('Escape');
  // A pair is shown as `(1, a)` (RT-52), which is no expression either.
  await expect(inspector.getByText('(1, a)', { exact: true })).toBeVisible();
  await inspector.getByLabel('Edit paar', { exact: true }).click();
  await expect(inspector.getByLabel('Value of paar')).toHaveValue('');
  await inspector.getByLabel('Value of paar').press('Escape');
  await inspector.getByLabel('Edit alter', { exact: true }).click();
  await expect(inspector.getByLabel('Value of alter')).toHaveValue('3');
  await inspector.getByLabel('Value of alter').press('Escape');
  // While editing, a bench click inserts the name instead of selecting.
  await inspector.getByLabel('Edit freund', { exact: true }).click();
  await object('hund3').click();
  await expect(input).toHaveValue('hund3');
  await expect(input).toBeFocused();
  await expect(object('hund3')).not.toHaveClass(/selected/);
  // A double click inserts once and opens no inspector.
  await input.fill('');
  await object('hund3').dblclick();
  await expect(input).toHaveValue('hund3');
  await expect(inspector).toHaveCount(1);
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  await check('hund1.freund === hund3');
  await object('hund3').click();
  await expect(object('hund3')).toHaveClass(/selected/);
});

test('RT-42 RT-43 a setter that calls itself is a compile warning and a StackOverflowError instead of a crash', async ({ page }) => {
  const files = [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {\n    var herrchen: Mensch? = null\n        set(value) {\n            if (value != null) {\n                herrchen = value\n                alle.add(value)\n            }\n        }\n    var alle: MutableList<Mensch> = mutableListOf<Mensch>()\n}' },
    { fileName: 'Mensch.kt', kind: 'class', source: 'class Mensch {\n    var aua = 0\n}' },
  ];
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify({ format: 'bluek-project', version: 1, files })).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  // Compiled nevertheless; the editor opens with the warning, but no error dialog.
  const warning = page.getByRole('alert', { name: 'Compiler warnings' });
  await expect(warning).toContainText('Line 5 (warning): The setter of `herrchen` assigns `herrchen` and so calls itself endlessly. Write `field = value` to store the value.');
  await expect(page.locator('.cm-bluek-warning-span')).toHaveText('herrchen');
  await expect(page.locator('.compiler-dialog')).toHaveCount(0);
  await warning.getByRole('button', { name: 'Close compiler warnings' }).click();
  await page.locator('.editor-modal').getByRole('button', { name: /Close/ }).first().click();
  await page.getByRole('button', { name: 'Hund', exact: true }).click({ button: 'right' });
  await page.locator('.constructor-menu-item').first().click();
  await page.locator('.create-object-dialog').getByRole('button', { name: /Create|OK/ }).first().click();
  await page.locator('.bench .object').dblclick();
  const inspector = page.getByRole('dialog', { name: 'Object inspector' });
  await inspector.getByLabel('Edit herrchen', { exact: true }).click();
  await inspector.getByLabel('Value of herrchen').fill('Mensch()');
  await inspector.getByLabel('Value of herrchen').press('Enter');
  // It used to be "NullPointerException: Kotlite evaluation failed."
  await expect(inspector.locator('.inspect-error')).toHaveText('StackOverflowError: More than 1000 nested calls. Does a function or property accessor call itself endlessly?');
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

test('GUI-115 object bench scrolls to objects beyond its visible area', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 600 });
  await project(page, 'class Hund {}');
  for (let index = 1; index <= 12; index++) {
    const entry = await evaluate(page, 'Hund()');
    await entry.getByRole('button').click();
    await page.getByLabel('Name of instance').fill(`hund${index}`);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
  }

  const bench = page.locator('.bench');
  const objects = bench.locator('.object');
  await expect(objects).toHaveCount(12);
  await expect.poll(() => bench.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  const benchBox = (await bench.boundingBox())!;
  const last = objects.last();
  const lastBox = (await last.boundingBox())!;
  expect(lastBox.y + lastBox.height).toBeGreaterThan(benchBox.y + benchBox.height);

  await page.mouse.move(benchBox.x + benchBox.width / 2, benchBox.y + benchBox.height / 2);
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => bench.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => last.evaluate(element => {
    const item = element.getBoundingClientRect();
    const viewport = element.closest('.bench')!.getBoundingClientRect();
    return item.top >= viewport.top && item.bottom <= viewport.bottom;
  })).toBe(true);
});

test('GUI-18 primitive inspectors stay compact, show their type and the active inspector is on top', async ({ page }) => {
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
  const compactBox = (await inspectors.nth(0).boundingBox())!;
  expect(compactBox.height).toBeLessThan(200);
  await expect(inspectors.nth(0)).toHaveCSS('padding', '12px');
  await expect(inspectors.nth(0).locator('.inspect-no-fields')).toHaveCSS('cursor', 'grab');
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

test('GUI-87 clicking or dragging an inspector raises it above the editor', async ({ page }) => {
  await project(page, 'class Hund {}');
  const entry = await evaluate(page, 'Hund()');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('hund1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.classcard').dblclick();
  await page.locator('.bench .object').dblclick();
  const inspector = page.locator('.inspector');
  const inspectWindow = inspector.locator('.inspect-window');
  const editor = page.locator('.editor-modal');
  await expect(inspector).toHaveClass(/window-active/);
  const editorHeader = (await editor.locator('.editor-header').boundingBox())!;
  await page.mouse.click(editorHeader.x + editorHeader.width / 2, editorHeader.y + 12);
  await expect(editor).toHaveClass(/window-active/);
  await expect(inspector).not.toHaveClass(/window-active/);

  const initialBox = (await inspectWindow.boundingBox())!;
  await page.mouse.click(initialBox.x + 16, initialBox.y + 16);
  await expect(inspector).toHaveClass(/window-active/);
  await expect(editor).not.toHaveClass(/window-active/);
  expect(Number(await inspector.evaluate((element) => getComputedStyle(element).zIndex)))
    .toBeGreaterThan(Number(await editor.evaluate((element) => getComputedStyle(element).zIndex)));

  await page.mouse.click(editorHeader.x + editorHeader.width / 2, editorHeader.y + 12);
  await expect(editor).toHaveClass(/window-active/);
  const beforeDrag = (await inspectWindow.boundingBox())!;
  await page.mouse.move(beforeDrag.x + 16, beforeDrag.y + 16);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + 116, beforeDrag.y + 96);
  await page.mouse.up();
  await expect(inspector).toHaveClass(/window-active/);
  await expect(editor).not.toHaveClass(/window-active/);
  const afterDrag = (await inspectWindow.boundingBox())!;
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 50);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 50);
  const editorBox = (await editor.locator('.editor-dialog').boundingBox())!;
  const overlap = {
    left: Math.max(afterDrag.x, editorBox.x),
    right: Math.min(afterDrag.x + afterDrag.width, editorBox.x + editorBox.width),
    top: Math.max(afterDrag.y, editorBox.y),
    bottom: Math.min(afterDrag.y + afterDrag.height, editorBox.y + editorBox.height),
  };
  expect(overlap.right - overlap.left).toBeGreaterThan(20);
  expect(overlap.bottom - overlap.top).toBeGreaterThan(20);
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.inspect-window')), {
    x: (overlap.left + overlap.right) / 2,
    y: (overlap.top + overlap.bottom) / 2,
  })).toBe(true);
  await page.mouse.click(editorHeader.x + editorHeader.width / 2, editorHeader.y + 12);
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(inspectWindow).toBeVisible();
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
  await expect(actions).toHaveCount(3);
  await expect(actions.nth(0)).toHaveText(/New Project/);
  await expect(actions.nth(1)).toHaveText(/Open \/ Import/);
  await expect(actions.nth(2)).toHaveText(/Save \/ Export/);
  await actions.nth(1).click();
  const openDialog = page.getByRole('dialog', { name: 'Open / Import' });
  await expect(openDialog.locator('.project-dropzone')).toContainText('JSON');
  await expect(openDialog.locator('.project-dropzone')).toContainText('Accepted: .json');
  await expect(openDialog.getByLabel('Choose project file')).toHaveAttribute('accept', '.json,.bluek.json,application/json');
  await expect(openDialog.getByLabel('Choose project directory')).toHaveCount(0);
  await openDialog.getByRole('button', { name: 'Cancel' }).click();
  await actions.nth(2).click();
  const saveDialog = page.getByRole('dialog', { name: 'Save / Export' });
  await expect(saveDialog.getByRole('button', { name: /Project JSON/ })).toBeEnabled();
  await expect(saveDialog.getByRole('button', { name: /Full Project Link/ })).toBeEnabled();
  await expect(saveDialog.getByRole('button', { name: /BlueJ/ })).toBeDisabled();
  await expect(saveDialog.getByRole('button', { name: /Short Link/ })).toBeEnabled();
  await saveDialog.getByRole('button', { name: 'Cancel' }).click();
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
  // BlueK Demo Project and Space Invaders Demo are visually set apart from the
  // three primary templates above them and carry a note that they are only
  // there to test and demonstrate BlueK.
  const primaryGap = boxes[2]!.y - boxes[1]!.y;
  const secondaryGap = boxes[3]!.y - boxes[2]!.y;
  expect(secondaryGap).toBeGreaterThan(primaryGap);
  await expect(dialog.locator('.project-choice-note')).toContainText('test and demonstrate BlueK');
  await expect(dialog.locator('.project-choice-note')).toContainText('removed in the long run');
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
    await dialog.getByRole('button', { name: /^BluePlay Template/ }).click();
    await expect(page.locator('.classcard[aria-label="World"]')).toBeVisible();
    await page.getByRole('button', { name: 'New Project', exact: true }).click();
    const replaceDialog = page.getByRole('dialog', { name: 'Create New Project' });
    page.once('dialog', browserDialog => browserDialog.accept());
    await replaceDialog.getByRole('button', { name: new RegExp('^' + name) }).click();
    await expect(replaceDialog).toBeHidden();
    await expect(page.locator('.classcard')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'README.md' })).toHaveCount(0);
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
  const splitButton = page.getByLabel('Split terminal to the right');
  const splitIcon = splitButton.locator('.terminal-split-icon');
  const maximizeIcon = page.getByLabel('Maximize terminal window').locator('.window-control-icon');
  await expect(splitIcon).toHaveCSS('width', '18px');
  await expect(splitIcon).toHaveCSS('width', await maximizeIcon.evaluate((icon) => getComputedStyle(icon).width));
  await expect(splitIcon).toHaveCSS('stroke-width', '2px');
  await expect(splitIcon.locator('rect')).toHaveAttribute('rx', '2.5');
  await expect(maximizeIcon.locator('rect')).toHaveAttribute('rx', '2.5');
  await expect(splitIcon.locator('path')).toHaveAttribute('d', 'M12 4.5v15');
  await splitButton.click();
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

test('GUI-99 an object inspector covers the terminal split handle', async ({ page }) => {
  await project(page, 'class Karte(var farbe: String, var rang: String)');
  await page.getByLabel('Show terminal', { exact: true }).click();
  await page.getByLabel('Split terminal to the right').click();
  const entry = await evaluate(page, 'Karte("kreuz", "8")');
  await entry.getByRole('button').click();
  await page.getByLabel('Name of instance').fill('karte1');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('.bench .object').dblclick();
  const inspector = page.locator('.inspect-window');
  const divider = (await page.locator('.terminal-split-divider').boundingBox())!;
  const x = divider.x + divider.width / 2;
  // Move the inspector over the handle, as in the user's screenshot.
  const before = (await inspector.boundingBox())!;
  await page.mouse.move(before.x + 16, before.y + 16);
  await page.mouse.down();
  await page.mouse.move(x - before.width / 2 + 16, divider.y + divider.height / 2 - before.height / 2 + 16, { steps: 5 });
  await page.mouse.up();
  const box = (await inspector.boundingBox())!;
  expect(box.x).toBeLessThan(x - 20);
  expect(box.x + box.width).toBeGreaterThan(x + 20);
  const y = box.y + box.height / 2;
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.inspect-window')), { x, y })).toBe(true);
  // The handle still resizes the split where no window covers it.
  const terminalBefore = (await page.locator('.terminal-window').boundingBox())!;
  await page.mouse.move(x, 30);
  await page.mouse.down();
  await page.mouse.move(x - 40, 30, { steps: 5 });
  await page.mouse.up();
  const terminalAfter = (await page.locator('.terminal-window').boundingBox())!;
  expect(Math.abs(terminalAfter.width - terminalBefore.width - 40)).toBeLessThan(3);
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

test('GUI-79 Files is gone and only BluePlay projects get Images and Audio', async ({ page }) => {
  await project(page);
  await expect(page.getByRole('button', { name: 'Files', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Images', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Audio', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: /^BluePlay Template/ }).click();
  await expect(page.getByRole('button', { name: 'Files', exact: true })).toHaveCount(0);
  const imagesButton = page.getByRole('button', { name: 'Images', exact: true });
  const audioButton = page.getByRole('button', { name: 'Audio', exact: true });
  for (const button of [imagesButton, audioButton]) {
    await expect(button).toHaveText('');
    await expect(button.locator('svg')).toHaveCount(1);
  }

  await imagesButton.click();
  const images = page.getByRole('dialog', { name: 'Images' });
  await expect(images.locator('.standard-image-tile').first()).toHaveAccessibleName('Add image');
  await expect(images.getByLabel('duck.png', { exact: true })).toContainText('duck.png');
  await expect(images.getByRole('img', { name: 'duck.png' })).toBeVisible();
  await images.getByRole('button', { name: 'Add image' }).click();
  const notice = page.getByRole('alertdialog', { name: 'Not implemented' });
  await expect(notice).toContainText('Adding images is not implemented yet.');
  await notice.getByRole('button', { name: 'OK' }).click();
  await images.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(images).toHaveCount(0);

  await audioButton.click();
  await expect(notice).toContainText('Audio support is not implemented yet.');
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(notice).toHaveCount(0);
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

test('GUI-63 the sidebar explains the offline version before downloading it', async ({ page }) => {
  await project(page);
  let downloads = 0;
  page.on('download', () => { downloads++; });
  const downloadButton = page.locator('.sidebar-utilities').getByRole('button', { name: /Offline Version/ });
  await downloadButton.click();
  const dialog = page.getByRole('dialog', { name: 'BlueK Offline' });
  await expect(dialog).toContainText('without downloading anything');
  await expect(dialog).toContainText('BlueK.html');
  await expect(dialog).toContainText('Autosave');
  await expect(dialog).toContainText('not yet been widely tested in practice');
  await expect(dialog).toContainText('with your own projects and browser before relying on it');
  const reportBug = dialog.getByRole('link', { name: 'Report a bug on GitHub', exact: true });
  await expect(reportBug).toHaveAttribute('href', 'https://github.com/tomkarp/BlueK/issues/new');
  await expect(reportBug).toHaveAttribute('target', '_blank');
  await expect(reportBug).toHaveAttribute('rel', 'noopener noreferrer');
  expect(downloads).toBe(0);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await downloadButton.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await downloadButton.click();
  const link = dialog.getByRole('link', { name: 'Download ZIP', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('download', 'BlueK-offline.zip');

  const href = await link.getAttribute('href') ?? '';
  expect(new URL(href, 'http://x/').pathname).toBe('/downloads/BlueK-offline.zip');
  const zip = await page.request.get(new URL(href, page.url()).toString());
  expect(zip.status()).toBe(200);
  expect((await zip.body()).byteLength).toBeGreaterThan(100_000);
  await page.setViewportSize({ width: 800, height: 600 });
  await link.scrollIntoViewIfNeeded();
  const cancelBounds = await dialog.getByRole('button', { name: 'Cancel', exact: true }).boundingBox();
  expect(cancelBounds!.y + cancelBounds!.height).toBeLessThanOrEqual(600);
  await page.screenshot({ path: 'test-results/offline-download-notice.png' });
  const download = page.waitForEvent('download');
  await link.click();
  expect((await download).suggestedFilename()).toBe('BlueK-offline.zip');
  expect(downloads).toBe(1);
  await expect(dialog).toHaveCount(0);
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

test('RT-50 nullable for-loop reports iterator requirement at the subject', async ({ page }) => {
  // Keep an explicitly nullable test property independent of Actor.world's API.
  const source = 'class Krokodil { val world: World? = null\n    fun act() {\n        for (ente in world?.getObjects<Ente>()) {}\n    }\n}';
  const payload = { format: 'bluek-project', version: 1, library: { id: 'blueplay', version: 1 }, files: [
    { fileName: 'Krokodil.kt', kind: 'class', source },
    { fileName: 'Ente.kt', kind: 'class', source: 'class Ente : Actor()' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  const editor = page.locator('.editor-dialog');
  await expect(editor.locator('.editor-header h3')).toHaveText('Krokodil.kt');
  await expect(editor.locator('.editor-diagnostics')).toContainText("Line 3: Non-nullable value required to call 'iterator()' method in a for-loop.");
  await expect(editor.locator('.cm-bluek-error-span')).toHaveText('world');
  await expect(editor.locator('.cm-bluek-error-line')).toContainText('for (ente in world?.getObjects<Ente>())');
  await expect(editor.locator('.editor-diagnostics')).not.toContainText('Only safe');
  const line = editor.locator('.cm-line').filter({ hasText: 'for (ente in' });
  await line.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.type('        for (ente in world?.getObjects<Ente>() ?: listOf<Ente>()) {}');
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await expect(editor.locator('.editor-diagnostics')).toHaveCount(0);
});

test('RT-40 classes that reference each other compile and link their objects', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {\n    var herrchen: Mensch? = null\n    val alle = mutableListOf<Mensch>()\n}' },
    { fileName: 'Mensch.kt', kind: 'class', source: 'class Mensch(var hund: Hund? = null) {\n    fun kaufen(): Hund {\n        val h = Hund()\n        h.herrchen = this\n        hund = h\n        return h\n    }\n}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await expect(page.locator('.classcard.uncompiled')).toHaveCount(0);
  await expect(page.locator('.editor-diagnostics')).toHaveCount(0);
  const result = await evaluate(page, 'val m = Mensch(); val h = m.kaufen(); h.alle.add(m); h.herrchen === m && m.hund === h && h.alle.size == 1');
  await expect(result).toContainText('true');
});

test('RT-45 top-level functions and properties of a later file can be used', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    println(hilfe() + Hund().f())\n}' },
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {\n    fun f() = maximum + 1\n}' },
    { fileName: 'Util.kt', kind: 'functions', source: 'fun hilfe(): Int = 1\nval maximum = 3' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await expect(page.getByLabel('Ready', { exact: true })).toBeVisible();
  await expect(page.locator('.classcard.uncompiled')).toHaveCount(0);
  await expect(page.locator('.editor-diagnostics')).toHaveCount(0);
  await evaluate(page, 'main()');
  await expect(page.locator('.terminal-output pre')).toHaveText('5\n');
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
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('bluek.project-draft.v1.' + sessionStorage.getItem('bluek.tab-draft.v1')) || '{}').project || {});
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
  // Opening a full project link again also works as a hash-only navigation.
  const dialog = page.getByRole('dialog', { name: 'README.md' });
  await expect(dialog.locator('.cm-md-h1')).toHaveText('Hunde');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // The dialog offers exactly that for the links it copies.
  await page.getByRole('button', { name: 'Save / Export' }).click();
  const save = page.getByRole('dialog', { name: 'Save / Export' });
  // The links come first, then the file exports.
  await expect(save.locator('.project-choice-list button strong')).toHaveText([
    'Copy Full Project Link', 'Copy Short Link', 'Export Project JSON', 'Export as HTML (Beta)', 'Export BlueJ Project (.zip)',
  ]);
  // One shared option row applies to both kinds of project links.
  await expect(save.getByLabel(/Open README.md with the link/)).toHaveCount(1);
  await save.getByLabel(/Open README.md with the link/).check();
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
  await page.waitForURL(url => !url.hash);
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
  const toggle = settings.getByLabel('Vim mode', { exact: true });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await editor.locator('.cm-line').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('j');
  await expect(editor.locator('.cm-line').first()).toHaveText('jclass Hund {');
});

test('GUI-71 Dark mode can be switched on and off in Settings', async ({ page }) => {
  await project(page, 'class Hund {}');
  const root = page.locator('.bluek');
  await expect(root).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const toggle = settings.getByLabel('Dark mode', { exact: true });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(root).toHaveClass(/dark/);
  await expect(root).toHaveCSS('background-color', 'rgb(30, 30, 30)');
  const settingsClose = settings.getByRole('button', { name: 'Close', exact: true });
  await expect(settingsClose).toHaveCSS('background-color', 'rgb(48, 48, 52)');
  await expect(settingsClose).toHaveCSS('border-top-style', 'solid');
  await expect(settingsClose).toHaveCSS('box-shadow', 'none');
  // The open editor's own CodeMirror theme follows the same switch.
  await settingsClose.click();
  const primaryAction = page.locator('.toolbar-main-action').first();
  await primaryAction.hover();
  await expect(primaryAction).toHaveCSS('background-color', 'rgb(69, 69, 74)');
  await page.getByRole('button', { name: 'Show terminal', exact: true }).click();
  await page.mouse.move(0, 0);
  const terminalToggle = page.getByRole('button', { name: 'Hide terminal', exact: true });
  await expect(terminalToggle).toHaveCSS('color', 'rgb(212, 212, 212)');
  await expect(terminalToggle.locator('svg')).toHaveCSS('stroke', 'rgb(212, 212, 212)');
  await terminalToggle.click();
  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog .cm-editor');
  await expect(editor).toHaveCSS('background-color', 'rgb(30, 30, 30)');
  const formatButton = page.getByRole('button', { name: 'Format Kotlin file' });
  await formatButton.hover();
  await expect(formatButton).toHaveCSS('background-color', 'rgb(80, 80, 87)');
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'New File', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create New Kotlin File' }).getByLabel('Name'))
    .toHaveCSS('background-color', 'rgb(60, 60, 60)');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('.classcard').dblclick();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await toggle.uncheck();
  await expect(root).not.toHaveClass(/dark/);
  await expect(editor).not.toHaveCSS('background-color', 'rgb(30, 30, 30)');
});

test('GUI-74 Settings are grouped into General and Editor with English as the available language', async ({ page }) => {
  await project(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const sections = settings.locator('.settings-section');
  await expect(sections).toHaveCount(2);
  await expect(sections.nth(0).getByRole('heading', { name: 'General', exact: true })).toBeVisible();
  await expect(sections.nth(1).getByRole('heading', { name: 'Editor', exact: true })).toBeVisible();
  const language = settings.getByLabel('Language', { exact: true });
  await expect(language).toHaveValue('en');
  await expect(language.locator('option')).toHaveText(['English (only for now)']);
  await expect(sections.nth(0).getByLabel('Dark mode', { exact: true })).toBeVisible();
  await expect(sections.nth(1).getByLabel('Font size', { exact: true })).toBeVisible();
  await expect(sections.nth(1).getByLabel('Vim mode', { exact: true })).toBeVisible();
});

test('GUI-72 the toolbar switches to icon-only mode by its own width, not the window width', async ({ page }) => {
  await page.setViewportSize({ width: 1350, height: 800 });
  await project(page, 'class Hund {}');
  const actions = page.locator('.toolbar-main-action');
  const label = actions.first().locator('span:not(.toolbar-action-icon)');
  await expect(label).toBeVisible();
  // Splitting the terminal narrows the toolbar (1350 - 430 = 920px) without
  // shrinking the window itself — the old width media query only watched the
  // window and missed this, leaving the icons hidden behind the terminal.
  await page.getByLabel('Show terminal', { exact: true }).click();
  await page.getByLabel('Split terminal to the right').click();
  await expect(label).toBeVisible();
  await expect(page.getByLabel('Hide terminal', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/inheritance arrows/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  // Narrowing further (1150 - 430 = 720px) still collapses to icons, same as
  // a plain window resize would.
  await page.setViewportSize({ width: 1150, height: 800 });
  await expect(label).toBeHidden();
});

test('GUI-74 inheritance mode explains both class selections', async ({ page }) => {
  await project(page, 'class Hund {}');
  await page.getByRole('button', { name: 'New File', exact: true }).click();
  const newFile = page.getByRole('dialog', { name: 'Create New Kotlin File' });
  await newFile.getByLabel('Name').fill('Parent');
  await newFile.getByRole('radio', { name: 'Open Class' }).check();
  await newFile.getByRole('button', { name: 'Create', exact: true }).click();

  await page.getByRole('button', { name: 'Inheritance', exact: true }).click();
  const hint = page.getByRole('status');
  await expect(hint).toHaveText('Select a subclass, then its superclass.');
  await page.getByRole('button', { name: 'Hund', exact: true }).click();
  await expect(hint).toHaveText('Now select its superclass.');
  await page.getByRole('button', { name: 'Parent', exact: true }).click();
  await expect(hint).toHaveCount(0);
});

test('GUI-75 class cards snap to a shared invisible grid while dragging', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {}' },
    { fileName: 'Katze.kt', kind: 'class', source: 'class Katze {}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  const cards = page.locator('.classcard');
  const first = cards.nth(0);
  const second = cards.nth(1);

  async function position(card: typeof first) {
    return card.evaluate((element) => ({
      x: Number.parseFloat((element as HTMLElement).style.left),
      y: Number.parseFloat((element as HTMLElement).style.top),
    }));
  }

  async function dragBy(card: typeof first, dx: number, dy: number) {
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 4 });
    await page.mouse.up();
  }

  await dragBy(first, 137, 77);
  const firstPosition = await position(first);
  expect(firstPosition.x % 20).toBe(0);
  expect(firstPosition.y % 20).toBe(0);

  const secondPosition = await position(second);
  await dragBy(second, firstPosition.x - secondPosition.x, firstPosition.y + 160 - secondPosition.y);
  const alignedPosition = await position(second);
  expect(alignedPosition.x).toBe(firstPosition.x);
  expect(alignedPosition.y - firstPosition.y).toBe(160);
});

test('GUI-102 class cards can be dragged beyond the visible diagram, which then scrolls', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, files: [
    { fileName: 'Hund.kt', kind: 'class', source: 'class Hund {}' },
  ] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  const card = page.locator('.classcard').first();
  const canvas = page.locator('.canvas');
  const canvasBox = (await canvas.boundingBox())!;
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width - 10, box.y + box.height / 2, { steps: 4 });
  // Scrolling is time-based: it must not depend on the number of mouse events.
  await page.waitForTimeout(500);
  const scrolled = await canvas.evaluate((element) => element.scrollLeft);
  expect(scrolled).toBeGreaterThan(0);
  expect(scrolled).toBeLessThan(500);
  // Moving back must not shrink the scroll area under the drag: the card
  // stays under the pointer instead of racing away.
  const backX = canvasBox.x + canvasBox.width / 2;
  for (let x = canvasBox.x + canvasBox.width - 10; x > backX; x -= 20) {
    await page.mouse.move(x, box.y + box.height / 2);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(300);
  const underPointer = (await card.boundingBox())!;
  expect(Math.abs(underPointer.x + underPointer.width / 2 - backX)).toBeLessThanOrEqual(30);
  // ... and the view does not jump back to the start when the card leaves the far end.
  expect(await canvas.evaluate((element) => element.scrollLeft)).toBeGreaterThanOrEqual(scrolled);
  await page.mouse.move(canvasBox.x + canvasBox.width - 10, box.y + box.height / 2, { steps: 4 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  const left = await card.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
  expect(left % 20).toBe(0);
  expect(left).toBeGreaterThan(canvasBox.width - 250);
  const scrollable = await canvas.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth, left: element.scrollLeft }));
  expect(scrollable.scroll).toBeGreaterThan(scrollable.client);
  expect(scrollable.left).toBeGreaterThan(0);
});

test('GUI-77 the left action names the main entry point instead of Run', async ({ page }) => {
  await project(page, 'fun main() {}');
  const startMain = page.getByRole('button', { name: 'Start main', exact: true });
  await expect(startMain).toBeVisible();
  await expect(startMain).toHaveText('Start main');
  await expect(startMain).toHaveAttribute('title', /Start main/);
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toHaveCount(0);
});

test('GUI-80 project name field does not intercept clicks on project actions', async ({ page }) => {
  await project(page);
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: /^BluePlay Template/ }).click();

  await expect(page.getByLabel('Project name')).toBeVisible();
  const images = await page.getByRole('button', { name: 'Images', exact: true }).boundingBox();
  const audio = await page.getByRole('button', { name: 'Audio', exact: true }).boundingBox();
  const title = await page.getByLabel('Project name').boundingBox();
  expect(images && audio && title).toBeTruthy();
  expect(images!.x + images!.width).toBeLessThan(audio!.x);
  expect(audio!.x + audio!.width).toBeLessThan(title!.x);

  const projectName = page.getByLabel('Project name');
  await projectName.fill('  Mein BluePlay  ');
  await projectName.press('Enter');
  await expect(projectName).toHaveValue('Mein BluePlay');
  await expect(projectName).not.toBeFocused();

  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create New Project' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'New File', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create New Kotlin File' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Create New Kotlin File' }).getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeVisible();
  await expect(page.locator('.sidebar-utilities').getByRole('button', { name: /Offline Version/ })).toBeVisible();
});

test('GUI-78 selected Kotlin lines can be commented and uncommented by button and slash shortcut', async ({ page }) => {
  await project(page, 'class Hund {\n    fun eins() {}\n    fun zwei() {}\n}');
  await page.locator('.classcard').dblclick();
  const editor = page.locator('.editor-dialog .cm-editor');
  const lines = editor.locator('.cm-line');

  async function selectTwoLines() {
    await lines.nth(1).click({ position: { x: 14, y: 10 } });
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.up('Shift');
  }

  const comment = page.getByRole('button', { name: 'Toggle line comments', exact: true });
  await expect(comment).toHaveAttribute('title', /Comment \/ uncomment lines \((Cmd|Ctrl)\+\/\)/);
  await selectTwoLines();
  await comment.click();
  await expect(lines.nth(1)).toContainText('//');
  await expect(lines.nth(2)).toContainText('//');

  await selectTwoLines();
  await page.keyboard.press('ControlOrMeta+Shift+7');
  await expect(lines.nth(1)).not.toContainText('//');
  await expect(lines.nth(2)).not.toContainText('//');
});

test('RT-33 Export Project JSON keeps its file name and content', async ({ page }) => {
  const payload = { format: 'bluek-project', version: 1, projectName: 'Hunde: Teil 1/2',
    files: [{ fileName: 'Hund.kt', kind: 'class', source: 'class Hund' }] };
  await page.goto('/#bluek=p1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
  await expect(page.getByLabel('Project name')).toHaveValue('Hunde: Teil 1/2');
  await page.getByRole('button', { name: 'Save / Export' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('dialog', { name: 'Save / Export' }).getByRole('button', { name: /Export Project JSON/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Hunde- Teil 1-2.bluek.json');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const saved = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(saved).toMatchObject({ format: 'bluek-project', version: 1, projectName: 'Hunde: Teil 1/2',
    files: [{ fileName: 'Hund.kt', kind: 'class', source: 'class Hund' }] });
});
