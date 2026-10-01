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
  export let offlineBuild: boolean;
  export let OFFLINE_DOWNLOAD: string;
  export let shortcutsHelpOpen: boolean;
  export let compileShortcutLabel: string;
  export let runShortcutLabel: string;
  export let exportProject: () => void;
  export let compile: () => Promise<boolean>;
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
  {#if !offlineBuild}
    <a
      class="offline-download"
      href={OFFLINE_DOWNLOAD}
      download="BlueK-offline.zip"
      title="Download BlueK as a ZIP and run it without internet access"
      >Offline Version<span>ZIP, no installation</span></a
    >
  {/if}
  <button
    on:click={() => (shortcutsHelpOpen = true)}
    aria-label="Help"
    title="Help">Help</button
  >
</nav>
