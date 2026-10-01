<script lang="ts">
  import type { RuntimeSnapshot } from "../../../runtime-contract/src/index";
  import type { StageFrame } from "../bluePlayStage";

  import { stageStyle } from "../bluePlayStage";
  export let stage: StageFrame | null;
  export let stageWindowOpen: boolean;
  export let stageWindowDismissed: boolean;
  export let stageMaximized: boolean;
  export let stageCanvas: HTMLCanvasElement | null;
  export let speed: number;
  export let canExecute: boolean;
  export let stageRunning: boolean;
  export let mainEntries: string[];
  export let phase: RuntimeSnapshot["phase"];
  export let simulation: RuntimeSnapshot["simulation"];
  export let libraryId: string;
  export let beginStageDrag: (event: PointerEvent) => void;
  export let stageClick: (event: MouseEvent) => void;
  export let resetGame: () => Promise<void>;
  export let bluePlayAction: (
    action: "step" | "start" | "stop" | "setSpeed",
  ) => void;
</script>

{#if stage && stageWindowOpen}
  <div
    class:maximized={stageMaximized}
    class:stage-compact={(stage.width || 1) * (stage.cellSize || 1) < 560}
    class="stage-window"
    role="dialog"
    aria-label="BluePlay – World"
    data-library={libraryId}
    data-phase={phase}
    data-simulation={simulation}
    data-frame-version={stage.frameVersion}
  >
    <div
      class="stage-window-chrome"
      role="toolbar"
      tabindex="0"
      on:pointerdown={beginStageDrag}
    >
      <span>BluePlay – World</span>
      <div>
        <button
          on:click|stopPropagation={() => (stageMaximized = !stageMaximized)}
          aria-label={stageMaximized
            ? "Restore BluePlay world"
            : "Maximize BluePlay world"}>{stageMaximized ? "❐" : "□"}</button
        >
        <button
          on:click|stopPropagation={() => {
            stageWindowOpen = false;
            stageWindowDismissed = true;
            stageMaximized = false;
          }}
          aria-label="Close BluePlay world">×</button
        >
      </div>
    </div>
    <div class="stage-window-body">
      <canvas
        bind:this={stageCanvas}
        class="game-stage"
        class:game-canvas={true}
        role="button"
        aria-label="BluePlay world"
        tabindex="0"
        style={stageStyle(stage)}
        on:click={stageClick}
      ></canvas>
    </div>
    <div class="game-controls" aria-label="BluePlay controls">
      {#if mainEntries.length}<button
          on:click={resetGame}
          disabled={!canExecute}
          aria-label="Reset BluePlay world">Reset</button
        >{/if}
      <button
        on:click={() => bluePlayAction("step")}
        disabled={!canExecute || stageRunning}
        aria-label="Act once">Act</button
      >
      <button
        on:click={() => bluePlayAction("start")}
        disabled={!canExecute || stageRunning}
        aria-label="Run BluePlay world">Run</button
      >
      <button
        on:click={() => bluePlayAction("stop")}
        disabled={!stageRunning}
        aria-label="Pause BluePlay world">Pause</button
      >
      <label
        >Speed <input
          aria-label="Speed"
          type="range"
          min="1"
          max="100"
          bind:value={speed}
          disabled={phase !== "ready" && phase !== "waitingForInput"}
          on:input={() => bluePlayAction("setSpeed")}
        /></label
      >
    </div>
  </div>
{/if}
