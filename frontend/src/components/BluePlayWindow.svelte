<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
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
    aria-label={t("ui.blueplay.bluePlayWorld")}
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
      <span>{t("ui.blueplay.bluePlayWorld")}</span>
      <div>
        <button
          on:click|stopPropagation={() => (stageMaximized = !stageMaximized)}
          aria-label={stageMaximized
            ? t("ui.blueplay.restoreBluePlayWorld")
            : t("ui.blueplay.maximizeBluePlayWorld")}
          >{stageMaximized ? "❐" : "□"}</button
        >
        <button
          on:click|stopPropagation={() => {
            stageWindowOpen = false;
            stageWindowDismissed = true;
            stageMaximized = false;
          }}
          aria-label={t("ui.blueplay.closeBluePlayWorld")}>×</button
        >
      </div>
    </div>
    <div class="stage-window-body">
      <canvas
        bind:this={stageCanvas}
        class="game-stage"
        class:game-canvas={true}
        role="button"
        aria-label={t("ui.blueplay.bluePlayWorld2")}
        tabindex="0"
        style={stageStyle(stage)}
        on:click={stageClick}
      ></canvas>
    </div>
    <div class="game-controls" aria-label={t("ui.blueplay.bluePlayControls")}>
      <!-- Equal columns, and Run/Pause reserves room for both labels, so no
           button changes size with the state. -->
      <div class="game-buttons">
        <button
          on:click={() => bluePlayAction("step")}
          disabled={!canExecute || stageRunning}
          aria-label={t("ui.blueplay.actOnce")}>{t("ui.blueplay.act")}</button
        >
        <button
          class="game-run-toggle"
          on:click={() => bluePlayAction(stageRunning ? "stop" : "start")}
          disabled={stageRunning ? false : !canExecute}
          aria-label={stageRunning
            ? t("ui.blueplay.pauseBluePlayWorld")
            : t("ui.blueplay.runBluePlayWorld")}
          ><span class="toggle-labels" aria-hidden="true"
            ><span class:inactive-label={stageRunning}
              >{t("ui.blueplay.run")}</span
            ><span class:inactive-label={!stageRunning}
              >{t("ui.blueplay.pause")}</span
            ></span
          ></button
        >
        {#if mainEntries.length}<button
            on:click={resetGame}
            disabled={!canExecute}
            aria-label={t("ui.blueplay.resetBluePlayWorld")}
            >{t("ui.blueplay.reset")}</button
          >{/if}
      </div>
      <label
        >{t("ui.blueplay.speed")}
        <input
          aria-label={t("ui.blueplay.speed")}
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
