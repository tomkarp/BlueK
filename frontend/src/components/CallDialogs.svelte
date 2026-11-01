<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  import { focusOnMount, containClicks } from "../uiActions";

  import type { RuntimeValue } from "../../../runtime-contract/src/index";

  import type {
    BenchObject,
    CreateDialog,
    InvokeDialog,
    ResultDialog,
  } from "../uiTypes";
  import { missingRequired, missingTypeArgument } from "../uiParity";
  import CallArguments from "./CallArguments.svelte";
  let expected = $state("");
  let assertionKind: "equals" | "null" | "notNull" = $state("equals");
  let previousResult: ResultDialog | null = $state(null);

  interface Props {
    recording?: boolean;
    assertionAvailable?: boolean;
    suggestedExpected?: string | null;
    assertionError?: string;
    inspectorOnTop: boolean;
    addAssertion?: (
      expected: string,
      kind: "equals" | "null" | "notNull",
    ) => Promise<void>;
    createDialog: CreateDialog | null;
    invokeDialog: InvokeDialog | null;
    resultDialog: ResultDialog | null;
    createName: string;
    createArgs: string[];
    createTypeArgs: string[];
    invokeArgs: string[];
    invokeTypeArgs: string[];
    dialogError: string;
    canExecute: boolean;
    chooseConstructor: (index: number) => void;
    confirmCreate: () => Promise<void>;
    confirmInvoke: () => Promise<void>;
    inspectObject: (
      object: BenchObject,
      preserveReferenceName?: boolean,
    ) => Promise<void>;
    requestObjectOnBench: (value: RuntimeValue) => void;
  }

  let {
    recording = false,
    assertionAvailable = false,
    suggestedExpected = null,
    assertionError = "",
    inspectorOnTop,
    addAssertion = async () => {},
    createDialog = $bindable(),
    invokeDialog = $bindable(),
    resultDialog = $bindable(),
    createName = $bindable(),
    createArgs = $bindable(),
    createTypeArgs = $bindable(),
    invokeArgs = $bindable(),
    invokeTypeArgs = $bindable(),
    dialogError,
    canExecute,
    chooseConstructor,
    confirmCreate,
    confirmInvoke,
    inspectObject,
    requestObjectOnBench,
  }: Props = $props();
  const t = language.t;
  $effect(() => {
    if (resultDialog !== previousResult) {
      previousResult = resultDialog;
      expected = suggestedExpected || "";
    }
  });
</script>

