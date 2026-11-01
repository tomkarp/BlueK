<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import type { RuntimeSnapshot } from "../../../runtime-contract/src/index";
  import type { StageFrame } from "../bluePlayStage";

  import { stageStyle } from "../bluePlayStage";
  interface Props {
    stage: StageFrame | null;
    stageWindowOpen: boolean;
    debugEditorInFront: boolean;
    stageMaximized: boolean;
    stageCanvas: HTMLCanvasElement | null;
    speed: number;
    canExecute: boolean;
    stageRunning: boolean;
    phase: RuntimeSnapshot["phase"];
    simulation: RuntimeSnapshot["simulation"];
    libraryId: string;
    beginStageDrag: (event: PointerEvent) => void;
    stageClick: (event: MouseEvent) => void;
    resetGame: () => Promise<void>;
    closeWorld: () => void;
    bluePlayAction: (action: "step" | "start" | "stop" | "setSpeed") => void;
  }

  let {
    stage,
    stageWindowOpen,
    debugEditorInFront,
    stageMaximized = $bindable(),
    stageCanvas = $bindable(),
    speed = $bindable(),
    canExecute,
    stageRunning,
    phase,
    simulation,
    libraryId,
    beginStageDrag,
    stageClick,
    resetGame,
    closeWorld,
    bluePlayAction,
  }: Props = $props();
  function stopPropagation(handler: () => unknown) {
    return (event: Event) => {
      event.stopPropagation();
      return handler();
    };
  }
</script>

{#if stage && stageWindowOpen}
  <div
    class:maximized={stageMaximized}
    class:debug-editor-in-front={debugEditorInFront}
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
      onpointerdown={beginStageDrag}
    >
      <span>{t("ui.blueplay.bluePlayWorld")}</span>
      <div>
        <button
          onclick={stopPropagation(() => (stageMaximized = !stageMaximized))}
          aria-label={stageMaximized
            ? t("ui.blueplay.restoreBluePlayWorld")
            : t("ui.blueplay.maximizeBluePlayWorld")}
          >{stageMaximized ? "❐" : "□"}</button
        >
        <button
          onclick={stopPropagation(closeWorld)}
          disabled={stageRunning}
          aria-label={t("ui.blueplay.closeBluePlayWorld")}
          title={stageRunning
            ? t("ui.blueplay.pauseToCloseWorld")
            : t("ui.blueplay.closeBluePlayWorld")}>×</button
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
        onclick={stageClick}
      ></canvas>
    </div>
    <div class="game-controls" aria-label={t("ui.blueplay.bluePlayControls")}>
      <!-- Equal columns, and Run/Pause reserves room for both labels, so no
           button changes size with the state. -->
      <div class="game-buttons">
        <button
          onclick={() => bluePlayAction("step")}
          disabled={!canExecute || stageRunning}
          aria-label={t("ui.blueplay.actOnce")}>{t("ui.blueplay.act")}</button
        >
        <button
          class="game-run-toggle"
          onclick={() => bluePlayAction(stageRunning ? "stop" : "start")}
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
        <button
          onclick={resetGame}
          disabled={!canExecute}
          aria-label={t("ui.blueplay.resetBluePlayWorld")}
          >{t("ui.blueplay.reset")}</button
        >
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
          oninput={() => bluePlayAction("setSpeed")}
        /></label
      >
    </div>
  </div>
{/if}
