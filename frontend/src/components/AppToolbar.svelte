<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import type { ProjectFile } from "../../../runtime-contract/src/index";

  import type { ActiveWindow } from "../uiTypes";
  export let newProjectOpen: boolean;
  export let toolbarDialog: "open" | "save" | null;
  export let files: ProjectFile[];
  export let libraryId: string;
  export let imageLibraryOpen: boolean;
  export let mediaNotice: string;
  export let projectName: string;
  export let terminalOpen: boolean;
  export let terminalSplit: boolean;
  export let activeWindow: ActiveWindow;
  export let showInheritance: boolean;
  export let showTestClasses: boolean;
  export let hasTestClasses: boolean;
  export let toggleInheritance: () => void;
  export let toggleTestClasses: () => void;
  export let commitProjectName: (event: KeyboardEvent) => void;
</script>

<div class="toolbar">
  <button
    class="toolbar-main-action"
    on:click={() => (newProjectOpen = true)}
    aria-label={t("ui.toolbar.newProject")}
    title={t("ui.toolbar.newProject")}
  >
    <span class="toolbar-action-icon" aria-hidden="true"
      ><svg viewBox="0 0 24 24"
        ><path d="M5 2.5h10l4 4V21.5H5z" /><path d="M15 2.5v4h4" /></svg
      ></span
    ><span>{t("ui.toolbar.newProject")}</span>
  </button>
  <button
    class="toolbar-main-action"
    on:click={() => (toolbarDialog = "open")}
    aria-label={t("ui.common.openImport")}
    title={t("ui.common.openImport")}
  >
    <span class="toolbar-action-icon" aria-hidden="true"
      ><svg viewBox="0 0 24 24"><path d="M6 19h12M12 16V5M9 8l3-3 3 3" /></svg
      ></span
    ><span>{t("ui.common.openImport")}</span>
  </button>
  <button
    class="toolbar-main-action"
    on:click={() => (toolbarDialog = "save")}
    disabled={!files.length}
    aria-label={t("ui.common.saveExport")}
    title={t("ui.common.saveExport")}
  >
    <span class="toolbar-action-icon" aria-hidden="true"
      ><svg viewBox="0 0 24 24"><path d="M6 5h12M12 8v11M9 16l3 3 3-3" /></svg
      ></span
    ><span>{t("ui.common.saveExport")}</span>
  </button>
  {#if libraryId === "blueplay"}
    <button
      class="toolbar-icon-button media-tool-button"
      on:click={() => (imageLibraryOpen = true)}
      aria-label={t("ui.common.images")}
      title={t("ui.common.images")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><rect x="3" y="3" width="18" height="18" rx="2" /><circle
          cx="8.5"
          cy="8.5"
          r="1.5"
        /><path d="m21 15-5-5L5 21" /></svg
      >
    </button>
    <button
      class="toolbar-icon-button media-tool-button"
      on:click={() => (mediaNotice = "Audio support is not implemented yet.")}
      aria-label={t("ui.toolbar.audio")}
      title={t("ui.toolbar.audio")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M3 10v4h4l5 4V6l-5 4H3Z" /><path
          d="M16 9a5 5 0 0 1 0 6M18.5 6.5a9 9 0 0 1 0 11"
        /></svg
      >
    </button>
  {/if}
  <input
    class="project-title"
    aria-label={t("ui.toolbar.projectName")}
    placeholder={t("ui.common.untitledProject")}
    bind:value={projectName}
    on:keydown={commitProjectName}
  />
  <div class="toolbar-options">
    <button
      class:active={terminalOpen}
      class="toolbar-icon-button"
      on:click={() => {
        terminalOpen = !terminalOpen;
        if (terminalOpen) activeWindow = "terminal";
        if (!terminalOpen) terminalSplit = false;
      }}
      aria-label={terminalOpen
        ? t("ui.toolbar.hideTerminal")
        : t("ui.toolbar.showTerminal")}
      title={terminalOpen
        ? t("ui.toolbar.hideTerminal")
        : t("ui.toolbar.showTerminal")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><rect x="2.5" y="3" width="19" height="18" rx="2" /><path
          d="M6 9l3 3-3 3M11 15h5"
        /></svg
      >
    </button>
    <button
      class:active={showInheritance}
      class="toolbar-icon-button"
      on:click={toggleInheritance}
      aria-label={showInheritance
        ? t("ui.toolbar.hideInheritanceArrows")
        : t("ui.toolbar.showInheritanceArrows")}
      title={showInheritance
        ? t("ui.toolbar.hideInheritanceArrows")
        : t("ui.toolbar.showInheritanceArrows")}
    >
      <svg viewBox="0 0 32 24" aria-hidden="true"
        ><rect x="2" y="2" width="11" height="6" rx="1" /><rect
          x="19"
          y="16"
          width="11"
          height="6"
          rx="1"
        /><path d="M24.5 16L8 8" /><path
          class="toolbar-arrowhead"
          d="M5.5 7.5L10 5.5 9 10z"
        /></svg
      >
    </button>
    <button
      class:active={showTestClasses}
      class="toolbar-icon-button test-classes-button"
      on:click={toggleTestClasses}
      disabled={!hasTestClasses}
      aria-label={showTestClasses
        ? t("ui.toolbar.hideTestClasses")
        : t("ui.toolbar.showTestClasses")}
      title={showTestClasses
        ? t("ui.toolbar.hideTestClasses")
        : t("ui.toolbar.showTestClasses")}
    >
      <svg class="test-classes-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3h11l4 4v14H3z" />
        <path d="M14 3v4h4" />
        <path class="test-check-row-one" d="m6 11 1.5 1.5L10 10" />
        <path class="test-check-row-two" d="m6 16 1.5 1.5L10 15" />
      </svg>
    </button>
  </div>
</div>
