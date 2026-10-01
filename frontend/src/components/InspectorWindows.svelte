<script lang="ts">
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
      aria-label="Object inspector"
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
      <div
        class="inspect-fields"
        class:inspect-no-fields={!inspector.data.fields?.length}
      >
        {#each inspector.data.fields || [] as field}
          {@const property = fieldProperty(inspector.data, field)}
          {@const editable = canEditField(field, inspector.data)}
          {@const privateField = property?.visibility === "private"}
          {@const editing =
            editingField === field.name && inspected?.objectId === inspector.id}
          <div
            class:editable
            class:private-field={privateField}
            class:private-setter={field.setterPrivate === true}
            class="inspect-row"
            role="group"
          >
            <span
              >{field.name} : {fieldProperty(inspector.data, field)?.type
                ?.displayName ||
                field.type?.displayName ||
                "Any?"}</span
            >
            <div class="inspect-value">
              {#if editing}
                <input
                  use:focusOnMount
                  bind:this={fieldInput}
                  aria-label={`Value of ${field.name}`}
                  aria-invalid={Boolean(fieldError)}
                  placeholder="expression"
                  bind:value={fieldDraft}
                  on:keydown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      editingField = "";
                    }
                    if (event.key === "Enter") saveField(field);
                  }}
                />
              {:else}
                {#if field.reference}<button
                    class="inspect-reference"
                    aria-label={`Open referenced object ${field.name}`}
                    title={`Open ${field.name}`}
                    on:click={() => inspectFieldReference(inspector.id, field)}
                    ><svg viewBox="0 0 48 24" aria-hidden="true"
                      ><path d="M3 12h32" /><path d="m29 5 8 7-8 7" /></svg
                    ></button
                  >{:else if field.error}<button
                    class="inspect-error-value"
                    aria-label={`Show error for ${field.name}`}
                    title={field.error}
                    on:click={() => {
                      inspectorError = {
                        property: field.name,
                        message: field.error!,
                      };
                    }}>{fieldValue(inspector.data, field)}</button
                  >{:else}<output title={fieldValue(inspector.data, field)}
                    >{fieldValue(inspector.data, field)}</output
                  >{/if}
                {#if editable || field.setterPrivate}<button
                    class="inspect-edit"
                    class:inspect-edit-disabled={!editable}
                    disabled={!editable}
                    aria-label={`Edit ${field.name}`}
                    title={field.setterPrivate
                      ? "The setter is private"
                      : "Edit"}
                    on:click={() => beginFieldEdit(field, inspector.data)}
                    >✎</button
                  >{/if}
              {/if}
            </div>
            {#if editing && fieldError}<small class="inspect-error"
                >{fieldError}</small
              >{/if}
          </div>
        {:else}No fields{/each}
      </div>
      <div class="dialog-actions">
        <button on:click={() => closeInspector(inspector.id)}>Close</button>
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
        Property error: {inspectorError.property}
      </h3>
      <p>{inspectorError.message}</p>
      <div class="dialog-actions">
        <button use:focusOnMount on:click={() => (inspectorError = null)}
          >Close</button
        >
      </div>
    </div>
  </div>{/if}
