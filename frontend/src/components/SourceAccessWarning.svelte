<svelte:options runes={true} />

<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
</script>

<span class="program-source-note source-access-warning">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3 2.8 20h18.4L12 3Z" />
    <path d="M12 9v5m0 3h.01" />
  </svg>
  {t("ui.transfer.programSourceNote")}
</span>

<style>
  svg {
    display: inline-block;
    width: 16px;
    height: 16px;
    margin: 0 4px 0 6px;
    vertical-align: -3px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
