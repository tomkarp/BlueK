<script lang="ts">
  import TranslatedText from "./TranslatedText.svelte";
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const { t } = language;
  import type { Action } from "svelte/action";
  import type { EditorOptions } from "../editorActions";
  import type { TestWorkspace } from "../workspace/TestWorkspace.svelte";
  import { containClicks, focusOnMount } from "../uiActions";
  let {
    tests,
    stop,
    codeMirror,
    editorFontSize,
    vimMode,
    darkMode,
    commentShortcutLabel,
    formatShortcutLabel,
    toggleEditorComments,
    formatEditor,
    dialogError,
    closeFormatError,
  }: {
    tests: TestWorkspace;
    stop: () => Promise<void>;
    codeMirror: Action<HTMLElement, EditorOptions>;
    editorFontSize: number;
    vimMode: boolean;
    darkMode: boolean;
    commentShortcutLabel: string;
    formatShortcutLabel: string;
    toggleEditorComments: (id: string) => void;
    formatEditor: (id: string) => void;
    dialogError: string;
    closeFormatError: () => void;
  } = $props();
  let expanded = $state("");
  let counts = $derived(
    tests.state?.cases.reduce<Record<string, number>>(
      (r, c) => ({ ...r, [c.status]: (r[c.status] || 0) + 1 }),
      {},
    ) || {},
  );
</script>

