<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import InspectorFields from "./InspectorFields.svelte";
  import { focusOnMount, containClicks } from "../uiActions";

  import type {
    RuntimeValue,
    ManifestProperty,
    InspectedField,
  } from "../../../runtime-contract/src/index";

  import type { InspectionView, InspectorField } from "../inspectorModel";
  import type { ActiveWindow, InspectorWindowView } from "../uiTypes";
  interface Props {
    inspectorViews: InspectorWindowView[];
    activeWindow: ActiveWindow;
    activeInspectorId: string;
    inspected: InspectionView | null;
    editingField: string;
    fieldInput: HTMLInputElement | null;
    fieldDraft: string;
    fieldError: string;
    inspectorError: { property: string; message: string } | null;
    fieldProperty: (
      data: RuntimeValue,
      field: InspectedField,
    ) => ManifestProperty | null | undefined;
    canEditField: (
      field: InspectorField,
      data?: InspectionView | null,
    ) => boolean;
    fieldValue: (data: RuntimeValue, field: InspectorField) => string;
    inspectorType: (data: InspectionView) => string;
    bringInspectorToFront: (id: string) => void;
    beginInspectorDrag: (event: PointerEvent, id: string) => void;
    closeInspector: (id: string) => void;
    saveField: (field: InspectorField) => Promise<void>;
    inspectFieldReference: (id: string, field: InspectorField) => Promise<void>;
    beginFieldEdit: (
      field: InspectorField,
      data?: InspectionView | null,
    ) => void;
  }

  let {
    inspectorViews,
    activeWindow,
    activeInspectorId,
    inspected,
    editingField = $bindable(),
    fieldInput = $bindable(),
    fieldDraft = $bindable(),
    fieldError,
    inspectorError = $bindable(),
    fieldProperty,
    canEditField,
    fieldValue,
    inspectorType,
    bringInspectorToFront,
    beginInspectorDrag,
    closeInspector,
    saveField,
    inspectFieldReference,
    beginFieldEdit,
  }: Props = $props();
</script>

{#each inspectorViews as inspector, index (inspector.id)}
  <div
    class="inspector"
    class:window-active={activeWindow === "inspector" &&
      inspector.id === activeInspectorId}
  >
    <div
      class="inspect-window"
      role="dialog"
      aria-label={t("ui.inspector.objectInspector")}
      tabindex="-1"
      style={`position:fixed;left:${inspector.position.left}px;top:${inspector.position.top}px;margin:0;z-index:${inspector.id === activeInspectorId ? 100 : 10 + index}`}
      onpointerdown={(event) => {
        if (
          !(event.target as HTMLElement).closest("button,input,.inspect-row")
        ) {
          bringInspectorToFront(inspector.id);
          beginInspectorDrag(event, inspector.id);
        }
      }}
      onclick={() => bringInspectorToFront(inspector.id)}
      onkeydown={(event) => {
        if (
          event.key === "Escape" &&
          (!editingField || inspected?.objectId !== inspector.id)
        ) {
          event.preventDefault();
          event.stopPropagation();
          closeInspector(inspector.id);
        }
      }}
    >
      <h2>
        {inspector.referenceName
          ? `${inspector.referenceName} : ${inspectorType(inspector.data)}`
          : `: ${inspectorType(inspector.data)}`}
      </h2>
      <InspectorFields
        data={inspector.data}
        {inspected}
        bind:editingField
        bind:fieldInput
        bind:fieldDraft
        {fieldError}
        {fieldProperty}
        {canEditField}
        {fieldValue}
        {saveField}
        {inspectFieldReference}
        {beginFieldEdit}
        onFieldError={(error) => (inspectorError = error)}
      />
      <div class="dialog-actions">
        <button onclick={() => closeInspector(inspector.id)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>
{/each}
{#if inspectorError}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog inspector-error-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="inspector-error-title"
      use:containClicks
    >
      <h3 id="inspector-error-title">
        {t("ui.inspector.propertyError")}
        {inspectorError.property}
      </h3>
      <p>{inspectorError.message}</p>
      <div class="dialog-actions">
        <button use:focusOnMount onclick={() => (inspectorError = null)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
