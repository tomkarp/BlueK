<script lang="ts">
  import TranslatedText from "./TranslatedText.svelte";
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import { containClicks } from "../uiActions";
  interface Props {
    open: boolean;
    downloadUrl: string;
    openFeedback: () => void;
  }

  let { open = $bindable(), downloadUrl, openFeedback }: Props = $props();
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
        {t("ui.offline.intro")}
      </p>
      <ol>
        <li>{t("ui.offline.downloadAndExtractTheZIPFile")}</li>
        <li><TranslatedText message="ui.offline.openHtml" /></li>
        <li><TranslatedText message="ui.offline.saveProjects" /></li>
      </ol>
      <div class="offline-download-caution">
        <p>
          {t("ui.offline.theOfflineVersionHasNotYetBeenWidely")}
        </p>
        <p>
          <button class="feedback-inline-button" onclick={openFeedback}
            >{t("ui.feedback.title")}</button
          >
          {t("ui.offline.internetConnectionRequired")}
        </p>
      </div>
      <div class="dialog-actions">
        <button onclick={() => (open = false)}>{t("ui.common.cancel")}</button>
        <a
          class="offline-download-action"
          href={downloadUrl}
          download="BlueK-offline.zip"
          onclick={() => (open = false)}>{t("ui.offline.downloadZIP")}</a
        >
      </div>
    </div>
  </div>
{/if}
