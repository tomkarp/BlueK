<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import type {
    ProjectFile,
    RuntimeSnapshot,
  } from "../../../runtime-contract/src/index";

  import type { NewClassType } from "../uiTypes";
  export let newClassOpen: boolean;
  export let newClassName: string;
  export let newClassType: NewClassType;
  export let inheritanceMode: boolean;
  export let inheritanceSelection: string;
  export let status: string;
  export let displayFiles: ProjectFile[];
  export let files: ProjectFile[];
  export let phase: RuntimeSnapshot["phase"];
  export let inputReady: boolean;
  export let canExecute: boolean;
  export let mainEntries: string[];
  export let compileShortcutLabel: string;
  export let runShortcutLabel: string;
  export let exportProject: () => void;
  export let compile: () => Promise<boolean>;
  export let recording = false;
  export let openTests: () => void = () => {};
  export let runTests: () => void = () => {};
  export let offlineBuild: boolean;
  export let offlineDownloadOpen: boolean;
  export let shortcutsHelpOpen: boolean;
  export let settingsNotice: boolean;
  export let runMain: () => Promise<void>;
  export let openFeedback: () => void;
</script>

<nav class="sidebar">
  <button
    on:click={() => {
      newClassOpen = true;
      newClassName = "";
      newClassType = "class";
    }}>{t("ui.sidebar.newFile")}</button
  >
  <button class="sidebar-legacy-save" on:click={exportProject}
    >{t("ui.sidebar.saveProject")}</button
  >
  <button
    class:active-tool={inheritanceMode}
    disabled={displayFiles.filter((file) => file.kind === "class").length < 2}
    on:click={() => {
      inheritanceMode = !inheritanceMode;
      inheritanceSelection = "";
      status = inheritanceMode ? "Select subclass, then superclass" : "Ready";
    }}
  >
    {t("ui.sidebar.inheritance")}<span
      class="inheritance-icon"
      aria-hidden="true"
      ><svg viewBox="0 0 72 32"
        ><line x1="2" y1="16" x2="40" y2="16" /><path
          d="M40 2 L70 16 L40 30 Z"
        /></svg
      ></span
    >
  </button>
  <button
    on:click={compile}
    title={t("ui.sidebar.compile0", [compileShortcutLabel])}
    disabled={!files.length ||
      phase === "compiling" ||
      phase === "running" ||
      inputReady}>{t("ui.common.compile")}</button
  >
  <button
    on:click={() => void runMain()}
    title={t("ui.sidebar.startMain0", [runShortcutLabel])}
    aria-label={t("ui.sidebar.startMain")}
    disabled={!canExecute || !mainEntries.length}
    >{t("ui.sidebar.startMain")}</button
  >
  <details class="sidebar-testing">
    <summary
      class="sidebar-testing-toggle"
      aria-label={t("ui.sidebar.showOrHideTestingActions")}
      title={t("ui.sidebar.showOrHideTestingActions")}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"
        ><path d="M3 2 13 8 3 14Z" /></svg
      >
    </summary>
    <div class="sidebar-testing-actions" id="sidebar-testing-actions">
      <p class="sidebar-testing-notice">
        {t("ui.sidebar.testingIsStillInTheAlphaStage")}
      </p>
      <button on:click={openTests}
        >{recording ? t("ui.sidebar.recording") : t("ui.sidebar.tests")}</button
      >
      <button
        on:click={runTests}
        disabled={recording ||
          phase === "running" ||
          phase === "compiling" ||
          inputReady}>{t("ui.sidebar.runAllTests")}</button
      >
    </div>
  </details>
  <div class="side-spacer"></div>
  <button class="sidebar-feedback-button" on:click={openFeedback}
    >{t("ui.feedback.title")}</button
  >
  <div
    class="sidebar-utilities"
    role="group"
    aria-label={t("ui.sidebar.applicationActions")}
  >
    {#if !offlineBuild}<button
        class="utility-icon-button toolbar-download-button"
        on:click={() => (offlineDownloadOpen = true)}
        aria-label={t("ui.sidebar.offlineVersion")}
        title={t("ui.sidebar.downloadBlueKForOfflineUse")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><path d="M12 3v11m-4-4 4 4 4-4" /><path d="M4 17v4h16v-4" /></svg
        >
      </button>{/if}
    <button
      class="utility-icon-button toolbar-help-button"
      on:click={() => (shortcutsHelpOpen = true)}
      aria-label={t("ui.sidebar.help")}
      title={t("ui.sidebar.help")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><circle cx="12" cy="12" r="9" /><path
          d="M9.7 9a2.4 2.4 0 1 1 3.9 1.9c-1.1.8-1.6 1.1-1.6 2.6"
        /><circle cx="12" cy="17.2" r=".7" /></svg
      >
    </button>
    <button
      class="utility-icon-button settings-button"
      on:click={() => (settingsNotice = true)}
      aria-label={t("ui.common.settings")}
      title={t("ui.common.settings")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path
          d="M9.7 3.8l.6-1.3h3.4l.6 1.3 1.3.6 1.4-.3 2.4 2.4-.3 1.4.6 1.3 1.3.6v3.4l-1.3.6-.6 1.3.3 1.4-2.4 2.4-1.4-.3-1.3.6-.6 1.3h-3.4l-.6-1.3-1.3-.6-1.4.3-2.4-2.4.3-1.4-.6-1.3-1.3-.6V9.8l1.3-.6.6-1.3-.3-1.4 2.4-2.4 1.4.3zM12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"
        /></svg
      >
    </button>
  </div>
</nav>
