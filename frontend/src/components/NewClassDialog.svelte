<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
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
      <h3 id="new-class-title">{t("ui.files.createNewKotlinFile")}</h3>
      <label
        >{t("ui.files.name")}<input
          bind:value={newClassName}
          use:focusOnMount
          placeholder={t("ui.files.eGAnimal")}
          on:keydown={(event) => event.key === "Enter" && confirmNewClass()}
        /></label
      >
      <fieldset>
        <legend>{t("ui.files.type")}</legend
        >{#each [["class", "Class"], ["interface", "Interface"], ["open", "Open Class"], ["abstract", "Abstract Class"], ["data", "Data Class"], ["test", "Test Class"], ["functions", "Kotlin Functions"]] as option}<label
            class="new-class-option"
            ><input
              type="radio"
              name="svelte-new-class-type"
              value={option[0]}
              bind:group={newClassType}
            /><span>{$language.message(option[1])}</span></label
          >{/each}
      </fieldset>
      {#if error}<div class="dialog-error" role="alert">
          {$language.message(error)}
        </div>{/if}
      <div class="dialog-actions">
        <button on:click={() => (newClassOpen = false)}
          >{t("ui.common.cancel")}</button
        ><button on:click={confirmNewClass}>{t("ui.common.create")}</button>
      </div>
    </div>
  </div>{/if}
