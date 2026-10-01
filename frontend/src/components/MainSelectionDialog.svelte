<script lang="ts">
  import { focusOnMount, containClicks } from "../uiActions";

  import type { MainDialog } from "../uiTypes";
  export let mainDialog: MainDialog | null;
  export let mainEntries: string[];
  export let chooseMain: (fileName: string) => Promise<void>;
</script>

{#if mainDialog}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog main-selection-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="main-selection-title"
      tabindex="-1"
      use:containClicks
    >
      <h2 id="main-selection-title">Choose main</h2>
      <p>
        {mainDialog.action === "export"
          ? "Which main() should the exported HTML file start?"
          : `Which main() should ${mainDialog.action === "reset" ? "Reset" : "Start main"} run?`}
      </p>
      <div class="toolbar-dialog-options main-selection-options">
        {#each mainEntries as fileName, index}
          <button
            class="toolbar-dialog-option"
            on:click={() => void chooseMain(fileName)}
            use:focusOnMount={index === 0}>{fileName} — main()</button
          >
        {/each}
      </div>
      <div class="dialog-actions">
        <button on:click={() => (mainDialog = null)}>Cancel</button>
      </div>
    </div>
  </div>{/if}
