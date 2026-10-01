<script lang="ts">
  import { containClicks } from "../uiActions";

  import type { ProjectFile } from "../../../runtime-contract/src/index";

  import type { ShareLinkDialog } from "../uiTypes";
  export let toolbarDialog: "open" | "save" | null;
  export let shareLinkDialog: ShareLinkDialog | null;
  // A compile-time condition also removes server-only controls from offline JS.
  const serverFeatures = import.meta.env.VITE_BLUEK_OFFLINE !== "1";
  export let shareCodeInput: string;
  export let shareCodeError: string;
  export let shareWithReadme: boolean;
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
      class="dialog toolbar-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="open-import-title"
      use:containClicks
    >
      <h3 id="open-import-title">Open / Import</h3>
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
        <!-- Only a link carries it: a file is opened, a link is followed, and
               what it opens with is what the sender ticked here — in the box of
               the link it belongs to. -->
        <div class="project-choice-row">
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
          <label
            class="share-readme-option"
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
        </div>
        {#if serverFeatures}<div class="project-choice-row">
            <button
              on:click={() => {
                void saveShortProject();
                toolbarDialog = null;
              }}
              disabled={!files.length}
              ><strong>Copy Short Link</strong><span
                >Save the project for 30 days and copy a short link.</span
              ></button
            >
            <label
              class="share-readme-option"
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
          </div>{/if}
        <button
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
        <button disabled
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
{#if shareLinkDialog}<div class="modal" role="presentation">
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
