<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { focusOnMount } from "../uiActions";
  import type {
    RuntimeValue,
    ManifestProperty,
    InspectedField,
  } from "../../../runtime-contract/src/index";
  import {
    inspectorFieldText,
    type InspectionView,
    type InspectorField,
  } from "../inspectorModel";

  const language = useLanguage();
  const t = language.t;
  interface Props {
    data: InspectionView;
    readOnly?: boolean;
    inspected?: InspectionView | null;
    editingField?: string;
    fieldInput?: HTMLInputElement | null;
    fieldDraft?: string;
    fieldError?: string;
    fieldProperty: (
      data: RuntimeValue,
      field: InspectedField,
    ) => ManifestProperty | null | undefined;
    canEditField?: (
      field: InspectorField,
      data?: InspectionView | null,
    ) => boolean;
    fieldValue: (data: RuntimeValue, field: InspectorField) => string;
    saveField?: (field: InspectorField) => Promise<void>;
    inspectFieldReference: (id: string, field: InspectorField) => Promise<void>;
    beginFieldEdit?: (
      field: InspectorField,
      data?: InspectionView | null,
    ) => void;
    onFieldError: (error: { property: string; message: string }) => void;
  }

  let {
    data,
    readOnly = false,
    inspected = null,
    editingField = $bindable(""),
    fieldInput = $bindable(null),
    fieldDraft = $bindable(""),
    fieldError = "",
    fieldProperty,
    canEditField = () => false,
    fieldValue,
    saveField = async () => {},
    inspectFieldReference,
    beginFieldEdit = () => {},
    onFieldError,
  }: Props = $props();

  function valueText(field: InspectorField) {
    if (field.defaultObjectDisplay && !field.error)
      return t("ui.codepad.object");
    return field.value === "<uninitialized>" && !field.inspectable
      ? t("ui.debug.notInitialized")
      : fieldValue(data, field);
  }

  function isPlaceholder(field: InspectorField) {
    return Boolean(
      field.defaultObjectDisplay ||
      field.error ||
      (!field.inspectable &&
        (field.value === "<uninitialized>" ||
          (field.computed && field.value === "…"))),
    );
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
            onkeydown={(event) => {
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
              onclick={() => {
                onFieldError({
                  property: field.name,
                  message: field.error!,
                });
              }}>{valueText(field)}</button
            >{:else}<output
              class:value-placeholder={isPlaceholder(field)}
              title={valueText(field)}>{valueText(field)}</output
            >{/if}
          {#if !readOnly && (editable || field.setterPrivate)}<button
              class="inspect-edit"
              class:inspect-edit-disabled={!editable}
              disabled={!editable}
              aria-label={t("ui.inspector.edit0", [field.name])}
              title={field.setterPrivate
                ? t("ui.inspector.theSetterIsPrivate")
                : "Edit"}
              onclick={() => beginFieldEdit(field, data)}>✎</button
            >{/if}
          <button
            class="inspect-reference"
            disabled={field.inspectable !== true}
            aria-label={t("ui.inspector.openReferencedObject0", [field.name])}
            title={t("ui.inspector.open0", [field.name])}
            onclick={() => inspectFieldReference(data.objectId || "", field)}
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
      <output
        class="inspect-scalar-value"
        title={inspectorFieldText({
          name: "",
          value: data.display,
          type: data.type,
        })}
        >{inspectorFieldText({
          name: "",
          value: data.display,
          type: data.type,
        })}</output
      >
    {/if}
    <span>{t("ui.inspector.noFields")}</span>
  {/each}
</div>
