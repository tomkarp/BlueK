<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";

  type Choice = "replace" | "new-window" | "cancel";
  interface Props {
    open: boolean;
    choose: (choice: Choice) => void;
  }

  let { open, choose }: Props = $props();
  const t = useLanguage().t;
</script>

{#if open}
  <div class="modal topmost-modal">
    <div
      class="dialog project-destination-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="project-destination-title"
    >
      <h3 id="project-destination-title">{t("ui.projects.projectAlreadyOpen")}</h3>
      <p>{t("ui.projects.chooseReplaceOrNewWindow")}</p>
      <div class="project-choice-list">
        <div class="project-choice-row">
          <button onclick={() => choose("replace")}>
            <strong>{t("ui.projects.replaceInCurrentWindow")}</strong>
          </button>
          <button onclick={() => choose("new-window")}>
            <strong>{t("ui.projects.openInNewWindow")}</strong>
          </button>
        </div>
      </div>
      <div class="dialog-actions">
        <button onclick={() => choose("cancel")}>{t("ui.common.cancel")}</button>
      </div>
    </div>
  </div>
{/if}
