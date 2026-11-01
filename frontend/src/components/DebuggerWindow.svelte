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
  const t = language.t;

  interface Props {
    phase: RuntimeSnapshot["phase"];
    activeExecutionId: number | undefined;
    debugPauseRequested: boolean;
    debugSessionActive: boolean;
    debugInspectionActive: boolean;
    debug: DebugPause | undefined;
    debugAction: (action: "step" | "stepIn" | "continue") => Promise<void>;
    requestDebugPause: () => Promise<void>;
    stopDebug: () => Promise<void>;
    inspectObject: (object: BenchObject) => Promise<void>;
    inspection: InspectionView | null;
    fieldProperty: (
      data: RuntimeValue,
      field: InspectedField,
    ) => ManifestProperty | null | undefined;
    fieldValue: (data: RuntimeValue, field: InspectorField) => string;
    inspectFieldReference: (id: string, field: InspectorField) => Promise<void>;
    onFieldError: (error: { property: string; message: string }) => void;
  }

  let {
    phase,
    activeExecutionId,
    debugPauseRequested,
    debugSessionActive,
    debugInspectionActive,
    debug,
    debugAction,
    requestDebugPause,
    stopDebug,
    inspectObject,
    inspection,
    fieldProperty,
    fieldValue,
    inspectFieldReference,
    onFieldError,
  }: Props = $props();

  let position: WindowPosition | null = $state(null);
  let visible = $derived(
    (phase === "running" &&
      Boolean(activeExecutionId) &&
      (debugPauseRequested || debugSessionActive)) ||
      (phase === "debugPaused" && Boolean(debug)),
  );

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
      onpointerdown={beginDrag}
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
            onclick={() => void debugAction("step")}
            title={t("ui.debug.stepHelp")}
            disabled={debugInspectionActive}>{t("ui.debug.step")}</button
          >
          <button
            onclick={() => void debugAction("stepIn")}
            title={t("ui.debug.stepInHelp")}
            disabled={!debug.stepInAvailable || debugInspectionActive}
            >{t("ui.debug.stepIn")}</button
          >
          <button
            onclick={() => void debugAction("continue")}
            disabled={debugInspectionActive}>{t("ui.debug.continue")}</button
          >
          <button onclick={() => void stopDebug()}>{t("ui.debug.stop")}</button>
        </div>

        <DebuggerVariables
          variables={debug.variables}
          label={t("ui.debug.variables")}
          emptyMessage={t("ui.debug.noVariables")}
          {inspectObject}
        />
        {#if debug.globals?.length}
          <DebuggerVariables
            variables={debug.globals}
            label={t("ui.debug.globalVariables")}
            scope="global"
            {inspectObject}
          />
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
            onclick={() => void requestDebugPause()}
            disabled={debugPauseRequested || debugInspectionActive}
            >{t("ui.debug.pause")}</button
          >
          <button onclick={() => void stopDebug()}>{t("ui.debug.stop")}</button>
        </div>
      {/if}
    </div>
  </dialog>
{/if}
