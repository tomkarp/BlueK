<script lang="ts">
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
      <section class="offline-version-option">
        <h4>{t("ui.offline.browserTitle")}</h4>
        <p>{t("ui.offline.browserDescription")}</p>
        <a
          class="offline-download-action"
          href={downloadUrl}
          download="BlueK-offline.zip"
          onclick={() => (open = false)}>{t("ui.offline.downloadZIP")}</a
        >
      </section>
      <section class="offline-version-option">
        <h4>{t("ui.offline.desktopTitle")}</h4>
        <p>{t("ui.offline.desktopDescription")}</p>
        <p>{t("ui.offline.desktopPlatformNote")}</p>
        <a
          class="offline-download-action"
          href="https://github.com/tomkarp/BlueK/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          onclick={() => (open = false)}
          >{t("ui.offline.downloadDesktopApp")}</a
        >
      </section>
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
      </div>
    </div>
  </div>
{/if}
