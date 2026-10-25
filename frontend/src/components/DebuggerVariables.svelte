<script lang="ts">
  import type { DebugVariable } from "../../../runtime-contract/src/index";
  import type { BenchObject } from "../uiTypes";
  import { useLanguage } from "../i18n/Language.svelte";

  const language = useLanguage();
  $: t = $language.t;
  export let variables: DebugVariable[];
  export let label: string;
  export let scope: "local" | "global" = "local";
  export let emptyMessage = "";
  export let inspectObject: (object: BenchObject) => Promise<void>;

  function valueText(variable: DebugVariable) {
    if (variable.computed) return t("ui.debug.computedProperty");
    return variable.initialized
      ? (variable.display ?? `(${variable.type})`)
      : t("ui.debug.notInitialized");
  }
</script>

<section class="debugger-values" aria-label={label}>
  <h3>{label}</h3>
  {#if variables.length}
    <dl class="debug-values-list" class:debug-variables={scope === "local"} class:debug-globals={scope === "global"}>
      {#each variables as variable (variable.name)}
        <div>
          <dt>{variable.name}</dt>
          <dd title={variable.type}>
            {#if variable.objectId}
              <button
                class="debug-object-value"
                aria-label={t("ui.inspector.open0", [variable.name])}
                on:click={() => void inspectObject({
                  objectId: variable.objectId!,
                  className: variable.type,
                  name: variable.name,
                })}
              >
                <span class="codepad-object-icon" aria-hidden="true"></span><span><span class="value-placeholder">{t("ui.codepad.object")}</span> : {variable.type}</span>
              </button>
            {:else}
              <span class:value-placeholder={!variable.initialized || variable.computed || variable.display === null}>{valueText(variable)}</span>
            {/if}
          </dd>
        </div>
      {/each}
    </dl>
  {:else if emptyMessage}
    <p>{emptyMessage}</p>
  {/if}
</section>
