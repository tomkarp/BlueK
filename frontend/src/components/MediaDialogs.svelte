<script lang="ts">
  import { containClicks } from "../uiActions";

  import { standardImages } from "../standardImages";
  export let imageLibraryOpen: boolean;
  export let libraryId: string;
  export let mediaNotice: string;
</script>

{#if imageLibraryOpen && libraryId === "blueplay"}<div
    class="modal topmost-modal"
    role="presentation"
  >
    <div
      class="dialog image-library-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="images-title"
      use:containClicks
    >
      <h3 id="images-title">Images</h3>
      <div class="standard-image-grid">
        <button
          class="standard-image-tile standard-image-add"
          on:click={() =>
            (mediaNotice = "Adding images is not implemented yet.")}
          aria-label="Add image"
          title="Add image"><span aria-hidden="true">+</span></button
        >
        {#each standardImages as resource (resource.path)}
          <div
            class="standard-image-tile"
            aria-label={resource.path.split("/").at(-1)}
          >
            <div class="standard-image-preview">
              <img src={resource.data} alt={resource.path.split("/").at(-1)} />
            </div>
            <span>{resource.path.split("/").at(-1)}</span>
          </div>
        {/each}
      </div>
      <div class="dialog-actions">
        <button on:click={() => (imageLibraryOpen = false)}>Close</button>
      </div>
    </div>
  </div>{/if}
{#if mediaNotice}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog settings-dialog media-notice-dialog"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="media-notice-title"
      use:containClicks
    >
      <h3 id="media-notice-title">Not implemented</h3>
      <p>{mediaNotice}</p>
      <div class="dialog-actions">
        <button on:click={() => (mediaNotice = "")}>OK</button>
      </div>
    </div>
  </div>{/if}
