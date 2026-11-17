<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import SourceAccessWarning from "./SourceAccessWarning.svelte";
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
    <div class="program-source-options">
      <div class="program-source-download-option">
        <label class="share-link-option"
          ><input type="checkbox" bind:checked={programAllowDownload} /><span
            >{t("ui.transfer.allowSourceDownload")}</span
          ></label
        >
        {#if forLinks}<SourceAccessWarning />{/if}
      </div>
      <div class="program-source-controls">
        <label class="share-link-option"
          ><input type="checkbox" bind:checked={programAllowBlueK} /><span
            >{t("ui.transfer.includeDeveloperLink")}</span
          ></label
        >
      </div>
    </div>
  </div>
  {#if bluePlay}
    <fieldset class="program-blueplay-options">
      <legend>{t("ui.transfer.bluePlayOptions")}</legend>
      <div class="program-blueplay-controls">
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
      </div>
    </fieldset>
  {/if}
</div>
