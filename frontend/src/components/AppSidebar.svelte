<script lang="ts">
  import type {
    ProjectFile,
    RuntimeSnapshot,
  } from "../../../runtime-contract/src/index";

  import type { NewClassType } from "../uiTypes";
  export let newClassOpen: boolean;
  export let newClassName: string;
  export let newClassType: NewClassType;
  export let inheritanceMode: boolean;
  export let inheritanceSelection: string;
  export let status: string;
  export let displayFiles: ProjectFile[];
  export let files: ProjectFile[];
  export let phase: RuntimeSnapshot["phase"];
  export let inputReady: boolean;
  export let canExecute: boolean;
  export let mainEntries: string[];
  export let compileShortcutLabel: string;
  export let runShortcutLabel: string;
  export let exportProject: () => void;
  export let compile: () => Promise<boolean>;
  export let recording = false;
  export let openTests: () => void = () => {};
  export let runTests: () => void = () => {};
  export let runMain: () => Promise<void>;
</script>

<nav class="sidebar">
  <button
    on:click={() => {
      newClassOpen = true;
      newClassName = "";
      newClassType = "class";
    }}>New File</button
  >
  <button class="sidebar-legacy-save" on:click={exportProject}
    >Save Project</button
  >
  <button
    class:active-tool={inheritanceMode}
    disabled={displayFiles.filter((file) => file.kind === "class").length < 2}
    on:click={() => {
      inheritanceMode = !inheritanceMode;
      inheritanceSelection = "";
      status = inheritanceMode ? "Select subclass, then superclass" : "Ready";
    }}
  >
    Inheritance<span class="inheritance-icon" aria-hidden="true"
      ><svg viewBox="0 0 72 32"
        ><line x1="2" y1="16" x2="40" y2="16" /><path
          d="M40 2 L70 16 L40 30 Z"
        /></svg
      ></span
    >
  </button>
  <button
    on:click={compile}
    title={`Compile (${compileShortcutLabel})`}
    disabled={!files.length ||
      phase === "compiling" ||
      phase === "running" ||
      inputReady}>Compile</button
  >
  <button
    on:click={() => void runMain()}
    title={`Start main (${runShortcutLabel})`}
    aria-label="Start main"
    disabled={!canExecute || !mainEntries.length}>Start main</button
  >
  <div class="side-spacer"></div>
  <details class="sidebar-testing">
    <summary
      class="sidebar-testing-toggle"
      aria-label="Show or hide testing actions"
      title="Show or hide testing actions"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2 13 8 3 14Z" /></svg>
    </summary>
    <div class="sidebar-testing-actions" id="sidebar-testing-actions">
        <p class="sidebar-testing-notice">Testing is still in
the alpha stage.</p>
        <button on:click={openTests}
          >{recording ? "● Recording…" : "Tests…"}</button
        >
        <button
          on:click={runTests}
          disabled={recording ||
            phase === "running" ||
            phase === "compiling" ||
            inputReady}>Run All Tests</button
        >
    </div>
  </details>
</nav>
