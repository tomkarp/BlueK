<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import type { RuntimeSnapshot } from "../../../runtime-contract/src/index";

  import type { ActiveWindow } from "../uiTypes";
  import { terminalParts } from "../uiParity";
  interface Props {
    terminalOpen: boolean;
    terminalSplit: boolean;
    terminalMaximized: boolean;
    terminalPosition: { left: number; top: number } | null;
    terminalSize: { width: number; height: number };
    terminalSplitWidth: number;
    activeWindow: ActiveWindow;
    terminal: string;
    inputReady: boolean;
    inputElement: HTMLInputElement | null;
    phase: RuntimeSnapshot["phase"];
    beginTerminalDrag: (event: PointerEvent) => void;
    beginTerminalResize: (event: PointerEvent, direction: string) => void;
    toggleTerminalMaximized: () => void;
    toggleTerminalSplit: () => void;
    beginTerminalSplitResize: (event: PointerEvent) => void;
    clearTerminal: () => void;
    resetRuntime: () => Promise<void>;
    sendInput: (event: KeyboardEvent) => Promise<void>;
  }

  let {
    terminalOpen = $bindable(),
    terminalSplit = $bindable(),
    terminalMaximized = $bindable(),
    terminalPosition = $bindable(),
    terminalSize,
    terminalSplitWidth,
    activeWindow = $bindable(),
    terminal,
    inputReady,
    inputElement = $bindable(),
    phase,
    beginTerminalDrag,
    beginTerminalResize,
    toggleTerminalMaximized,
    toggleTerminalSplit,
    beginTerminalSplitResize,
    clearTerminal,
    resetRuntime,
    sendInput,
  }: Props = $props();

  let inputLength = $state(0);
  let inputCaretLeft = $state(0);
  let inputFocused = $state(false);
  function stopPropagation<E extends Event>(handler: (event: E) => unknown) {
    return (event: E) => {
      event.stopPropagation();
      return handler(event);
    };
  }
  const inputMeasureContext =
    typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");
  $effect(() => {
    if (!inputReady) inputLength = 0;
  });
  $effect(() => {
    if (!inputReady) {
      inputCaretLeft = 0;
      inputFocused = false;
    }
  });

  function updateInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    inputLength = Array.from(input.value).length;
    updateCaretPosition(input);
  }

  function updateCaretPosition(input: HTMLInputElement) {
    if (!inputMeasureContext) return;
    inputMeasureContext.font = getComputedStyle(input).font;
    const position = input.selectionStart ?? input.value.length;
    inputCaretLeft = Math.max(
      0,
      inputMeasureContext.measureText(input.value.slice(0, position)).width -
        input.scrollLeft,
    );
  }

  function handleInputKey(event: KeyboardEvent) {
    const result = sendInput(event);
    if (event.key === "Enter") {
      inputLength = 0;
      inputCaretLeft = 0;
    }
    return result;
  }
</script>

{#if terminalOpen}<div
    class:terminal-modal-split={terminalSplit}
    class:window-active={activeWindow === "terminal"}
    class="terminal-modal"
    role="presentation"
    onpointerdown={() => (activeWindow = "terminal")}
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
        onpointerdown={(event) => {
          activeWindow = "terminal";
          beginTerminalDrag(event);
        }}
      >
        <span>{t("ui.common.blueKTerminal")}</span>
        <div>
          <button
            onclick={stopPropagation(toggleTerminalMaximized)}
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
            onclick={stopPropagation(toggleTerminalSplit)}
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
            onclick={stopPropagation(() => {
              terminalOpen = false;
              terminalMaximized = false;
              terminalSplit = false;
              terminalPosition = null;
            })}>×</button
          >
        </div>
      </div>
      <div class="terminal-output">
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus allows scrolling the terminal transcript) -->
        <pre tabindex="0"><span class="terminal-transcript"
            >{#key terminal}{#each terminalParts(terminal) as part}{#if part.box}<span
                    class="terminal-sized"
                    style={part.box}
                    ><span
                      class:terminal-input-echo={part.input}
                      style={part.style}>{part.text}</span
                    ></span
                  >{:else}<span
                    class:terminal-input-echo={part.input}
                    style={part.style}>{part.text}</span
                  >{/if}{/each}{/key}</span
          >{#if inputReady}<span
              class:focused={inputFocused}
              class="terminal-inline-input-shell"
              style={`--terminal-caret-left:${inputCaretLeft}px`}
              ><input
                bind:this={inputElement}
                class="terminal-inline-input"
                aria-label={t("ui.common.terminalInputLabel")}
                size={inputLength + 1}
                oninput={updateInput}
                onkeydown={handleInputKey}
                onkeyup={(event) => updateCaretPosition(event.currentTarget)}
                onselect={(event) => updateCaretPosition(event.currentTarget)}
                onclick={(event) => updateCaretPosition(event.currentTarget)}
                onscroll={(event) => updateCaretPosition(event.currentTarget)}
                onfocus={(event) => {
                  inputFocused = true;
                  updateCaretPosition(event.currentTarget);
                }}
                onblur={() => (inputFocused = false)}
              /><span class="terminal-inline-caret" aria-hidden="true"
              ></span></span
            >{/if}</pre>
        <button
          class="terminal-clear"
          onclick={stopPropagation(clearTerminal)}
          aria-label={t("ui.common.clearTerminal")}>⌫</button
        >
      </div>
      {#if phase === "faulted"}<div class="terminal-notice" role="alert">
          {t(
            "ui.common.executionStoppedResetTheRuntimeBeforeRunningMore",
          )}<button onclick={resetRuntime}>{t("ui.common.resetRuntime")}</button
          >
        </div>{/if}{#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
          role="separator"
          class={`terminal-resize-handle terminal-resize-${direction}`}
          onpointerdown={(event) => beginTerminalResize(event, direction)}
        ></div>{/each}
    </div>
    <!-- Inside the terminal's stacking layer: windows in front of the terminal also cover the
      handle (GUI-37, GUI-73, GUI-99). Dragging it does not activate the terminal. -->
    {#if terminalSplit}<div
        class="terminal-split-divider"
        role="separator"
        aria-label={t("ui.common.resizeBlueKAndTerminal")}
        onpointerdown={stopPropagation(beginTerminalSplitResize)}
      ></div>{/if}
  </div>{/if}
