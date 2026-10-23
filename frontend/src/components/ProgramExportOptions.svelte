<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  export let programShowProjectName: boolean;
  export let programAllowDownload: boolean;
  export let programAllowBlueK: boolean;
  export let programAutoRun: boolean;
  export let programShowControls: boolean;
  export let programShowSpeed: boolean;
  export let bluePlay: boolean;
</script>

<div class="program-export-options">
  <div
    class="program-shared-options"
    role="group"
    aria-labelledby="program-options-label"
  >
    <span id="program-options-label"
      >{t("ui.transfer.sharedProgramOptions")}</span
    >
    <label class="share-link-option"
      ><input type="checkbox" bind:checked={programShowProjectName} /><span
        >{t("ui.transfer.showProjectName")}</span
      ></label
    >
    <label class="share-link-option"
      ><input type="checkbox" bind:checked={programAllowDownload} /><span
        >{t("ui.transfer.allowSourceDownload")}</span
      ></label
    >
    <label class="share-link-option"
      ><input type="checkbox" bind:checked={programAllowBlueK} /><span
        >{t("ui.transfer.includeDeveloperLink")}</span
      ></label
    >
  </div>
  {#if bluePlay}
    <fieldset class="program-blueplay-options">
      <legend>{t("ui.transfer.bluePlayOptions")}</legend>
      <label class="share-link-option"
        ><input type="checkbox" bind:checked={programAutoRun} /><span
          >{t("ui.transfer.autoRunGame")}</span
        ></label
      >
      <label class="share-link-option"
        ><input
          type="checkbox"
          bind:checked={programShowControls}
          disabled={!programAutoRun}
        /><span>{t("ui.transfer.showGameButtons")}</span></label
      >
      <label class="share-link-option"
        ><input type="checkbox" bind:checked={programShowSpeed} /><span
          >{t("ui.transfer.showGameSpeed")}</span
        ></label
      >
      {#if !programAutoRun}<p>
          {t("ui.transfer.runButtonRequired")}
        </p>{/if}
    </fieldset>
  {/if}
  <p class="program-source-note">
    {t("ui.transfer.programSourceNote")}
  </p>
</div>
