<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import { focusOnMount, containClicks } from "../uiActions";

  import type { MainDialog } from "../uiTypes";
  export let mainDialog: MainDialog | null;
  export let mainEntries: string[];
  export let chooseMain: (fileName: string) => Promise<void>;
</script>

{#if mainDialog}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog main-selection-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="main-selection-title"
      tabindex="-1"
      use:containClicks
    >
      <h2 id="main-selection-title">{t("ui.execution.chooseMain")}</h2>
      <p>
        {mainDialog.action === "export"
          ? t("ui.execution.whichMainShouldTheExportedHTMLFileStart")
          : t("ui.execution.whichMainShould0Run", [
              mainDialog.action === "reset" ? "Reset" : "Start main",
            ])}
      </p>
      <div class="toolbar-dialog-options main-selection-options">
        {#each mainEntries as fileName, index}
          <button
            class="toolbar-dialog-option"
            on:click={() => void chooseMain(fileName)}
            use:focusOnMount={index === 0}
            >{fileName} {t("ui.execution.main")}</button
          >
        {/each}
      </div>
      <div class="dialog-actions">
        <button on:click={() => (mainDialog = null)}
          >{t("ui.common.cancel")}</button
        >
      </div>
    </div>
  </div>{/if}
