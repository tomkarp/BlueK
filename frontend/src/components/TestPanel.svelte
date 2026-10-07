<script lang="ts">
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
  <aside class="test-panel" aria-label="Tests" use:containClicks>
    <header>
      <strong>Tests · kotlin.test</strong><button
        aria-label="Close Tests"
        onclick={() => (tests.open = false)}>×</button
      >
    </header>
    <div class="test-controls">
      <select
        aria-label="Test class"
        value={tests.selectedClass}
        onchange={(event) => (tests.selected = event.currentTarget.value)}
        disabled={!tests.canRun}
      >
        <option value="">All test classes</option>
        {#each tests.stateClasses as suite}<option value={suite.name}
            >{suite.name}</option
          >{/each}
      </select>
      <button
        onclick={() => tests.run(tests.selectedClass)}
        disabled={!tests.canRun}>Run Tests</button
      >
      <button
        onclick={() => void stop()}
        disabled={!tests.busy && !tests.state?.recording}>Stop</button
      >
    </div>
    {#if tests.selectedClass && !tests.state?.recording}
      <div class="test-controls">
        <button
          onclick={() => tests.fixture(tests.selectedClass)}
          disabled={!tests.canRun}>Load State</button
        >
        <button
          onclick={() => tests.capture(tests.selectedClass)}
          disabled={!tests.ready || !tests.state?.canCapture}>Save State</button
        >
        <button
          onclick={() => tests.record(tests.selectedClass)}
          disabled={!tests.canRun}>Record Test…</button
        >
      </div>
    {/if}
    {#if tests.state?.recording}
      <section class="test-recording" aria-label="Test recording">
        <strong>● Recording {tests.state.recording}</strong>
        <p>
          Create objects and call methods. In each result dialog you can add an
          assertion.
        </p>
        <label
          >Test method name<input
            bind:value={tests.methodName}
            placeholder="testBirthday"
          /></label
        >
        <button
          disabled={!tests.ready}
          onclick={() => tests.capture(tests.state!.recording!, true)}
          >Finish Recording…</button
        >
        <button disabled={!tests.ready} onclick={tests.cancel}
          >Cancel Recording</button
        >
      </section>
    {/if}
    {#if tests.error}<p class="dialog-error" role="alert">{tests.error}</p>{/if}
    {#if tests.state?.captureError}<p class="test-notice">
        {tests.state.captureError}
      </p>{/if}
    {#if tests.state?.status === "completed" && !tests.state.cases.length}
      <div class="test-summary" role="status">
        No @Test methods found. Use Record Test to add one.
      </div>
    {/if}
    {#if tests.state?.cases.length}
      <div class="test-summary" role="status">
        {tests.state.status} · {counts.passed || 0} passed · {(counts.failed ||
          0) + (counts.error || 0)} failed · {counts.ignored || 0} ignored
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
              >{result.status} · {result.className}.{result.name}</button
            >
            <button
              aria-label={`Run ${result.name}`}
              title="Run this test"
              disabled={!tests.canRun}
              onclick={() => tests.run(result.className, result.name)}>▶</button
            >
            {#if expanded === result.className + result.name}<div
                class="test-details"
              >
                <button onclick={() => tests.reveal(result)}>Open source</button
                >
                <pre>{result.errors.join("\n\n") || result.status}</pre>
              </div>{/if}
          </div>
        {/each}
      </div>
    {/if}
    {#if !tests.state?.recording}
      {#if !tests.state?.cases.length}
        <p class="test-notice">
          Right-click a class to create its test class. Add @Test methods, or
          use Record Test.
        </p>
      {/if}
      {#each tests.stateClasses.filter((suite) => !tests.selectedClass || suite.name === tests.selectedClass) as suite}
        <section class="test-suite" aria-label={`Test class ${suite.name}`}>
          <div class="test-suite-header">
            <strong>{suite.name}</strong><button
              aria-label={`Record test in ${suite.name}`}
              disabled={!tests.canRun}
              onclick={() => tests.record(suite.name)}>Record Test…</button
            >
          </div>
          {#each (!tests.state?.cases.length ? tests.suites.find((item) => item.name === suite.name)?.testing?.methods : []) || [] as method}<button
              class="test-discovered"
              disabled={!tests.canRun}
              onclick={() => tests.run(suite.name, method.name)}
              >▶ {suite.name}.{method.name}{method.ignored
                ? " (ignored)"
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
      aria-label="Create Test Class"
      use:containClicks
    >
      <h3>Create Test Class</h3>
      <label
        >Class name<input
          bind:value={tests.className}
          use:focusOnMount
          onkeydown={(e) => e.key === "Enter" && tests.create()}
        /></label
      >
      <p>
        Attached to {tests.newClass.fileName}. Uses ordinary Kotlin and
        kotlin.test.
      </p>
      {#if tests.error}<p role="alert" class="dialog-error">
          {tests.error}
        </p>{/if}
      <div class="dialog-actions">
        <button onclick={() => (tests.newClass = null)}>Cancel</button><button
          onclick={tests.create}>Create</button
        >
      </div>
    </div>
  </div>{/if}
{#if tests.createFixtureClass}<div class="modal topmost-modal">
    <div
      class="dialog fixture-class-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Create test class for state"
      use:containClicks
    >
      <h3>Save object bench as test state</h3>
      <p>
        Create a test class for this object bench. The generated state will be
        previewed before saving.
      </p>
      <label
        >Test class name<input
          bind:value={tests.fixtureClassName}
          use:focusOnMount
          onkeydown={(e) => e.key === "Enter" && tests.createFixtureFromBench()}
        /></label
      >
      {#if tests.error}<p role="alert" class="dialog-error">
          {tests.error}
        </p>{/if}
      <div class="dialog-actions">
        <button onclick={() => (tests.createFixtureClass = false)}
          >Cancel</button
        ><button onclick={tests.createFixtureFromBench}>Continue</button>
      </div>
    </div>
  </div>{/if}
{#if tests.chooseDefaultOpen}<div class="modal topmost-modal">
    <div
      class="dialog fixture-class-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Choose default test class"
      use:containClicks
    >
      <h3>Default test class</h3>
      <label
        >Use this class for saving and loading test states<select
          aria-label="Default test class selection"
          bind:value={tests.chosenDefaultClass}
        >
          {#each tests.stateClasses as suite}<option value={suite.name}
              >{suite.name}</option
            >{/each}
        </select></label
      >
      {#if tests.error}<p role="alert" class="dialog-error">
          {tests.error}
        </p>{/if}
      <div class="dialog-actions">
        <button onclick={() => (tests.chooseDefaultOpen = false)}>Cancel</button
        ><button onclick={tests.confirmDefaultClass}>Use Test Class</button>
      </div>
    </div>
  </div>{/if}
{#if tests.preview}<div class="modal topmost-modal">
    <div
      class="dialog test-source-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={tests.preview.recording
        ? "Save recorded test"
        : "Save test state"}
      use:containClicks
    >
      <div class="test-source-content">
        <h3>
          {tests.preview.recording
            ? "Save recorded test"
            : "Save object bench as test state"}
        </h3>
        <p>
          {tests.preview.fileName} · replay uses constructors, calls and assignments.
          External effects and random values can differ when replayed.
        </p>
        {#if tests.preview.replacesFixture}
          <p class="dialog-warning" role="alert">
            Replacing the test state will overwrite all class properties and all
            <code>@BeforeTest</code> methods{tests.preview.replacesInitializers
              ? ", and all init blocks"
              : ""}. Other methods, including
            <code>@Test</code> methods, will be kept.
          </p>
        {/if}
        <div
          class="svelte-editor-host test-source-editor"
          role="group"
          aria-label="Generated Kotlin source"
          use:codeMirror={{
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
            aria-label="Editor actions"
          >
            <button
              class="editor-action editor-comment"
              onclick={() => toggleEditorComments("test-source-preview")}
              aria-label="Toggle line comments"
              title={`Comment / uncomment lines (${commentShortcutLabel})`}
              >//</button
            ><button
              class="editor-action editor-format"
              onclick={() => formatEditor("test-source-preview")}
              aria-label="Format Kotlin file"
              title={`Format Kotlin file (${formatShortcutLabel})`}>≡</button
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
              aria-label="Close format error"
              title="Close format error"
              onclick={closeFormatError}>×</button
            >
          </div>{/if}
        {#if tests.error}<p class="dialog-error" role="alert">
            {tests.error}
          </p>{/if}
      </div>
      <div class="dialog-actions">
        <button disabled={tests.busy} onclick={() => (tests.preview = null)}
          >Cancel</button
        ><button disabled={tests.busy} onclick={tests.save}
          >{tests.preview.replacesFixture
            ? "Replace State & Compile"
            : "Save & Compile"}</button
        >
      </div>
    </div>
  </div>{/if}
