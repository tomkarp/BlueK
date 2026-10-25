<script lang="ts">
  import InspectorFields from "./InspectorFields.svelte";
  import DebuggerVariables from "./DebuggerVariables.svelte";
  import type { InspectionView, InspectorField } from "../inspectorModel";
  import type {
    RuntimeValue,
    ManifestProperty,
    InspectedField,
  } from "../../../runtime-contract/src/index";
  import { useLanguage } from "../i18n/Language.svelte";
  import type {
    DebugPause,
    RuntimeSnapshot,
  } from "../../../runtime-contract/src/index";
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
  export let debugAction: (
    action: "step" | "stepIn" | "continue",
  ) => Promise<void>;
  export let requestDebugPause: () => Promise<void>;
  export let stopDebug: () => Promise<void>;
  export let inspectObject: (object: BenchObject) => Promise<void>;

  export let inspection: InspectionView | null;
  export let fieldProperty: (
    data: RuntimeValue,
    field: InspectedField,
  ) => ManifestProperty | null | undefined;
  export let fieldValue: (data: RuntimeValue, field: InspectorField) => string;
  export let inspectFieldReference: (
    id: string,
    field: InspectorField,
  ) => Promise<void>;
  export let onFieldError: (error: {
    property: string;
    message: string;
  }) => void;

  let position: WindowPosition | null = null;
  $: visible =
    (phase === "running" &&
      Boolean(activeExecutionId) &&
      (debugPauseRequested || debugSessionActive)) ||
    (phase === "debugPaused" && Boolean(debug));

  function beginDrag(event: PointerEvent) {
    beginWindowDrag(
      event,
      ".debugger-window",
      (next) => (position = next),
      "visible",
    );
  }

</script>

{#if visible}
  <dialog
    open
    class="debugger-window"
    aria-label={t("ui.debug.title")}
    style={position
      ? `left:${position.left}px;top:${position.top}px;right:auto`
      : ""}
  >
    <header
      class="debugger-window-header"
      role="toolbar"
      tabindex="0"
      on:pointerdown={beginDrag}
    >
      <strong>{t("ui.debug.title")}</strong>
      {#if phase === "debugPaused" && debug}
        <span>{t("ui.debug.nextAt", [debug.fileName, debug.line])}</span>
      {:else}
        <span
          >{debugPauseRequested
            ? t("ui.debug.pauseRequested")
            : t("ui.debug.running")}</span
        >
      {/if}
    </header>
    <div class="debugger-window-body">
      {#if phase === "debugPaused" && debug}
        <p class="debugger-help">{t("ui.debug.firstPauseHelp")}</p>
        <div class="debug-actions">
          <button
            on:click={() => void debugAction("step")}
            title={t("ui.debug.stepHelp")}
            disabled={debugInspectionActive}>{t("ui.debug.step")}</button
          >
          <button
            on:click={() => void debugAction("stepIn")}
            title={t("ui.debug.stepInHelp")}
            disabled={!debug.stepInAvailable || debugInspectionActive}
            >{t("ui.debug.stepIn")}</button
          >
          <button
            on:click={() => void debugAction("continue")}
            disabled={debugInspectionActive}>{t("ui.debug.continue")}</button
          >
          <button on:click={() => void stopDebug()}>{t("ui.debug.stop")}</button
          >
        </div>

        <DebuggerVariables variables={debug.variables} label={t("ui.debug.variables")} emptyMessage={t("ui.debug.noVariables")} {inspectObject} />
        {#if debug.globals?.length}
          <DebuggerVariables variables={debug.globals} label={t("ui.debug.globalVariables")} scope="global" {inspectObject} />
        {/if}

        {#if inspection}
          <section
            class="debugger-values"
            aria-label={t("ui.debug.attributes")}
          >
            <h3>{t("ui.debug.attributes")}</h3>
            <div
              class="debugger-inspector"
              aria-label={t("ui.inspector.objectInspector")}
            >
              <div class="debugger-inspector-type">{inspection.className}</div>
              <InspectorFields
                data={inspection}
                readOnly
                {fieldProperty}
                {fieldValue}
                {inspectFieldReference}
                {onFieldError}
              />
            </div>
          </section>
        {/if}
      {:else}
        <div class="debug-actions">
          <button
            on:click={() => void requestDebugPause()}
            disabled={debugPauseRequested || debugInspectionActive}
            >{t("ui.debug.pause")}</button
          >
          <button on:click={() => void stopDebug()}>{t("ui.debug.stop")}</button
          >
        </div>
      {/if}
    </div>
  </dialog>
{/if}
