<script lang="ts">
  import { focusOnMount, containClicks } from "../uiActions";

  import type { NewClassType } from "../uiTypes";
  export let newClassOpen: boolean;
  export let newClassName: string;
  export let newClassType: NewClassType;
  export let error: string;
  export let confirmNewClass: () => void;
</script>

{#if newClassOpen}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog new-class-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="new-class-title"
      use:containClicks
    >
      <h3 id="new-class-title">Create New Kotlin File</h3>
      <label
        >Name<input
          bind:value={newClassName}
          use:focusOnMount
          placeholder="e.g. Animal"
          on:keydown={(event) => event.key === "Enter" && confirmNewClass()}
        /></label
      >
      <fieldset>
        <legend>Type</legend
        >{#each [["class", "Class"], ["interface", "Interface"], ["open", "Open Class"], ["abstract", "Abstract Class"], ["data", "Data Class"], ["functions", "Kotlin Functions"]] as option}<label
            class="new-class-option"
            ><input
              type="radio"
              name="svelte-new-class-type"
              value={option[0]}
              bind:group={newClassType}
            /><span>{option[1]}</span></label
          >{/each}
      </fieldset>
      {#if error}<div class="dialog-error" role="alert">
          {error}
        </div>{/if}
      <div class="dialog-actions">
        <button on:click={() => (newClassOpen = false)}>Cancel</button><button
          on:click={confirmNewClass}>Create</button
        >
      </div>
    </div>
  </div>{/if}
