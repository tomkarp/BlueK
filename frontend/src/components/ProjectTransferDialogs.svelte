<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  import CloudProjectPanel from "./CloudProjectPanel.svelte";
  import ProgramExportOptions from "./ProgramExportOptions.svelte";
  import type { CloudWorkspace } from "../workspace/CloudWorkspace.svelte";
  import { containClicks, focusOnMount } from "../uiActions";

  import type { BlueJProjectChoice } from "../blueJImport";
  import type { ProjectFile } from "../../../runtime-contract/src/index";

  import type { ShareLinkDialog } from "../uiTypes";
  // A compile-time condition also removes server-only controls from offline JS.
  const serverFeatures = import.meta.env.VITE_BLUEK_OFFLINE !== "1";
  function formatShareCode(code: string) {
    return /^[a-z0-9]{12}$/i.test(code)
      ? (code.match(/.{4}/g)?.join(" ") ?? code)
      : code;
  }
  let saveView: "choices" | "account" | "html" = $state("choices");
  let openSource: "account" | "computer" | "link" = $state("computer");
  function selectOpenSource(source: typeof openSource) {
    openSource = source;
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
  function showPrivateSave() {
    saveView = "account";
    void cloud.refresh();
  }
  function openProjectManagement() {
    toolbarDialog = null;
    void cloud.show("manage");
  }
  let selectedBlueJRoot = $state("");
  interface Props {
    cloud: CloudWorkspace;
    showNotice: (text: string) => void;
    toolbarDialog: "open" | "save" | "share" | null;
    shareLinkDialog: ShareLinkDialog | null;
    shareCodeInput: string;
    shareCodeError: string;
    shareWithReadme: boolean;
    shareWithState: boolean;
    canShareState: boolean;
    defaultTestClass: string;
    readme: string;
    files: ProjectFile[];
    htmlExportBlocked: boolean;
    htmlExporting: boolean;
    programAllowDownload: boolean;
    programAllowBlueK: boolean;
    programShowProjectName: boolean;
    bluePlay: boolean;
    ensureProjectName: () => Promise<boolean>;
    programAutoRun: boolean;
    programShowControls: boolean;
    programShowSpeed: boolean;
    shareShortProgram: () => Promise<void>;
    openProjectDrop: (event: DragEvent) => Promise<void>;
    blueJImportChoice: {
      projects: BlueJProjectChoice[];
      name: string;
    } | null;
    chooseBlueJProject: (root: string) => Promise<void>;
    importProject: (event: Event) => Promise<void>;
    loadSharedProjectFromCode: () => Promise<void>;
    saveShortProject: () => Promise<void>;
    exportProject: () => Promise<void>;
    markProjectSaved: () => void;
    exportBlueJProject: () => Promise<void>;
    exportHtml: () => Promise<void>;
    copySharedLink: () => Promise<void>;
  }

  let {
    cloud,
    showNotice,
    toolbarDialog = $bindable(),
    shareLinkDialog = $bindable(),
    shareCodeInput = $bindable(),
    shareCodeError,
    shareWithReadme = $bindable(),
    shareWithState = $bindable(),
    canShareState,
    defaultTestClass,
    readme,
    files,
    htmlExportBlocked,
    htmlExporting,
    programAllowDownload = $bindable(),
    programAllowBlueK = $bindable(),
    programShowProjectName = $bindable(),
    bluePlay,
    ensureProjectName,
    programAutoRun = $bindable(),
    programShowControls = $bindable(),
    programShowSpeed = $bindable(),
    shareShortProgram,
    openProjectDrop,
    blueJImportChoice = $bindable(),
    chooseBlueJProject,
    importProject,
    loadSharedProjectFromCode,
    saveShortProject,
    exportProject,
    markProjectSaved,
    exportBlueJProject,
    exportHtml,
    copySharedLink,
  }: Props = $props();
  const t = language.t;
  $effect(() => {
    if (!programAutoRun) programShowControls = true;
  });
  $effect(() => {
    if (toolbarDialog === null) {
      saveView = "choices";
      openSource = "computer";
    }
  });
  $effect(() => {
    if (blueJImportChoice)
      selectedBlueJRoot = blueJImportChoice.projects[0].root;
  });
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
        {#if serverFeatures}<div
          class="open-source-tabs"
          role="tablist"
          tabindex="-1"
          aria-label={t("ui.transfer.openFrom")}
          onkeydown={handleOpenSourceKeydown}
        >
          <button
            id="open-source-computer"
            role="tab"
            aria-selected={openSource === "computer"}
            tabindex={openSource === "computer" ? 0 : -1}
            aria-controls="open-panel-computer"
            onclick={() => selectOpenSource("computer")}
            >{t("ui.transfer.sourceComputer")}</button
          >
          {#if serverFeatures}<button
              id="open-source-account"
              role="tab"
              aria-selected={openSource === "account"}
              tabindex={openSource === "account" ? 0 : -1}
              aria-controls="open-panel-account"
              onclick={() => selectOpenSource("account")}
              >{t("ui.transfer.sourceAccount")}</button
            >{/if}
          {#if serverFeatures}<button
              id="open-source-link"
              role="tab"
              aria-selected={openSource === "link"}
              tabindex={openSource === "link" ? 0 : -1}
              aria-controls="open-panel-link"
              onclick={() => selectOpenSource("link")}
              >{t("ui.transfer.sourceLink")}</button
            >{/if}
        </div>{/if}
        {#if openSource === "account"}<div
            class="open-source-panel open-account-panel"
            role="tabpanel"
            tabindex="0"
            id="open-panel-account"
            aria-labelledby="open-source-account"
          >
            <CloudProjectPanel
              {cloud}
              mode="open"
              onLoaded={() => {
                toolbarDialog = null;
              }}
              onManage={openProjectManagement}
              {exportProject}
            />
          </div>{:else if openSource === "computer"}<div
            class="open-source-panel"
            role="tabpanel"
            tabindex="0"
            id="open-panel-computer"
            aria-labelledby="open-source-computer"
          >
            <h4>{t("ui.transfer.fromComputer")}</h4>
            <label
              class="project-dropzone"
              ondragover={(event) => event.preventDefault()}
              ondrop={openProjectDrop}
            >
              <strong>{t("ui.transfer.projectFileFormats")}</strong>
              <span>{t("ui.transfer.acceptedProjectFormats")}</span>
              <input
                type="file"
                aria-label={t("ui.transfer.chooseProjectFile")}
                accept=".bluek,.json,application/json,.zip,application/zip"
                onchange={(event) => {
                  importProject(event);
                  toolbarDialog = null;
                }}
              />
            </label>
            <p class="global-project-drop-tip">
              {t("ui.transfer.globalProjectDropTip")}
            </p>
          </div>{:else}<div
            class="open-source-panel shared-project-loader"
            role="tabpanel"
            tabindex="0"
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
                onkeydown={(event) =>
                  event.key === "Enter" && loadSharedProjectFromCode()}
              />
            </label>
            <button
              class="shared-project-load"
              disabled={!shareCodeInput.trim()}
              onclick={loadSharedProjectFromCode}
              >{t("ui.transfer.loadProject")}</button
            >
            {#if shareCodeError}<div class="dialog-error" role="alert">
                {$language.message(shareCodeError)}
              </div>{/if}
          </div>{/if}
      </div>
      <div class="dialog-actions">
        <button onclick={() => (toolbarDialog = null)}
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
                onclick={async () => {
                  if (!(await ensureProjectName())) return;
                  await exportProject();
                  toolbarDialog = null;
                }}
                ><strong>{t("ui.common.exportProjectJSON")}</strong><span
                  >{t("ui.transfer.exportTheCompleteBlueKProjectAsJSON")}</span
                ></button
              >
              {#if serverFeatures}<button onclick={showPrivateSave}
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
                onclick={async () => {
                  if (!(await ensureProjectName())) return;
                  await exportBlueJProject();
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
                onclick={async () => {
                  if (!(await ensureProjectName())) return;
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
              onLoaded={() => {
                toolbarDialog = null;
              }}
              onSaved={() => {
                markProjectSaved();
                toolbarDialog = null;
                showNotice(t("ui.cloud.saved"));
              }}
              onManage={openProjectManagement}
              {exportProject}
            />
          {:else if saveView === "html"}
            <h4>{t("ui.transfer.htmlFile")}</h4>
            <div class="program-export-layout">
              <ProgramExportOptions
                bind:programShowProjectName
                bind:programAllowDownload
                bind:programAllowBlueK
                bind:programAutoRun
                bind:programShowControls
                bind:programShowSpeed
                {bluePlay}
              />
              <div class="project-choice-list program-export-choices">
                <button
                  class="file-export-choice"
                  disabled={!files.length || htmlExportBlocked || htmlExporting}
                  onclick={async () => {
                    if (!(await ensureProjectName())) return;
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
            </div>
          {/if}
        {:else if serverFeatures}
          <div class="share-action-section">
            <h4>{t("ui.transfer.shareForEditing")}</h4>
            <p class="export-mode-description">
              {t("ui.transfer.projectViewDescription")}
            </p>
            <div class="project-choice-list toolbar-project-choice-list">
              {#if readme.trim() || canShareState}<fieldset
                  class="share-link-options single-link project-share-options"
                  aria-labelledby="link-options-label"
                >
                  <legend id="link-options-label"
                    >{t("ui.transfer.whenOpeningALink")}</legend
                  >
                  {#if readme.trim()}<label
                      class="share-link-option"
                      title={t("ui.transfer.showREADMEMdRightAwayWhenThisLink")}
                      ><input
                        type="checkbox"
                        aria-label={t("ui.transfer.openREADMEMdWithTheLink")}
                        bind:checked={shareWithReadme}
                      /><span>{t("ui.transfer.openREADME")}</span></label
                    >{/if}
                  {#if canShareState}<label
                      class="share-link-option"
                      title={t("ui.transfer.loadStateFrom0IntoTheObjectBench", [
                        defaultTestClass,
                      ])}
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
                onclick={() => {
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
                  forLinks
                />
              </details>
              {#if htmlExportBlocked}<p class="program-source-note">
                  {t("ui.transfer.programNeedsMain")}
                </p>{/if}
              <div class="project-choice-list program-export-choices">
                <button
                  class="share-publish-button"
                  disabled={!files.length || htmlExportBlocked || htmlExporting}
                  onclick={() => {
                    toolbarDialog = null;
                    void shareShortProgram();
                  }}
                  ><strong>{t("ui.transfer.copyShortProgramLink")}</strong
                  ></button
                >
              </div>
            </div>
          </div>
        {/if}
      </div>
      <div class="dialog-actions">
        {#if toolbarDialog === "save" && saveView !== "choices"}<button
            onclick={() => (saveView = "choices")}
            >{t("ui.transfer.back")}</button
          >{/if}
        <button onclick={() => (toolbarDialog = null)}
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
        onclick={() => {
          void copySharedLink();
        }}>{formatShareCode(shareLinkDialog.code)}</button
      >
      <p class="share-link-full-label">{t("ui.transfer.completeLink")}</p>
      <button
        class="share-link-value"
        aria-label={t("ui.transfer.completeProjectLink")}
        title={t("ui.transfer.copyProjectLink")}
        onclick={() => {
          void copySharedLink();
        }}>{shareLinkDialog.url}</button
      >
      <p class="share-link-expiry">
        {t("ui.transfer.publicCopyExpiry", [
          String(shareLinkDialog.expiresInDays ?? 7),
        ])}
      </p>
      <div class="dialog-actions">
        <button onclick={() => (shareLinkDialog = null)}
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
        <button onclick={() => (blueJImportChoice = null)}
          >{t("ui.common.cancel")}</button
        >
        <button onclick={() => chooseBlueJProject(selectedBlueJRoot)}
          >{t("ui.transfer.openSelectedBlueJProject")}</button
        >
      </div>
    </div>
  </div>
{/if}
