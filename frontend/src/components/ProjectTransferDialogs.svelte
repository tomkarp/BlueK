<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import CloudProjectPanel from "./CloudProjectPanel.svelte";
  import ProgramExportOptions from "./ProgramExportOptions.svelte";
  import type { CloudWorkspace } from "../workspace/CloudWorkspace.svelte";
  import { containClicks, focusOnMount } from "../uiActions";

  import type { BlueJProjectChoice } from "../blueJImport";
  import type { ProjectFile } from "../../../runtime-contract/src/index";

  import type { ShareLinkDialog } from "../uiTypes";
  import type { ProjectDraftSummary } from "../projectDraftStorage";
  export let cloud: CloudWorkspace;
  export let projectName: string;
  export let serverProjectBytes = 0;
  export let recentProjects: ProjectDraftSummary[];
  export let openRecentProject: (id: string) => Promise<void>;
  export let deleteRecentProject: (id: string) => void;
  export let deleteAllRecentProjects: () => void;
  export let toolbarDialog: "open" | "save" | "share" | null;
  export let shareLinkDialog: ShareLinkDialog | null;
  // A compile-time condition also removes server-only controls from offline JS.
  const serverFeatures = import.meta.env.VITE_BLUEK_OFFLINE !== "1";
  function formatShareCode(code: string) {
    return /^[a-z0-9]{12}$/i.test(code)
      ? (code.match(/.{4}/g)?.join(" ") ?? code)
      : code;
  }
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
  export let programAllowDownload: boolean;
  export let programAllowBlueK: boolean;
  export let programShowProjectName: boolean;
  export let bluePlay: boolean;
  export let ensureProjectName: () => boolean;
  export let programAutoRun: boolean;
  export let programShowControls: boolean;
  export let programShowSpeed: boolean;
  $: if (!programAutoRun) programShowControls = true;
  export let shareShortProgram: () => Promise<void>;
  let saveView: "choices" | "account" | "html" = "choices";
  let openSource: "browser" | "account" | "computer" | "link" = "computer";
  let showAllRecoveryDrafts = false;
  function selectOpenSource(source: typeof openSource) {
    openSource = source;
    if (source === "browser") showAllRecoveryDrafts = false;
    if (source === "account") void cloud.refresh(true);
  }
  function handleOpenSourceKeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tabs = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      ),
    );
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || tabs.length < 2) return;
    event.preventDefault();
    const next =
      tabs[
        (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length
      ];
    next.focus();
    next.click();
  }
  $: if (toolbarDialog === null) {
    saveView = "choices";
    openSource = recentProjects.length ? "browser" : "computer";
    showAllRecoveryDrafts = false;
  }
  function showPrivateSave() {
    saveView = "account";
    void cloud.refresh(true);
  }
  export let openProjectDrop: (event: DragEvent) => Promise<void>;
  export let blueJImportChoice: {
    projects: BlueJProjectChoice[];
    name: string;
  } | null;
  export let chooseBlueJProject: (root: string) => Promise<void>;
  let selectedBlueJRoot = "";
  $: if (blueJImportChoice)
    selectedBlueJRoot = blueJImportChoice.projects[0].root;
  export let importProject: (event: Event) => Promise<void>;
  export let loadSharedProjectFromCode: () => Promise<void>;
  export let saveShortProject: () => Promise<void>;
  export let exportProject: () => void;
  export let exportBlueJProject: () => void;
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
        <div
          class="open-source-tabs"
          role="tablist"
          aria-label={t("ui.transfer.openFrom")}
          on:keydown={handleOpenSourceKeydown}
        >
          {#if serverFeatures}<button
              id="open-source-account"
              role="tab"
              aria-selected={openSource === "account"}
              tabindex={openSource === "account" ? 0 : -1}
              aria-controls="open-panel-account"
              on:click={() => selectOpenSource("account")}
              >{t("ui.transfer.sourceAccount")}</button
            >{/if}
          <button
            id="open-source-computer"
            role="tab"
            aria-selected={openSource === "computer"}
            tabindex={openSource === "computer" ? 0 : -1}
            aria-controls="open-panel-computer"
            on:click={() => selectOpenSource("computer")}
            >{t("ui.transfer.sourceComputer")}</button
          >
          {#if serverFeatures}<button
              id="open-source-link"
              role="tab"
              aria-selected={openSource === "link"}
              tabindex={openSource === "link" ? 0 : -1}
              aria-controls="open-panel-link"
              on:click={() => selectOpenSource("link")}
              >{t("ui.transfer.sourceLink")}</button
            >{/if}
          <button
            id="open-source-browser"
            role="tab"
            aria-selected={openSource === "browser"}
            tabindex={openSource === "browser" ? 0 : -1}
            aria-controls="open-panel-browser"
            on:click={() => selectOpenSource("browser")}
            >{t("ui.transfer.sourceBrowser")}
            {#if recentProjects.length}<span class="open-source-count"
                >{recentProjects.length}</span
              >{/if}</button
          >
        </div>
        {#if openSource === "browser"}<section
            class="open-source-panel recent-projects"
            role="tabpanel"
            id="open-panel-browser"
            aria-labelledby="open-source-browser"
          >
            <div class="recent-projects-heading">
              <div>
                <h4>{t("ui.transfer.browserRecovery")}</h4>
                <p>{t("ui.transfer.savedInThisBrowserChooseAProjectTo")}</p>
              </div>
              {#if recentProjects.length}<button
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
                </button>{/if}
            </div>
            {#if recentProjects.length}<div class="recent-project-list">
                {#each showAllRecoveryDrafts
                  ? recentProjects
                  : recentProjects.slice(0, 3) as project (project.id)}
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
                      title={t("ui.transfer.deleteSavedProject0", [
                        project.name,
                      ])}
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
              {#if recentProjects.length > 3}<button
                  class="recovery-drafts-toggle"
                  aria-expanded={showAllRecoveryDrafts}
                  on:click={() => (showAllRecoveryDrafts = !showAllRecoveryDrafts)}
                  >{showAllRecoveryDrafts
                    ? t("ui.transfer.showFewerRecoveryDrafts")
                    : t("ui.transfer.showMoreRecoveryDrafts", [
                        recentProjects.length - 3,
                      ])}</button
                >{/if}{:else}<p class="open-source-empty">
                {t("ui.transfer.noBrowserProjects")}
              </p>{/if}
          </section>{:else if openSource === "account"}<section
            class="open-source-panel"
            role="tabpanel"
            id="open-panel-account"
            aria-labelledby="open-source-account"
          >
            <CloudProjectPanel
              {cloud}
              mode="open"
              onLoaded={() => {
                toolbarDialog = null;
              }}
              {exportProject}
            />
          </section>{:else if openSource === "computer"}<section
            class="open-source-panel"
            role="tabpanel"
            id="open-panel-computer"
            aria-labelledby="open-source-computer"
          >
            <h4>{t("ui.transfer.fromComputer")}</h4>
            <p>{t("ui.transfer.dropAProjectFileHereOrClickTo")}</p>
            <label
              class="project-dropzone"
              on:dragover|preventDefault
              on:drop={openProjectDrop}
            >
              <strong>{t("ui.transfer.projectFileFormats")}</strong>
              <span>{t("ui.transfer.acceptedProjectFormats")}</span>
              <input
                type="file"
                aria-label={t("ui.transfer.chooseProjectFile")}
                accept=".json,.bluek.json,application/json,.zip,application/zip"
                on:change={(event) => {
                  importProject(event);
                  toolbarDialog = null;
                }}
              />
            </label>
          </section>{:else}<section
            class="open-source-panel shared-project-loader"
            role="tabpanel"
            id="open-panel-link"
            aria-labelledby="open-source-link"
          >
            <h4>{t("ui.transfer.loadSharedProject")}</h4>
            <p>{t("ui.transfer.sharedProjectCodeHint")}</p>
            <label>
              <span>{t("ui.transfer.threeWords")}</span>
              <input
                aria-label={t("ui.transfer.threeWordProjectCode")}
                bind:value={shareCodeInput}
                placeholder="7m4k r9wp 3x6d"
                autocapitalize="none"
                autocomplete="off"
                spellcheck="false"
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
                {$language.message(shareCodeError)}
              </div>{/if}
          </section>{/if}
      </div>
      <div class="dialog-actions">
        <button on:click={() => (toolbarDialog = null)}
          >{t("ui.common.cancel")}</button
        >
      </div>
    </div>
  </div>{/if}

{#if toolbarDialog === "save" || toolbarDialog === "share"}
  <div class="modal topmost-modal" role="presentation">
    <div
      class="dialog toolbar-dialog save-export-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="save-export-title"
      use:containClicks
    >
      <h3 id="save-export-title">
        {t(
          toolbarDialog === "save"
            ? "ui.common.saveExport"
            : "ui.transfer.share",
        )}
      </h3>
      <div class="export-dialog-content">
        {#if toolbarDialog === "save"}
          {#if saveView === "choices"}
            <div class="project-choice-list">
              <button
                class="file-export-choice"
                disabled={!files.length}
                on:click={() => {
                  if (!ensureProjectName()) return;
                  exportProject();
                  toolbarDialog = null;
                }}
                ><strong>{t("ui.common.exportProjectJSON")}</strong><span
                  >{t("ui.transfer.exportTheCompleteBlueKProjectAsJSON")}</span
                ></button
              >
              {#if serverFeatures}<button on:click={showPrivateSave}
                  ><strong>{t("ui.transfer.saveInAccount")}</strong><span
                    >{t("ui.transfer.privateSaveDescription")}</span
                  ></button
                >{/if}
            </div>
            <h4>{t("ui.transfer.otherFormats")}</h4>
            <div class="project-choice-list">
              <button
                class="file-export-choice"
                disabled={!files.length}
                on:click={() => {
                  if (!ensureProjectName()) return;
                  exportBlueJProject();
                  toolbarDialog = null;
                }}
                ><strong>{t("ui.transfer.exportBlueJProjectZip")}</strong><span
                  >{t("ui.transfer.exportAZIPForBlueJ")}</span
                ></button
              >
              <button
                class="file-export-choice"
                aria-label={t("ui.transfer.htmlFile")}
                disabled={!files.length}
                on:click={() => {
                    if (!ensureProjectName()) return;
                  saveView = "html";
                }}
                ><strong>{t("ui.transfer.htmlFile")}</strong><span
                  >{t("ui.transfer.aSingleWebPageThatRunsTheProgram")}</span
                ></button
              >
            </div>
          {:else if saveView === "account" && serverFeatures}
            <h4>{t("ui.transfer.saveInAccount")}</h4>
            <CloudProjectPanel
              {cloud}
              mode="save"
              bind:projectName
              onLoaded={() => {
                toolbarDialog = null;
              }}
              {exportProject}
            />
          {:else if saveView === "html"}
            <h4>{t("ui.transfer.htmlFile")}</h4>
            <div class="program-export-layout">
              <div class="project-choice-list program-export-choices">
                <button
                  class="file-export-choice"
                  disabled={!files.length || htmlExportBlocked || htmlExporting}
                  on:click={() => {
                    if (!ensureProjectName()) return;
                    toolbarDialog = null;
                    void exportHtml();
                  }}
                  ><strong>{t("ui.common.exportAsHTML")}</strong><span
                    >{htmlExportBlocked
                      ? t("ui.transfer.needsAFileWithAParameterlessMain")
                      : t("ui.transfer.aSingleWebPageThatRunsTheProgram")}</span
                  ></button
                >
                {#if htmlExportBlocked}<p class="program-source-note">
                    {t("ui.transfer.programNeedsMain")}
                  </p>{/if}
              </div>
              <details class="program-settings">
                <summary>{t("ui.transfer.programSettings")}</summary>
                <ProgramExportOptions
                  bind:programShowProjectName
                  bind:programAllowDownload
                  bind:programAllowBlueK
                  bind:programAutoRun
                  bind:programShowControls
                  bind:programShowSpeed
                  {bluePlay}
                />
              </details>
            </div>
          {/if}
        {:else if serverFeatures}
          <p class="transfer-publication-summary">
            {t("ui.transfer.publicCopy")}
          </p>
          <div class="share-action-section">
            <h4>{t("ui.transfer.shareForEditing")}</h4>
            <p class="export-mode-description">
              {t("ui.transfer.projectViewDescription")}
            </p>
            <div class="project-choice-list toolbar-project-choice-list">
              {#if readme.trim() || canShareState}<fieldset
                  class="share-link-options single-link project-share-options"
                  role="group"
                  aria-labelledby="link-options-label"
                >
                  <legend id="link-options-label"
                    >{t("ui.transfer.whenOpeningALink")}</legend
                  >
                  {#if readme.trim()}<label class="share-link-option"
                      title={t(
                        "ui.transfer.showREADMEMdRightAwayWhenThisLink",
                      )}
                      ><input
                        type="checkbox"
                        aria-label={t("ui.transfer.openREADMEMdWithTheLink")}
                        bind:checked={shareWithReadme}
                      /><span>{t("ui.transfer.openREADME")}</span></label
                    >{/if}
                  {#if canShareState}<label class="share-link-option"
                      title={t(
                        "ui.transfer.loadStateFrom0IntoTheObjectBench",
                        [defaultTestClass],
                      )}
                      ><input
                        type="checkbox"
                        aria-label={t(
                          "ui.transfer.loadDefaultTestClassStateWithTheLink",
                        )}
                        bind:checked={shareWithState}
                      /><span>{t("ui.common.loadState")}</span></label
                    >{/if}
                </fieldset>{/if}
              <button
                class="share-publish-button"
                disabled={!files.length}
                on:click={() => {
                  void saveShortProject();
                  toolbarDialog = null;
                }}><strong>{t("ui.transfer.createProjectLink")}</strong></button
              >
            </div>
          </div>
          <div class="share-action-section">
            <h4>{t("ui.transfer.shareForRunning")}</h4>
            <p class="export-mode-description">
              {t("ui.transfer.shortProgramLinkDescription")}
            </p>
            <div class="program-export-layout">
              <details class="program-settings">
                <summary>{t("ui.transfer.programSettings")}</summary>
                <ProgramExportOptions
                  bind:programShowProjectName
                  bind:programAllowDownload
                  bind:programAllowBlueK
                  bind:programAutoRun
                  bind:programShowControls
                  bind:programShowSpeed
                  {bluePlay}
                />
              </details>
              {#if htmlExportBlocked}<p class="program-source-note">
                  {t("ui.transfer.programNeedsMain")}
                </p>{/if}
              <div class="project-choice-list program-export-choices">
                <button
                  class="share-publish-button"
                  disabled={!files.length || htmlExportBlocked || htmlExporting}
                  on:click={() => {
                    toolbarDialog = null;
                    void shareShortProgram();
                  }}
                  ><strong>{t("ui.transfer.copyShortProgramLink")}</strong
                  ></button
                >
              </div>
            </div>
          </div>
          <details class="transfer-details">
            <summary>{t("ui.transfer.publicationDetails")}</summary>
            <p>{t("ui.cloud.publicationAdvice")}</p>
            <p>
              {t("ui.cloud.size", [
                serverProjectBytes.toLocaleString($language.locale),
              ])}
            </p>
          </details>
        {/if}
      </div>
      <div class="dialog-actions">
        {#if toolbarDialog === "save" && saveView !== "choices"}<button
            on:click={() => (saveView = "choices")}
            >{t("ui.transfer.back")}</button
          >{/if}
        <button on:click={() => (toolbarDialog = null)}
          >{t("ui.common.cancel")}</button
        >
      </div>
    </div>
  </div>
{/if}
{#if shareLinkDialog}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog share-link-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="share-link-title"
      use:containClicks
    >
      <h3 id="share-link-title">
        {t(
          shareLinkDialog.program
            ? "ui.transfer.shortProgramLink"
            : "ui.transfer.shortProjectLink",
        )}
      </h3>
      <p>
        {shareLinkDialog.program
          ? t("ui.transfer.shortProgramReady")
          : shareLinkDialog.copied
            ? t("ui.transfer.theLinkWasCopiedToTheClipboardWrite")
            : t("ui.transfer.writeDownTheseThreeWords")}
      </p>
      <button
        class="share-link-code"
        aria-label={t("ui.transfer.threeWordProjectCode")}
        title={t("ui.transfer.copyProjectLink")}
        on:click={() => {
          void copySharedLink();
        }}>{formatShareCode(shareLinkDialog.code)}</button
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

{#if blueJImportChoice}
  <div class="modal topmost-modal" role="presentation">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="bluej-project-choice-title"
      use:containClicks
    >
      <h3 id="bluej-project-choice-title">
        {t("ui.transfer.chooseBlueJProject")}
      </h3>
      <p>{t("ui.transfer.severalBlueJProjects", [blueJImportChoice.name])}</p>
      <label
        >{t("ui.transfer.blueJProject")}
        <select
          use:focusOnMount
          aria-label={t("ui.transfer.blueJProject")}
          bind:value={selectedBlueJRoot}
          style="max-width:100%"
        >
          {#each blueJImportChoice.projects as project}
            <option value={project.root}>{project.label}</option>
          {/each}
        </select>
      </label>
      <div class="dialog-actions">
        <button on:click={() => (blueJImportChoice = null)}
          >{t("ui.common.cancel")}</button
        >
        <button on:click={() => chooseBlueJProject(selectedBlueJRoot)}
          >{t("ui.transfer.openSelectedBlueJProject")}</button
        >
      </div>
    </div>
  </div>
{/if}
