<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import type { RuntimeSnapshot } from "../../../runtime-contract/src/index";

  import type { ActiveWindow } from "../uiTypes";
  import { terminalParts } from "../uiParity";
  export let terminalOpen: boolean;
  export let terminalSplit: boolean;
  export let terminalMaximized: boolean;
  export let terminalPosition: { left: number; top: number } | null;
  export let terminalSize: { width: number; height: number };
  export let terminalSplitWidth: number;
  export let activeWindow: ActiveWindow;
  export let terminal: string;
  export let inputReady: boolean;
  export let inputElement: HTMLInputElement | null;
  export let phase: RuntimeSnapshot["phase"];
  export let beginTerminalDrag: (event: PointerEvent) => void;
  export let beginTerminalResize: (
    event: PointerEvent,
    direction: string,
  ) => void;
  export let toggleTerminalMaximized: () => void;
  export let toggleTerminalSplit: () => void;
  export let beginTerminalSplitResize: (event: PointerEvent) => void;
  export let clearTerminal: () => void;
  export let resetRuntime: () => Promise<void>;
  export let sendInput: (event: KeyboardEvent) => Promise<void>;
</script>

{#if terminalOpen}<div
    class:terminal-modal-split={terminalSplit}
    class:window-active={activeWindow === "terminal"}
    class="terminal-modal"
    role="presentation"
    on:pointerdown={() => (activeWindow = "terminal")}
  >
    <div
      class:split={terminalSplit}
      class:maximized={terminalMaximized}
      class:floating={Boolean(terminalPosition) &&
        !terminalSplit &&
        !terminalMaximized}
      class="terminal-window"
      style={`${terminalSplit ? `width:${terminalSplitWidth}px;height:100vh;position:fixed;right:0;top:0;margin:0;` : terminalMaximized ? "" : `width:${terminalSize.width}px;height:${terminalSize.height}px;`} ${terminalPosition && !terminalSplit && !terminalMaximized ? `left:${terminalPosition.left}px;top:${terminalPosition.top}px;` : ""}`}
    >
      <div
        role="toolbar"
        tabindex="0"
        class="terminal-header window-header"
        on:pointerdown={(event) => {
          activeWindow = "terminal";
          beginTerminalDrag(event);
        }}
      >
        <span>{t("ui.common.blueKTerminal")}</span>
        <div>
          <button
            on:click|stopPropagation={toggleTerminalMaximized}
            aria-label={terminalMaximized
              ? t("ui.common.restoreTerminalWindow")
              : t("ui.common.maximizeTerminalWindow")}
            ><svg
              class="window-control-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              >{#if terminalMaximized}<path
                  d="M8 7.5V5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2.5"
                /><rect
                  x="3.5"
                  y="7.5"
                  width="13"
                  height="13"
                  rx="2.5"
                />{:else}<rect
                  x="3.5"
                  y="3.5"
                  width="17"
                  height="17"
                  rx="2.5"
                />{/if}</svg
            ></button
          ><button
            class="terminal-split-toggle"
            on:click|stopPropagation={toggleTerminalSplit}
            aria-label={terminalSplit
              ? t("ui.common.restoreTerminalWindow")
              : t("ui.common.splitTerminalToTheRight")}
            ><svg
              class="window-control-icon terminal-split-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              ><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path
                d="M12 4.5v15"
              /></svg
            ></button
          ><button
            on:click|stopPropagation={() => {
              terminalOpen = false;
              terminalMaximized = false;
              terminalSplit = false;
              terminalPosition = null;
            }}>×</button
          >
        </div>
      </div>
      <div class="terminal-output">
        {#key terminal}<pre>{#each terminalParts(terminal) as part}{#if part.box}<span
                  class="terminal-sized"
                  style={part.box}
                  ><span
                    class:terminal-input-echo={part.input}
                    style={part.style}>{part.text}</span
                  ></span
                >{:else}<span
                  class:terminal-input-echo={part.input}
                  style={part.style}>{part.text}</span
                >{/if}{/each}</pre>{/key}
        <button
          class="terminal-clear"
          on:click|stopPropagation={clearTerminal}
          aria-label={t("ui.common.clearTerminal")}>⌫</button
        >
      </div>
      {#if phase === "faulted"}<div class="terminal-notice" role="alert">
          {t(
            "ui.common.executionStoppedResetTheRuntimeBeforeRunningMore",
          )}<button on:click={resetRuntime}
            >{t("ui.common.resetRuntime")}</button
          >
        </div>{/if}<input
        bind:this={inputElement}
        placeholder={inputReady ? t("ui.common.enterALinePressReturn") : ""}
        disabled={!inputReady}
        on:keydown={sendInput}
      />{#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
          role="separator"
          class={`terminal-resize-handle terminal-resize-${direction}`}
          on:pointerdown={(event) => beginTerminalResize(event, direction)}
        ></div>{/each}
    </div>
    <!-- Inside the terminal's stacking layer: windows in front of the terminal also cover the
      handle (GUI-37, GUI-73, GUI-99). Dragging it does not activate the terminal. -->
    {#if terminalSplit}<div
        class="terminal-split-divider"
        role="separator"
        aria-label={t("ui.common.resizeBlueKAndTerminal")}
        on:pointerdown|stopPropagation={beginTerminalSplitResize}
      ></div>{/if}
  </div>{/if}
