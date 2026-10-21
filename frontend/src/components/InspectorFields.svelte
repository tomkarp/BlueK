<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { focusOnMount } from "../uiActions";
  import type {
    RuntimeValue,
    ManifestProperty,
    InspectedField,
  } from "../../../runtime-contract/src/index";
  import { inspectorFieldText, type InspectionView, type InspectorField } from "../inspectorModel";

  const language = useLanguage();
  $: t = $language.t;
  export let data: InspectionView;
  export let readOnly = false;
  export let inspected: InspectionView | null = null;
  export let editingField = "";
  export let fieldInput: HTMLInputElement | null = null;
  export let fieldDraft = "";
  export let fieldError = "";
  export let fieldProperty: (
    data: RuntimeValue,
    field: InspectedField,
  ) => ManifestProperty | null | undefined;
  export let canEditField: (
    field: InspectorField,
    data?: InspectionView | null,
  ) => boolean = () => false;
  export let fieldValue: (data: RuntimeValue, field: InspectorField) => string;
  export let saveField: (
    field: InspectorField,
  ) => Promise<void> = async () => {};
  export let inspectFieldReference: (
    id: string,
    field: InspectorField,
  ) => Promise<void>;
  export let beginFieldEdit: (
    field: InspectorField,
    data?: InspectionView | null,
  ) => void = () => {};
  export let onFieldError: (error: {
    property: string;
    message: string;
  }) => void;

  function valueText(field: InspectorField) {
    return field.value === "<uninitialized>"
      ? t("ui.debug.notInitialized")
      : fieldValue(data, field);
  }
</script>

<div class="inspect-fields" class:inspect-no-fields={!data.fields?.length}>
  {#each data.fields || [] as field}
    {@const property = fieldProperty(data, field)}
    {@const editable = !readOnly && canEditField(field, data)}
    {@const privateField = property?.visibility === "private"}
    {@const editing =
      !readOnly &&
      editingField === field.name &&
      inspected?.objectId === data.objectId}
    <div
      class:editable
      class:private-field={privateField}
      class:private-setter={field.setterPrivate === true}
      class="inspect-row"
      role="group"
    >
      <span
        >{field.name} : {fieldProperty(data, field)?.type?.displayName ||
          field.type?.displayName ||
          "Any?"}</span
      >
      <div class="inspect-value">
        {#if editing}
          <input
            use:focusOnMount
            bind:this={fieldInput}
            aria-label={t("ui.inspector.valueOf0", [field.name])}
            aria-invalid={Boolean(fieldError)}
            placeholder={t("ui.inspector.expression")}
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
          {#if field.error}<button
              class="inspect-error-value"
              aria-label={t("ui.inspector.showErrorFor0", [field.name])}
              title={field.error}
              on:click={() => {
                onFieldError({
                  property: field.name,
                  message: field.error!,
                });
              }}>{valueText(field)}</button
            >{:else}<output title={valueText(field)}>{valueText(field)}</output
            >{/if}
          {#if !readOnly && (editable || field.setterPrivate)}<button
              class="inspect-edit"
              class:inspect-edit-disabled={!editable}
              disabled={!editable}
              aria-label={t("ui.inspector.edit0", [field.name])}
              title={field.setterPrivate
                ? t("ui.inspector.theSetterIsPrivate")
                : "Edit"}
              on:click={() => beginFieldEdit(field, data)}>✎</button
            >{/if}
          <button
            class="inspect-reference"
            disabled={field.inspectable !== true}
            aria-label={t("ui.inspector.openReferencedObject0", [field.name])}
            title={t("ui.inspector.open0", [field.name])}
            on:click={() => inspectFieldReference(data.objectId || "", field)}
            ><svg viewBox="0 0 24 24" aria-hidden="true"
              ><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></svg
            ></button
          >
        {/if}
      </div>
      {#if editing && fieldError}<small class="inspect-error"
          >{fieldError}</small
        >{/if}
    </div>
  {:else}
    {#if data.display !== undefined}
      <output class="inspect-scalar-value" title={inspectorFieldText({ name: "", value: data.display, type: data.type })}
        >{inspectorFieldText({ name: "", value: data.display, type: data.type })}</output
      >
    {/if}
    <span>{t("ui.inspector.noFields")}</span>
  {/each}
</div>
