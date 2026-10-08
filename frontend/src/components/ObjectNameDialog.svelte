<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import { focusOnMount, containClicks } from "../uiActions";

  import type { RuntimeValue } from "../../../runtime-contract/src/index";

  export let objectNamePrompt: RuntimeValue | null;
  export let objectName: string;
  export let objectNameError: string;
  export let confirmObjectOnBench: () => Promise<void>;
</script>

{#if objectNamePrompt}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog create-object-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      use:containClicks
    >
      <h3>{t("ui.objects.newObjectName")}</h3>
      <p>{t("ui.objects.enterTheNameForTheNewObjectOn")}</p>
      <label
        >{t("ui.common.nameOfInstance")}<input
          bind:value={objectName}
          use:focusOnMount
          on:keydown={(event) => {
            if (event.key === "Escape") objectNamePrompt = null;
            if (event.key === "Enter") confirmObjectOnBench();
          }}
        /></label
      >
      {#if objectNameError}<p role="alert">{objectNameError}</p>{/if}
      <div class="dialog-actions">
        <button on:click={() => (objectNamePrompt = null)}
          >{t("ui.common.cancel")}</button
        ><button
          on:click={confirmObjectOnBench}
          disabled={!/^[A-Za-z_]\w*$/.test(objectName.trim())}
          >{t("ui.common.oK")}</button
        >
      </div>
    </div>
  </div>{/if}
