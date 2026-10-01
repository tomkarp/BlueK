<script lang="ts">


  import type { RuntimeSnapshot } from "../../../runtime-contract/src/index";


  import type { BenchObject, ActiveWindow } from "../uiTypes";
  export let selectedObjectId: string;
  export let bench: BenchObject[];
  export let terminalOpen: boolean;
  export let terminal: string;
  export let inputReady: boolean;
  export let activeWindow: ActiveWindow;
  export let programActive: boolean;
  export let phase: RuntimeSnapshot["phase"];
  export let resetRuntime: () => Promise<void>;
</script>

<footer class="status-bar">
  <span class="current-element"
    >{selectedObjectId &&
    bench.find((object) => object.objectId === selectedObjectId)
      ? `${bench.find((object) => object.objectId === selectedObjectId)?.name} : ${bench.find((object) => object.objectId === selectedObjectId)?.className}`
      : "No object selected"}</span
  >
  {#if !terminalOpen && (terminal || inputReady)}<button
      class="terminal-reopen"
      on:click={() => {
        terminalOpen = true;
        activeWindow = "terminal";
      }}>Terminal</button
    >{/if}
  <span
    class:active={programActive}
    class="activity-bar"
    role="progressbar"
    aria-busy={programActive}
    title={programActive ? "BlueK is running" : "Ready"}
    aria-label={phase === "compiling"
      ? "Compiling"
      : phase === "running" || inputReady
        ? "Program active"
        : "Ready"}
    >{#if programActive}<span class="activity-indicator" aria-hidden="true"
      ></span>{/if}</span
  >
  <button
    class="reset-runtime"
    aria-label="Reset runtime"
    title="Reset"
    on:click={resetRuntime}
    disabled={phase === "compiling"}>↶</button
  >
</footer>
