<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import { containClicks } from "../uiActions";

  import type { ProjectFile } from "../../../runtime-contract/src/index";

  import type { ShareLinkDialog } from "../uiTypes";
  import type { ProjectDraftSummary } from "../projectDraftStorage";
  export let recentProjects: ProjectDraftSummary[];
  export let openRecentProject: (id: string) => Promise<void>;
  export let deleteRecentProject: (id: string) => void;
  export let deleteAllRecentProjects: () => void;
  export let toolbarDialog: "open" | "save" | null;
  export let shareLinkDialog: ShareLinkDialog | null;
  // A compile-time condition also removes server-only controls from offline JS.
  const serverFeatures = import.meta.env.VITE_BLUEK_OFFLINE !== "1";
  export let shareCodeInput: string;
  export let shareCodeError: string;
  export let shareWithReadme: boolean;
  export let shareWithState: boolean;
  export let canShareState: boolean;
  export let defaultTestClass: string;
  export let readme: string;
  export let files: ProjectFile[];
  export let htmlExportBlocked: boolean;
  export let htmlExporting: boolean;
  export let openProjectDrop: (event: DragEvent) => Promise<void>;
  export let importProject: (event: Event) => Promise<void>;
  export let loadSharedProjectFromCode: () => Promise<void>;
  export let shareProject: () => Promise<void>;
  export let saveShortProject: () => Promise<void>;
  export let exportProject: () => void;
  export let exportHtml: () => Promise<void>;
  export let copySharedLink: () => Promise<void>;
</script>

