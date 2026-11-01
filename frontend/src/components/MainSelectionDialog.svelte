<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import { focusOnMount, containClicks } from "../uiActions";

  import type { MainDialog } from "../uiTypes";
  interface Props {
    mainDialog: MainDialog | null;
    mainEntries: string[];
    chooseMain: (fileName: string) => Promise<void>;
  }

  let { mainDialog = $bindable(), mainEntries, chooseMain }: Props = $props();
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
          : mainDialog.action === "shareShortProgram"
            ? t("ui.transfer.chooseProgramMain")
            : t("ui.execution.whichMainShould0Run", [
                mainDialog.action === "reset" ? "Reset" : "Start main",
              ])}
      </p>
      <div class="toolbar-dialog-options main-selection-options">
        {#each mainEntries as fileName, index}
          <button
            class="toolbar-dialog-option"
            onclick={() => void chooseMain(fileName)}
            use:focusOnMount={index === 0}
            >{fileName} {t("ui.execution.main")}</button
          >
        {/each}
      </div>
      <div class="dialog-actions">
        <button onclick={() => (mainDialog = null)}
          >{t("ui.common.cancel")}</button
        >
      </div>
    </div>
  </div>{/if}
