<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
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
  export let recording = false;
  export let assertionAvailable = false;
  export let suggestedExpected: string | null = null;
  export let assertionError = "";
  export let addAssertion: (
    expected: string,
    kind: "equals" | "null" | "notNull",
  ) => Promise<void> = async () => {};
  let expected = "";
  let assertionKind: "equals" | "null" | "notNull" = "equals";
  let previousResult: ResultDialog | null = null;
  $: if (resultDialog !== previousResult) {
    previousResult = resultDialog;
    expected = suggestedExpected || "";
  }

  export let createDialog: CreateDialog | null;
  export let invokeDialog: InvokeDialog | null;
  export let resultDialog: ResultDialog | null;
  export let createName: string;
  export let createArgs: string[];
  export let createTypeArgs: string[];
  export let invokeArgs: string[];
  export let invokeTypeArgs: string[];
  export let dialogError: string;
  export let canExecute: boolean;
  export let chooseConstructor: (index: number) => void;
  export let confirmCreate: () => Promise<void>;
  export let confirmInvoke: () => Promise<void>;
  export let inspectObject: (
    object: BenchObject,
    preserveReferenceName?: boolean,
  ) => Promise<void>;
  export let requestObjectOnBench: (value: RuntimeValue) => void;
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
          on:keydown={(event) => {
            if (event.key === "Escape") createDialog = null;
            if (event.key === "Enter") confirmCreate();
          }}
        /></label
      >{#if createDialog.constructors.length > 1}<label
          >{t("ui.objects.constructor")}<select
            bind:value={createDialog.constructorIndex}
            on:change={(event) =>
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
            on:keydown={(event) => event.key === "Enter" && confirmCreate()}
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
        <button on:click={() => (createDialog = null)}
          >{t("ui.common.cancel")}</button
        ><button
          on:click={confirmCreate}
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
            on:keydown={(event) => event.key === "Enter" && confirmInvoke()}
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
        <button on:click={() => (invokeDialog = null)}
          >{t("ui.common.cancel")}</button
        ><button
          on:click={confirmInvoke}
          disabled={!canExecute ||
            missingTypeArgument(invokeTypeArgs) ||
            missingRequired(invokeDialog.method.parameters || [], invokeArgs)}
          >{t("ui.objects.invoke")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if resultDialog}<div class="modal topmost-modal">
    <div
      class="dialog result-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <h3>{t("ui.objects.methodResult")}</h3>
      <div class="result-method">{resultDialog.method}</div>
      <output class="result-value">{resultDialog.value}</output>
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
            on:click={async () => {
              await addAssertion(expected, assertionKind);
            }}>{t("ui.objects.addAssertion")}</button
          >
        </div>{:else if recording}<p>{t("ui.objects.resultRecorded")}</p>{/if}
      <div class="result-actions">
        {#if resultDialog.objectId}<button
            on:click={() => {
              const object = {
                objectId: resultDialog!.objectId!,
                className: resultDialog!.className || "Object",
                name: resultDialog!.className || "Object",
              };
              inspectObject(object);
              resultDialog = null;
            }}>{t("ui.common.inspect")}</button
          ><button
            on:click={() => {
              requestObjectOnBench({
                objectId: resultDialog!.objectId!,
                className: resultDialog!.className || "Object",
                name: resultDialog!.className || "Object",
                kind: "object",
              });
              resultDialog = null;
            }}>{t("ui.objects.get")}</button
          >{/if}<button on:click={() => (resultDialog = null)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