{#if createDialog}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog create-object-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="create-object-title"
      use:containClicks
    >
      <h3 id="create-object-title">
        {t("ui.common.create")}
        {createDialog.className}{createDialog.typeParameters.length
          ? `<${createTypeArgs.map((value) => value || "…").join(", ")}>`
          : ""}
      </h3>
      <label
        >{t("ui.common.nameOfInstance")}<input
          bind:value={createName}
          use:focusOnMount={!createDialog.parameters.length &&
            !createDialog.typeParameters.length}
          onkeydown={(event) => {
            if (event.key === "Escape") createDialog = null;
            if (event.key === "Enter") confirmCreate();
          }}
        /></label
      >{#if createDialog.constructors.length > 1}<label
          >{t("ui.objects.constructor")}<select
            bind:value={createDialog.constructorIndex}
            onchange={(event) =>
              chooseConstructor(
                Number((event.currentTarget as HTMLSelectElement).value),
              )}
            >{#each createDialog.constructors as constructor, index}<option
                value={index}
                >{createDialog.className}({constructor.parameters
                  ?.map(
                    (parameter: any) =>
                      `${parameter.name}: ${parameter.type?.displayName || "Any?"}`,
                  )
                  .join(", ")})</option
              >{/each}</select
          ></label
        >{/if}{#each createDialog.typeParameters as typeParameter, index}<label
          >{t("ui.objects.typeArgument")}
          {typeParameter}<input
            bind:value={createTypeArgs[index]}
            use:focusOnMount={index === 0}
            onkeydown={(event) => event.key === "Enter" && confirmCreate()}
          /></label
        >{/each}<CallArguments
        prefix={createDialog.className +
          (createDialog.typeParameters.length
            ? `<${createTypeArgs.map((value) => value || "…").join(", ")}>`
            : "")}
        parameters={createDialog.parameters}
        bind:values={createArgs}
        focusFirst={!createDialog.typeParameters.length}
        submit={confirmCreate}
      />{#if dialogError}<div class="dialog-error" role="alert">
          {$language.message(dialogError)}
        </div>{/if}
      <div class="dialog-actions">
        <button onclick={() => (createDialog = null)}
          >{t("ui.common.cancel")}</button
        ><button
          onclick={confirmCreate}
          disabled={!canExecute ||
            missingTypeArgument(createTypeArgs) ||
            missingRequired(createDialog.parameters, createArgs)}
          >{t("ui.common.create")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if invokeDialog}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog method-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="invoke-method-title"
      use:containClicks
    >
      <h3 id="invoke-method-title">
        {invokeDialog.object
          ? invokeDialog.object.name + "."
          : invokeDialog.receiver || ""}{invokeDialog.method.name}()
      </h3>
      {#each invokeDialog.method.typeParameters || [] as typeParameter, index}<label
          >{t("ui.objects.typeArgument")}
          {typeParameter}<input
            bind:value={invokeTypeArgs[index]}
            use:focusOnMount={index === 0}
            onkeydown={(event) => event.key === "Enter" && confirmInvoke()}
          /></label
        >{/each}<CallArguments
        prefix={(invokeDialog.object
          ? invokeDialog.object.name + "."
          : invokeDialog.receiver || "") +
          invokeDialog.method.name +
          (invokeDialog.method.typeParameters?.length
            ? `<${invokeTypeArgs.map((value) => value || "…").join(", ")}>`
            : "")}
        parameters={invokeDialog.method.parameters || []}
        bind:values={invokeArgs}
        focusFirst={!invokeDialog.method.typeParameters?.length}
        submit={confirmInvoke}
      />{#if dialogError}<div class="dialog-error" role="alert">
          {$language.message(dialogError)}
        </div>{/if}
      <div class="dialog-actions">
        <button onclick={() => (invokeDialog = null)}
          >{t("ui.common.cancel")}</button
        ><button
          onclick={confirmInvoke}
          disabled={!canExecute ||
            missingTypeArgument(invokeTypeArgs) ||
            missingRequired(invokeDialog.method.parameters || [], invokeArgs)}
          >{t("ui.objects.invoke")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if resultDialog}<div
    class={[
      "modal topmost-modal result-modal",
      { "inspector-on-top": inspectorOnTop },
    ]}
  >
    <div
      class="dialog result-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <h3>{t("ui.objects.methodResult")}</h3>
      <div class="result-method">{resultDialog.method}</div>
      <output class="result-value"
        >{#if resultDialog.defaultObjectDisplay}<span class="value-placeholder"
            >{t("ui.codepad.object")}</span
          >
          : {resultDialog.className}{:else}{resultDialog.value}{/if}</output
      >
      {#if recording && assertionAvailable}<div class="test-assertion">
          <label
            >{t("ui.objects.testAssertion")}<select bind:value={assertionKind}
              ><option value="equals"
                >{t("ui.objects.equalsExpectedValue")}</option
              ><option value="null">{t("ui.objects.isNull")}</option><option
                value="notNull">{t("ui.objects.isNotNull")}</option
              ></select
            ></label
          >
          {#if assertionKind === "equals"}<label
              >{t("ui.objects.expectedKotlinExpression")}<input
                bind:value={expected}
                spellcheck="false"
              /></label
            >{/if}
          {#if assertionError}<p class="dialog-error" role="alert">
              {$language.message(assertionError)}
            </p>{/if}
          <button
            disabled={!canExecute ||
              (assertionKind === "equals" && !expected.trim())}
            onclick={async () => {
              await addAssertion(expected, assertionKind);
            }}>{t("ui.objects.addAssertion")}</button
          >
        </div>{:else if recording}<p>{t("ui.objects.resultRecorded")}</p>{/if}
      <div class="result-actions">
        {#if resultDialog.objectId}<button
            onclick={() => {
              const object = {
                objectId: resultDialog!.objectId!,
                className: resultDialog!.className || "Object",
                name: "",
              };
              inspectObject(object, true);
            }}>{t("ui.common.inspect")}</button
          ><button
            onclick={() => {
              requestObjectOnBench({
                objectId: resultDialog!.objectId!,
                className: resultDialog!.className || "Object",
                name: resultDialog!.className || "Object",
                kind: "object",
              });
            }}>{t("ui.objects.get")}</button
          >{/if}<button onclick={() => (resultDialog = null)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
