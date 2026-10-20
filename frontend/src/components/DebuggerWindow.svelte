<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import type { DebugPause, RuntimeSnapshot } from "../../../runtime-contract/src/index";
  import { beginWindowDrag } from "../windowInteraction";
  import type { BenchObject, WindowPosition } from "../uiTypes";

  const language = useLanguage();
  $: t = $language.t;
  export let phase: RuntimeSnapshot["phase"];
  export let activeExecutionId: number | undefined;
  export let debugPauseRequested: boolean;
  export let debugSessionActive: boolean;
  export let debugInspectionActive: boolean;
  export let debug: DebugPause | undefined;
  export let debugAction: (action: "step" | "stepIn" | "continue") => Promise<void>;
  export let requestDebugPause: () => Promise<void>;
  export let stopDebug: () => Promise<void>;
  export let inspectObject: (object: BenchObject) => Promise<void>;

  let position: WindowPosition | null = null;
  $: visible =
    (phase === "running" && Boolean(activeExecutionId) && (debugPauseRequested || debugSessionActive)) ||
    (phase === "debugPaused" && Boolean(debug));

  function beginDrag(event: PointerEvent) {
    beginWindowDrag(event, ".debugger-window", (next) => (position = next), "visible");
  }

  function valueText(variable: DebugPause["variables"][number]) {
    if (variable.computed) return t("ui.debug.computedProperty");
    return variable.initialized
      ? (variable.display ?? `(${variable.type})`)
      : t("ui.debug.notInitialized");
  }
</script>

{#if visible}
  <dialog
    open
    class="debugger-window"
    aria-label={t("ui.debug.title")}
    style={position ? `left:${position.left}px;top:${position.top}px;right:auto` : ""}
  >
    <header class="debugger-window-header" role="toolbar" tabindex="0" on:pointerdown={beginDrag}>
      <strong>{t("ui.debug.title")}</strong>
      {#if phase === "debugPaused" && debug}
        <span>{t("ui.debug.nextAt", [debug.fileName, debug.line])}</span>
      {:else}
        <span>{debugPauseRequested ? t("ui.debug.pauseRequested") : t("ui.debug.running")}</span>
      {/if}
    </header>
    <div class="debugger-window-body">
      {#if phase === "debugPaused" && debug}
        <p class="debugger-help">{t("ui.debug.firstPauseHelp")}</p>
        <div class="debug-actions">
          <button on:click={() => void debugAction("step")} title={t("ui.debug.stepHelp")} disabled={debugInspectionActive}>{t("ui.debug.step")}</button>
          <button on:click={() => void debugAction("stepIn")} title={t("ui.debug.stepInHelp")} disabled={!debug.stepInAvailable || debugInspectionActive}>{t("ui.debug.stepIn")}</button>
          <button on:click={() => void debugAction("continue")} disabled={debugInspectionActive}>{t("ui.debug.continue")}</button>
          <button on:click={() => void stopDebug()}>{t("ui.debug.stop")}</button>
        </div>

        <section class="debugger-values" aria-label={t("ui.debug.variables")}>
          <h3>{t("ui.debug.variables")}</h3>
          {#if debug.variables.length}
            <dl class="debug-variables">
              {#each debug.variables as variable (variable.name)}
                <div><dt>{variable.name}</dt><dd title={variable.type}>
                  {#if variable.objectId}
                    <button class="debug-object-value" aria-label={t("ui.inspector.open0", [variable.name])} on:click={() => void inspectObject({ objectId: variable.objectId!, className: variable.type, name: variable.name })}>
                      <span class="codepad-object-icon" aria-hidden="true"></span><span>{t("ui.codepad.object")} : {variable.type}</span>
                    </button>
                  {:else}
                    {valueText(variable)}
                  {/if}
                </dd></div>
              {/each}
            </dl>
          {:else}
            <p>{t("ui.debug.noVariables")}</p>
          {/if}
        </section>

        {#if debug.attributes.length}
          <section class="debugger-values" aria-label={t("ui.debug.attributes")}>
            <h3>{t("ui.debug.attributes")}</h3>
            <p>{t("ui.debug.attributesHelp")}</p>
            <dl class="debug-variables">
              {#each debug.attributes as attribute (attribute.name)}
                <div><dt>{attribute.name}</dt><dd title={attribute.type}>
                  {#if attribute.objectId}
                    <button class="debug-object-value" aria-label={t("ui.inspector.open0", [attribute.name])} on:click={() => void inspectObject({ objectId: attribute.objectId!, className: attribute.type, name: attribute.name })}>
                      <span class="codepad-object-icon" aria-hidden="true"></span><span>{t("ui.codepad.object")} : {attribute.type}</span>
                    </button>
                  {:else}
                    {valueText(attribute)}
                  {/if}
                </dd></div>
              {/each}
            </dl>
          </section>
        {/if}
      {:else}
        <div class="debug-actions">
          <button on:click={() => void requestDebugPause()} disabled={debugPauseRequested || debugInspectionActive}>{t("ui.debug.pause")}</button>
          <button on:click={() => void stopDebug()}>{t("ui.debug.stop")}</button>
        </div>
      {/if}
    </div>
  </dialog>
{/if}
