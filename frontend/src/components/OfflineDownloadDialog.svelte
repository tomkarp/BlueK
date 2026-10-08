<script lang="ts">
  import { containClicks } from "../uiActions";
  export let open: boolean;
  export let downloadUrl: string;
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
      <h3 id="offline-download-title">BlueK Offline</h3>
      <p>
        You can use BlueK online without downloading anything. This version is
        for working without an internet connection.
      </p>
      <ol>
        <li>Download and extract the ZIP file.</li>
        <li>
          Open <strong>BlueK.html</strong> in a recent browser. No installation is
          needed.
        </li>
        <li>
          Save your projects with <strong
            >Save / Export → Export Project JSON</strong
          >, and import them to continue elsewhere.
        </li>
      </ol>
      <p class="offline-download-note">
        Autosave depends on your browser and the location of BlueK.html. Moving
        the file may make earlier autosaves unavailable. Short project links
        require the online version.
      </p>
      <div class="offline-download-caution">
        <p>
          The offline version has not yet been widely tested in practice. Test it
          with your own projects and browser before relying on it.
        </p>
        <p>
          <a
            class="offline-download-report"
            href="https://github.com/tomkarp/BlueK/issues/new"
            target="_blank"
            rel="noopener noreferrer">Report a bug on GitHub</a
          > (internet connection required).
        </p>
      </div>
      <div class="dialog-actions">
        <button on:click={() => (open = false)}>Cancel</button>
        <a
          class="offline-download-action"
          href={downloadUrl}
          download="BlueK-offline.zip"
          on:click={() => (open = false)}>Download ZIP</a
        >
      </div>
    </div>
  </div>
{/if}