{#if toolbarDialog === "open"}<div
    class="modal topmost-modal"
    role="presentation"
  >
    <div
      class="dialog toolbar-dialog open-project-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="open-import-title"
      use:containClicks
    >
      <h3 id="open-import-title">{t("ui.common.openImport")}</h3>
      <div class="open-project-content">
        {#if recentProjects.length}
          <section class="recent-projects" aria-labelledby="recent-work-title">
            <div class="recent-projects-heading">
              <h4 id="recent-work-title">{t("ui.transfer.recentWork")}</h4>
              <button
                class="delete-all-projects"
                aria-label={t("ui.transfer.deleteAllSavedProjects")}
                on:click={deleteAllRecentProjects}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"
                  ><path
                    d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"
                  /></svg
                >
                <span>{t("ui.transfer.deleteAll")}</span>
              </button>
            </div>
            <p>{t("ui.transfer.savedInThisBrowserChooseAProjectTo")}</p>
            <div class="recent-project-list">
              {#each recentProjects as project (project.id)}
                <div class="recent-project-row">
                  <button
                    class="recent-project"
                    on:click={() => void openRecentProject(project.id)}
                  >
                    <strong
                      >{project.name === "Untitled project"
                        ? t("ui.common.untitledProject")
                        : project.name}</strong
                    >
                    <span
                      >{project.fileCount}
                      {project.fileCount === 1
                        ? t("ui.transfer.file")
                        : t("ui.transfer.files")}
                      {t("ui.transfer.lastSaved")}
                      {new Date(project.updatedAt).toLocaleString(
                        $language.locale,
                      )}</span
                    >
                  </button>
                  <button
                    class="delete-recent-project"
                    aria-label={t("ui.transfer.deleteSavedProject0", [
                      project.name,
                    ])}
                    title={t("ui.transfer.deleteSavedProject0", [project.name])}
                    on:click={() => deleteRecentProject(project.id)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"
                      ><path
                        d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"
                      /></svg
                    >
                  </button>
                </div>
              {/each}
            </div>
          </section>
        {/if}
        <p>{t("ui.transfer.dropAProjectFileHereOrClickTo")}</p>
        <label
          class="project-dropzone"
          on:dragover|preventDefault
          on:drop={openProjectDrop}
        >
          <strong>JSON</strong>
          <span>{t("ui.transfer.acceptedJson")}</span>
          <input
            type="file"
            aria-label={t("ui.transfer.chooseProjectFile")}
            accept=".json,.bluek.json,application/json"
            on:change={(event) => {
              importProject(event);
              toolbarDialog = null;
            }}
          />
        </label>
        {#if serverFeatures}<div class="shared-project-loader">
            <strong>{t("ui.transfer.loadSharedProject")}</strong>
            <label>
              <span>{t("ui.transfer.threeWords")}</span>
              <input
                aria-label={t("ui.transfer.threeWordProjectCode")}
                bind:value={shareCodeInput}
                placeholder="green-lamp-river"
                on:keydown={(event) =>
                  event.key === "Enter" && loadSharedProjectFromCode()}
              />
            </label>
            <button
              class="shared-project-load"
              disabled={!shareCodeInput.trim()}
              on:click={loadSharedProjectFromCode}
              >{t("ui.transfer.loadProject")}</button
            >
            {#if shareCodeError}<div class="dialog-error" role="alert">
                {shareCodeError}
              </div>{/if}
          </div>{/if}
      </div>
      <div class="dialog-actions">
        <button on:click={() => (toolbarDialog = null)}
          >{t("ui.common.cancel")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if toolbarDialog === "save"}<div
    class="modal topmost-modal"
    role="presentation"
  >
    <div
      class="dialog toolbar-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="save-export-title"
      use:containClicks
    >
      <h3 id="save-export-title">{t("ui.common.saveExport")}</h3>
      <p>{t("ui.transfer.chooseHowToSaveOrShareThisProject")}</p>
      <div class="project-choice-list toolbar-project-choice-list">
        <button
          on:click={() => {
            shareProject();
            toolbarDialog = null;
          }}
          disabled={!files.length}
          ><strong>{t("ui.common.copyFullProjectLink")}</strong><span
            >{t("ui.transfer.shareTheCompleteProjectEncodedInTheURL")}</span
          ></button
        >
        {#if serverFeatures}<button
            on:click={() => {
              void saveShortProject();
              toolbarDialog = null;
            }}
            disabled={!files.length}
            ><strong>{t("ui.common.copyShortLink")}</strong><span
              >{t("ui.transfer.saveTheProjectFor30DaysAndCopy")}</span
            ></button
          >{/if}
        <div
          class="share-link-options"
          class:single-link={!serverFeatures}
          role="group"
          aria-labelledby="link-options-label"
        >
          <span id="link-options-label"
            >{t("ui.transfer.whenOpeningALink")}</span
          >
          <label
            class="share-link-option"
            class:disabled={!readme.trim()}
            title={readme.trim()
              ? t("ui.transfer.showREADMEMdRightAwayWhenThisLink")
              : t("ui.transfer.theREADMEIsStillEmptyThereIsNothing")}
            ><input
              type="checkbox"
              aria-label={t("ui.transfer.openREADMEMdWithTheLink")}
              bind:checked={shareWithReadme}
              disabled={!readme.trim()}
            /><span>{t("ui.transfer.openREADME")}</span></label
          >
          <label
            class="share-link-option"
            class:disabled={!canShareState}
            title={canShareState
              ? t("ui.transfer.loadStateFrom0IntoTheObjectBench", [
                  defaultTestClass,
                ])
              : t("ui.common.chooseADefaultTestClassFirst")}
            ><input
              type="checkbox"
              aria-label={t("ui.transfer.loadDefaultTestClassStateWithTheLink")}
              bind:checked={shareWithState}
              disabled={!canShareState}
            /><span>{t("ui.common.loadState")}</span></label
          >
        </div>
        <button
          class="file-export-choice"
          on:click={() => {
            exportProject();
            toolbarDialog = null;
          }}
          disabled={!files.length}
          ><strong>{t("ui.common.exportProjectJSON")}</strong><span
            >{t("ui.transfer.exportTheCompleteBlueKProjectAsJSON")}</span
          ></button
        >
        <button
          class="file-export-choice"
          on:click={() => {
            toolbarDialog = null;
            void exportHtml();
          }}
          disabled={!files.length || htmlExportBlocked || htmlExporting}
          ><strong>{t("ui.common.exportAsHTMLBeta")}</strong><span
            >{htmlExportBlocked
              ? t("ui.transfer.needsAFileWithAParameterlessMain")
              : t("ui.transfer.aSingleWebPageThatRunsTheProgram")}</span
          ></button
        >
        <button class="file-export-choice" disabled
          ><strong>{t("ui.transfer.exportBlueJProjectZip")}</strong><span
            >{t("ui.transfer.exportForBlueJNotImplementedYet")}</span
          ></button
        >
      </div>
      <div class="dialog-actions">
        <button on:click={() => (toolbarDialog = null)}
          >{t("ui.common.cancel")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if shareLinkDialog}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog share-link-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="share-link-title"
      use:containClicks
    >
      <h3 id="share-link-title">{t("ui.transfer.shortProjectLink")}</h3>
      <p>
        {shareLinkDialog.copied
          ? t("ui.transfer.theLinkWasCopiedToTheClipboardWrite")
          : t("ui.transfer.writeDownTheseThreeWords")}
      </p>
      <button
        class="share-link-code"
        aria-label={t("ui.transfer.threeWordProjectCode")}
        title={t("ui.transfer.copyProjectLink")}
        on:click={() => {
          void copySharedLink();
        }}>{shareLinkDialog.code}</button
      >
      <p class="share-link-full-label">{t("ui.transfer.completeLink")}</p>
      <button
        class="share-link-value"
        aria-label={t("ui.transfer.completeProjectLink")}
        title={t("ui.transfer.copyProjectLink")}
        on:click={() => {
          void copySharedLink();
        }}>{shareLinkDialog.url}</button
      >
      <p class="share-link-expiry">
        {t("ui.transfer.thisProjectWillBeDeletedAfter30Days")}
      </p>
      <div class="dialog-actions">
        <button on:click={() => (shareLinkDialog = null)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
