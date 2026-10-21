<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import InspectorFields from "./InspectorFields.svelte";
  import { focusOnMount, containClicks } from "../uiActions";

  import type {
    RuntimeValue,
    ManifestProperty,
    InspectedField,
  } from "../../../runtime-contract/src/index";

  import type { InspectionView, InspectorField } from "../inspectorModel";
  import type { ActiveWindow, InspectorWindowView } from "../uiTypes";
  export let inspectorViews: InspectorWindowView[];
  export let activeWindow: ActiveWindow;
  export let activeInspectorId: string;
  export let inspected: InspectionView | null;
  export let editingField: string;
  export let fieldInput: HTMLInputElement | null;
  export let fieldDraft: string;
  export let fieldError: string;
  export let inspectorError: { property: string; message: string } | null;
  export let fieldProperty: (
    data: RuntimeValue,
    field: InspectedField,
  ) => ManifestProperty | null | undefined;
  export let canEditField: (
    field: InspectorField,
    data?: InspectionView | null,
  ) => boolean;
  export let fieldValue: (data: RuntimeValue, field: InspectorField) => string;
  export let inspectorType: (data: InspectionView) => string;
  export let bringInspectorToFront: (id: string) => void;
  export let beginInspectorDrag: (event: PointerEvent, id: string) => void;
  export let closeInspector: (id: string) => void;
  export let saveField: (field: InspectorField) => Promise<void>;
  export let inspectFieldReference: (
    id: string,
    field: InspectorField,
  ) => Promise<void>;
  export let beginFieldEdit: (
    field: InspectorField,
    data?: InspectionView | null,
  ) => void;
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
      on:pointerdown={(event) => {
        if (
          !(event.target as HTMLElement).closest("button,input,.inspect-row")
        ) {
          bringInspectorToFront(inspector.id);
          beginInspectorDrag(event, inspector.id);
        }
      }}
      on:click={() => bringInspectorToFront(inspector.id)}
      on:keydown={(event) => {
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
        {`${inspector.referenceName} : ${inspectorType(inspector.data)}`}
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
        <button on:click={() => closeInspector(inspector.id)}
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
        <button use:focusOnMount on:click={() => (inspectorError = null)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
