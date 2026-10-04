<script lang="ts">
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
        Create {createDialog.className}{createDialog.typeParameters.length
          ? `<${createTypeArgs.map((value) => value || "…").join(", ")}>`
          : ""}
      </h3>
      <label
        >Name of instance<input
          bind:value={createName}
          use:focusOnMount={!createDialog.parameters.length &&
            !createDialog.typeParameters.length}
          on:keydown={(event) => {
            if (event.key === "Escape") createDialog = null;
            if (event.key === "Enter") confirmCreate();
          }}
        /></label
      >{#if createDialog.constructors.length > 1}<label
          >Constructor<select
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
          >Type argument {typeParameter}<input
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
          {dialogError}
        </div>{/if}
      <div class="dialog-actions">
        <button on:click={() => (createDialog = null)}>Cancel</button><button
          on:click={confirmCreate}
          disabled={!canExecute ||
            missingTypeArgument(createTypeArgs) ||
            missingRequired(createDialog.parameters, createArgs)}>Create</button
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
          >Type argument {typeParameter}<input
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
          {dialogError}
        </div>{/if}
      <div class="dialog-actions">
        <button on:click={() => (invokeDialog = null)}>Cancel</button><button
          on:click={confirmInvoke}
          disabled={!canExecute ||
            missingTypeArgument(invokeTypeArgs) ||
            missingRequired(invokeDialog.method.parameters || [], invokeArgs)}
          >Invoke</button
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
      <h3>Method result</h3>
      <div class="result-method">{resultDialog.method}</div>
      <output class="result-value">{resultDialog.value}</output>
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
            }}>Inspect</button
          ><button
            on:click={() => {
              requestObjectOnBench({
                objectId: resultDialog!.objectId!,
                className: resultDialog!.className || "Object",
                name: resultDialog!.className || "Object",
                kind: "object",
              });
              resultDialog = null;
            }}>Get</button
          >{/if}<button on:click={() => (resultDialog = null)}>Close</button>
      </div>
    </div>
  </div>{/if}
