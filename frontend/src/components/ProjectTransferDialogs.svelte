<script lang="ts">
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
      <h3 id="open-import-title">Open / Import</h3>
      <div class="open-project-content">
        {#if recentProjects.length}
          <section class="recent-projects" aria-labelledby="recent-work-title">
            <div class="recent-projects-heading">
              <h4 id="recent-work-title">Recent work</h4>
              <button
                class="delete-all-projects"
                aria-label="Delete all saved projects"
                on:click={deleteAllRecentProjects}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"
                  ><path
                    d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"
                  /></svg
                >
                <span>Delete all</span>
              </button>
            </div>
            <p>Saved in this browser. Choose a project to continue.</p>
            <div class="recent-project-list">
              {#each recentProjects as project (project.id)}
                <div class="recent-project-row">
                  <button
                    class="recent-project"
                    on:click={() => void openRecentProject(project.id)}
                  >
                    <strong>{project.name}</strong>
                    <span
                      >{project.fileCount}
                      {project.fileCount === 1 ? "file" : "files"} · Last saved {new Date(
                        project.updatedAt,
                      ).toLocaleString("en-GB")}</span
                    >
                  </button>
                  <button
                    class="delete-recent-project"
                    aria-label={`Delete saved project ${project.name}`}
                    title={`Delete saved project ${project.name}`}
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
        <p>Drop a project file here, or click to choose one.</p>
        <label
          class="project-dropzone"
          on:dragover|preventDefault
          on:drop={openProjectDrop}
        >
          <strong>JSON</strong>
          <span>Accepted: .json</span>
          <input
            type="file"
            aria-label="Choose project file"
            accept=".json,.bluek.json,application/json"
            on:change={(event) => {
              importProject(event);
              toolbarDialog = null;
            }}
          />
        </label>
        {#if serverFeatures}<div class="shared-project-loader">
            <strong>Load shared project</strong>
            <label>
              <span>Three words</span>
              <input
                aria-label="Three-word project code"
                bind:value={shareCodeInput}
                placeholder="green-lamp-river"
                on:keydown={(event) =>
                  event.key === "Enter" && loadSharedProjectFromCode()}
              />
            </label>
            <button
              class="shared-project-load"
              disabled={!shareCodeInput.trim()}
              on:click={loadSharedProjectFromCode}>Load project</button
            >
            {#if shareCodeError}<div class="dialog-error" role="alert">
                {shareCodeError}
              </div>{/if}
          </div>{/if}
      </div>
      <div class="dialog-actions">
        <button on:click={() => (toolbarDialog = null)}>Cancel</button>
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
      <h3 id="save-export-title">Save / Export</h3>
      <p>Choose how to save or share this project:</p>
      <div class="project-choice-list toolbar-project-choice-list">
        <button
          on:click={() => {
            shareProject();
            toolbarDialog = null;
          }}
          disabled={!files.length}
          ><strong>Copy Full Project Link</strong><span
            >Share the complete project encoded in the URL.</span
          ></button
        >
        {#if serverFeatures}<button
            on:click={() => {
              void saveShortProject();
              toolbarDialog = null;
            }}
            disabled={!files.length}
            ><strong>Copy Short Link</strong><span
              >Save the project for 30 days and copy a short link.</span
            ></button
          >{/if}
        <div
          class="share-link-options"
          class:single-link={!serverFeatures}
          role="group"
          aria-labelledby="link-options-label"
        >
          <span id="link-options-label">When opening a link:</span>
          <label
            class="share-link-option"
            class:disabled={!readme.trim()}
            title={readme.trim()
              ? "Show README.md right away when this link is opened"
              : "The README is still empty — there is nothing to show"}
            ><input
              type="checkbox"
              aria-label="Open README.md with the link"
              bind:checked={shareWithReadme}
              disabled={!readme.trim()}
            /><span>Open README</span></label
          >
          <label
            class="share-link-option"
            class:disabled={!canShareState}
            title={canShareState
              ? `Load state from ${defaultTestClass} into the object bench when this link is opened`
              : "Choose a default test class first"}
            ><input
              type="checkbox"
              aria-label="Load default test class state with the link"
              bind:checked={shareWithState}
              disabled={!canShareState}
            /><span>Load state</span></label
          >
        </div>
        <button
          class="file-export-choice"
          on:click={() => {
            exportProject();
            toolbarDialog = null;
          }}
          disabled={!files.length}
          ><strong>Export Project JSON</strong><span
            >Export the complete BlueK project as JSON.</span
          ></button
        >
        <button
          class="file-export-choice"
          on:click={() => {
            toolbarDialog = null;
            void exportHtml();
          }}
          disabled={!files.length || htmlExportBlocked || htmlExporting}
          ><strong>Export as HTML (Beta)</strong><span
            >{htmlExportBlocked
              ? "Needs a file with a parameterless main()."
              : "A single web page that runs the program, without BlueK."}</span
          ></button
        >
        <button class="file-export-choice" disabled
          ><strong>Export BlueJ Project (.zip)</strong><span
            >Export for BlueJ (not implemented yet).</span
          ></button
        >
      </div>
      <div class="dialog-actions">
        <button on:click={() => (toolbarDialog = null)}>Cancel</button>
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
      <h3 id="share-link-title">Short project link</h3>
      <p>
        {shareLinkDialog.copied
          ? "The link was copied to the clipboard. Write down these three words:"
          : "Write down these three words:"}
      </p>
      <button
        class="share-link-code"
        aria-label="Three-word project code"
        title="Copy project link"
        on:click={() => {
          void copySharedLink();
        }}>{shareLinkDialog.code}</button
      >
      <p class="share-link-full-label">Complete link:</p>
      <button
        class="share-link-value"
        aria-label="Complete project link"
        title="Copy project link"
        on:click={() => {
          void copySharedLink();
        }}>{shareLinkDialog.url}</button
      >
      <p class="share-link-expiry">
        This project will be deleted after 30 days.
      </p>
      <div class="dialog-actions">
        <button on:click={() => (shareLinkDialog = null)}>Close</button>
      </div>
    </div>
  </div>{/if}
