<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  interface Props {
    programShowProjectName: boolean;
    programAllowDownload: boolean;
    programAllowBlueK: boolean;
    programAutoRun: boolean;
    programShowControls: boolean;
    programShowSpeed: boolean;
    bluePlay: boolean;
    forLinks?: boolean;
  }

  let {
    programShowProjectName = $bindable(),
    programAllowDownload = $bindable(),
    programAllowBlueK = $bindable(),
    programAutoRun = $bindable(),
    programShowControls = $bindable(),
    programShowSpeed = $bindable(),
    bluePlay,
    forLinks = false,
  }: Props = $props();
</script>

<div class="program-export-options">
  <div
    class="program-shared-options"
    role={forLinks ? "group" : undefined}
    aria-labelledby={forLinks ? "program-options-label" : undefined}
  >
    {#if forLinks}<span id="program-options-label"
        >{t("ui.transfer.sharedProgramOptions")}</span
      >{/if}
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
  {#if forLinks}<p class="program-source-note">
      {t("ui.transfer.programSourceNote")}
    </p>{/if}
</div>
