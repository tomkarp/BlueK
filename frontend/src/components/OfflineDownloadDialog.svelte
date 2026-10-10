<script lang="ts">
  import TranslatedText from "./TranslatedText.svelte";
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import { containClicks } from "../uiActions";
  export let open: boolean;
  export let downloadUrl: string;
  export let openFeedback: () => void;
</script>

{#if open}
  <div class="modal topmost-modal" role="presentation">
    <div
      class="dialog offline-download-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-download-title"
      tabindex="-1"
      use:containClicks
    >
      <h3 id="offline-download-title">{t("ui.offline.blueKOffline")}</h3>
      <p>
        {t("ui.offline.youCanUseBlueKOnlineWithoutDownloadingAnything")}
      </p>
      <ol>
        <li>{t("ui.offline.downloadAndExtractTheZIPFile")}</li>
        <li><TranslatedText message="ui.offline.openHtml" /></li>
        <li><TranslatedText message="ui.offline.saveProjects" /></li>
      </ol>
      <p class="offline-download-note">
        {t("ui.offline.autosaveDependsOnYourBrowserAndTheLocation")}
      </p>
      <div class="offline-download-caution">
        <p>
          {t("ui.offline.theOfflineVersionHasNotYetBeenWidely")}
        </p>
        <p>
          <button class="feedback-inline-button" on:click={openFeedback}
            >{t("ui.feedback.title")}</button
          >
          {t("ui.offline.internetConnectionRequired")}
        </p>
      </div>
      <div class="dialog-actions">
        <button on:click={() => (open = false)}>{t("ui.common.cancel")}</button>
        <a
          class="offline-download-action"
          href={downloadUrl}
          download="BlueK-offline.zip"
          on:click={() => (open = false)}>{t("ui.offline.downloadZIP")}</a
        >
      </div>
    </div>
  </div>
{/if}
