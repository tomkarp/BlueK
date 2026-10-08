<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import { focusOnMount } from "../uiActions";

  /**
   * The call as code, like BlueJ: `Karte(` followed by one field per parameter,
   * separated by `,` and closed by `)`. The parameter name and type are the
   * placeholder of its field and its accessible name (GUI-100).
   */
  export let prefix: string;
  export let parameters: any[];
  export let values: string[];
  export let focusFirst: boolean;
  export let submit: () => void;

  const label = (parameter: any) =>
    `${parameter.name}: ${parameter.type?.displayName || "Any?"}${parameter.hasDefault ? " = …" : ""}`;
</script>

<div class="call-arguments" role="group" aria-label={t("ui.objects.call")}>
  <span class="call-prefix">{prefix}(</span>
  <div class="call-argument-list">
    {#each parameters as parameter, index}<div class="call-argument">
        <input
          bind:value={values[index]}
          placeholder={label(parameter)}
          aria-label={label(parameter)}
          use:focusOnMount={focusFirst && index === 0}
          on:keydown={(event) => event.key === "Enter" && submit()}
        /><span class="call-separator"
          >{index === parameters.length - 1 ? ")" : ","}</span
        >
      </div>{:else}<span class="call-separator call-empty">)</span>{/each}
  </div>
</div>