{#if tests.open}
  <aside
    class="test-panel"
    aria-label={t("ui.testing.tests")}
    use:containClicks
  >
    <header>
      <strong>{t("ui.testing.testsKotlinTest")}</strong><button
        aria-label={t("ui.testing.closeTests")}
        onclick={() => (tests.open = false)}>×</button
      >
    </header>
    <div class="test-controls">
      <select
        aria-label={t("ui.testing.testClass")}
        value={tests.selectedClass}
        onchange={(event) => (tests.selected = event.currentTarget.value)}
        disabled={!tests.canRun}
      >
        <option value="">{t("ui.testing.allTestClasses")}</option>
        {#each tests.stateClasses as suite}<option value={suite.name}
            >{suite.name}</option
          >{/each}
      </select>
      <button
        onclick={() => tests.run(tests.selectedClass)}
        disabled={!tests.canRun}>{t("ui.common.runTests")}</button
      >
      <button
        onclick={() => void stop()}
        disabled={!tests.busy && !tests.state?.recording}
        >{t("ui.testing.stop")}</button
      >
    </div>
    {#if tests.selectedClass && !tests.state?.recording}
      <div class="test-controls">
        <button
          onclick={() => tests.fixture(tests.selectedClass)}
          disabled={!tests.canRun}>{t("ui.testing.loadState")}</button
        >
        <button
          onclick={() => tests.capture(tests.selectedClass)}
          disabled={!tests.ready || !tests.state?.canCapture}
          >{t("ui.testing.saveState")}</button
        >
        <button
          onclick={() => tests.record(tests.selectedClass)}
          disabled={!tests.canRun}>{t("ui.common.recordTest")}</button
        >
      </div>
    {/if}
    {#if tests.state?.recording}
      <section
        class="test-recording"
        aria-label={t("ui.testing.testRecording")}
      >
        <strong>{t("ui.testing.recording")} {tests.state.recording}</strong>
        <p>
          {t("ui.testing.createObjectsAndCallMethodsInEachResult")}
        </p>
        <label
          >{t("ui.testing.testMethodName")}<input
            bind:value={tests.methodName}
            placeholder="testBirthday"
          /></label
        >
        <button
          disabled={!tests.ready}
          onclick={() => tests.capture(tests.state!.recording!, true)}
          >{t("ui.testing.finishRecording")}</button
        >
        <button disabled={!tests.ready} onclick={tests.cancel}
          >{t("ui.testing.cancelRecording")}</button
        >
      </section>
    {/if}
    {#if tests.error}<p class="dialog-error" role="alert">
        {$language.message(tests.error)}
      </p>{/if}
    {#if tests.state?.captureError}<p class="test-notice">
        {tests.state.captureError}
      </p>{/if}
    {#if tests.state?.status === "completed" && !tests.state.cases.length}
      <div class="test-summary" role="status">
        {t("ui.testing.noTestMethodsFoundUseRecordTestTo")}
      </div>
    {/if}
    {#if tests.state?.cases.length}
      <div class="test-summary" role="status">
        {$language.message(tests.state.status)} · {t(
          "ui.testing.resultCounts",
          [
            counts.passed || 0,
            (counts.failed || 0) + (counts.error || 0),
            counts.ignored || 0,
          ],
        )}
      </div>
      <div class="test-results">
        {#each tests.state.cases as result}
          <div class={`test-result ${result.status}`}>
            <button
              onclick={() =>
                (expanded =
                  expanded === result.className + result.name
                    ? ""
                    : result.className + result.name)}
              >{$language.message(result.status)} · {result.className}.{result.name}</button
            >
            <button
              aria-label={t("ui.testing.run0", [result.name])}
              title={t("ui.testing.runThisTest")}
              disabled={!tests.canRun}
              onclick={() => tests.run(result.className, result.name)}>▶</button
            >
            {#if expanded === result.className + result.name}<div
                class="test-details"
              >
                <button onclick={() => tests.reveal(result)}
                  >{t("ui.testing.openSource")}</button
                >
                <pre>{result.errors.join("\n\n") ||
                    $language.message(result.status)}</pre>
              </div>{/if}
          </div>
        {/each}
      </div>
    {/if}
    {#if !tests.state?.recording}
      {#if !tests.state?.cases.length}
        <p class="test-notice">
          {t("ui.testing.rightClickAClassToCreateItsTest")}
        </p>
      {/if}
      {#each tests.stateClasses.filter((suite) => !tests.selectedClass || suite.name === tests.selectedClass) as suite}
        <section
          class="test-suite"
          aria-label={t("ui.testing.testClass0", [suite.name])}
        >
          <div class="test-suite-header">
            <strong>{suite.name}</strong><button
              aria-label={t("ui.testing.recordTestIn0", [suite.name])}
              disabled={!tests.canRun}
              onclick={() => tests.record(suite.name)}
              >{t("ui.common.recordTest")}</button
            >
          </div>
          {#each (!tests.state?.cases.length ? tests.suites.find((item) => item.name === suite.name)?.testing?.methods : []) || [] as method}<button
              class="test-discovered"
              disabled={!tests.canRun}
              onclick={() => tests.run(suite.name, method.name)}
              >▶ {suite.name}.{method.name}{method.ignored
                ? t("ui.testing.ignored2")
                : ""}</button
            >{/each}
        </section>
      {/each}
    {/if}
  </aside>
{/if}
{#if tests.newClass}<div class="modal topmost-modal">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t("ui.common.createTestClass")}
      use:containClicks
    >
      <h3>{t("ui.common.createTestClass")}</h3>
      <label
        >{t("ui.testing.className")}<input
          bind:value={tests.className}
          use:focusOnMount
          onkeydown={(e) => e.key === "Enter" && tests.create()}
        /></label
      >
      <p>{t("ui.testing.attachedClass", [tests.newClass.fileName])}</p>
      {#if tests.error}<p role="alert" class="dialog-error">
          {$language.message(tests.error)}
        </p>{/if}
      <div class="dialog-actions">
        <button onclick={() => (tests.newClass = null)}
          >{t("ui.common.cancel")}</button
        ><button onclick={tests.create}>{t("ui.common.create")}</button>
      </div>
    </div>
  </div>{/if}
{#if tests.createFixtureClass}<div class="modal topmost-modal">
    <div
      class="dialog fixture-class-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t("ui.testing.createTestClassForState")}
      use:containClicks
    >
      <h3>{t("ui.testing.saveObjectBenchAsTestState")}</h3>
      <p>
        {t("ui.testing.createATestClassForThisObjectBench")}
      </p>
      <label
        >{t("ui.testing.testClassName")}<input
          bind:value={tests.fixtureClassName}
          use:focusOnMount
          onkeydown={(e) => e.key === "Enter" && tests.createFixtureFromBench()}
        /></label
      >
      {#if tests.error}<p role="alert" class="dialog-error">
          {$language.message(tests.error)}
        </p>{/if}
      <div class="dialog-actions">
        <button onclick={() => (tests.createFixtureClass = false)}
          >{t("ui.common.cancel")}</button
        ><button onclick={tests.createFixtureFromBench}
          >{t("ui.testing.continue")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if tests.chooseDefaultOpen}<div class="modal topmost-modal">
    <div
      class="dialog fixture-class-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t("ui.common.chooseDefaultTestClass")}
      use:containClicks
    >
      <h3>{t("ui.testing.defaultTestClass")}</h3>
      <label
        >{t("ui.testing.useThisClassForSavingAndLoadingTest")}<select
          aria-label={t("ui.testing.defaultTestClassSelection")}
          bind:value={tests.chosenDefaultClass}
        >
          {#each tests.stateClasses as suite}<option value={suite.name}
              >{suite.name}</option
            >{/each}
        </select></label
      >
      {#if tests.error}<p role="alert" class="dialog-error">
          {$language.message(tests.error)}
        </p>{/if}
      <div class="dialog-actions">
        <button onclick={() => (tests.chooseDefaultOpen = false)}
          >{t("ui.common.cancel")}</button
        ><button onclick={tests.confirmDefaultClass}
          >{t("ui.testing.useTestClass")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if tests.preview}<div class="modal topmost-modal">
    <div
      class="dialog test-source-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={tests.preview.recording
        ? t("ui.testing.saveRecordedTest")
        : t("ui.testing.saveTestState")}
      use:containClicks
    >
      <div class="test-source-content">
        <h3>
          {tests.preview.recording
            ? t("ui.testing.saveRecordedTest")
            : t("ui.testing.saveObjectBenchAsTestState")}
        </h3>
        <p>
          {tests.preview.fileName}
          {t(
            "ui.testing.replayUsesConstructorsCallsAndAssignmentsExternalEffects",
          )}
        </p>
        {#if tests.preview.replacesFixture}
          <p class="dialog-warning" role="alert">
            <TranslatedText
              message={tests.preview.replacesInitializers
                ? "ui.testing.replaceWithInitWarning"
                : "ui.testing.replaceWarning"}
            />
          </p>
        {/if}
        <div
          class="svelte-editor-host test-source-editor"
          role="group"
          aria-label={t("ui.testing.generatedKotlinSource")}
          use:codeMirror={{
            phrases: $language.editorPhrases,
            id: "test-source-preview",
            value: tests.preview.source,
            fontSize: editorFontSize,
            onChange: (value: string) => {
              if (tests.preview) tests.preview.source = value;
            },
            diagnostics: [],
            diagnosticsRun: 0,
            vim: vimMode,
            dark: darkMode,
            editable: !tests.busy,
          }}
        >
          <div
            class="editor-actions"
            role="toolbar"
            aria-label={t("ui.common.editorActions")}
          >
            <button
              class="editor-action editor-comment"
              onclick={() => toggleEditorComments("test-source-preview")}
              aria-label={t("ui.common.toggleLineComments")}
              title={t("ui.common.commentUncommentLines0", [
                commentShortcutLabel,
              ])}>//</button
            ><button
              class="editor-action editor-format"
              onclick={() => formatEditor("test-source-preview")}
              aria-label={t("ui.common.formatKotlinFile")}
              title={t("ui.common.formatKotlinFile0", [formatShortcutLabel])}
              >≡</button
            >
          </div>
        </div>
        {#if dialogError}<div
            class="dialog-error editor-dialog-error"
            role="alert"
          >
            <span>{dialogError}</span><button
              type="button"
              class="dialog-error-close"
              aria-label={t("ui.common.closeFormatError")}
              title={t("ui.common.closeFormatError")}
              onclick={closeFormatError}>×</button
            >
          </div>{/if}
        {#if tests.error}<p class="dialog-error" role="alert">
            {$language.message(tests.error)}
          </p>{/if}
      </div>
      <div class="dialog-actions">
        <button disabled={tests.busy} onclick={() => (tests.preview = null)}
          >{t("ui.common.cancel")}</button
        ><button disabled={tests.busy} onclick={tests.save}
          >{tests.preview.replacesFixture
            ? t("ui.testing.replaceStateCompile")
            : t("ui.testing.saveCompile")}</button
        >
      </div>
    </div>
  </div>{/if}
