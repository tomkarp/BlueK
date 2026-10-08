<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import { containClicks } from "../uiActions";

  import type { HistoryEntry, CodepadMenu } from "../uiTypes";
  export let codepadMenu: CodepadMenu | null;
  export let history: HistoryEntry[];

  function copyCodepadText(value: string) {
    navigator.clipboard?.writeText(value).catch(() => undefined);
    codepadMenu = null;
  }

  function selectAllCodepadHistory() {
    document.querySelectorAll(".codepad-entry").forEach((entry, index) => {
      const range = document.createRange();
      range.selectNodeContents(entry);
      const selection = window.getSelection();
      if (index === 0) selection?.removeAllRanges();
      selection?.addRange(range);
    });
    codepadMenu = null;
  }
</script>

{#if codepadMenu}<div
    class="codepad-context-menu"
    style={`left:${codepadMenu.x}px;top:${codepadMenu.y}px`}
    use:containClicks
  >
    <button
      on:click={() =>
        copyCodepadText(
          codepadMenu?.text || history.map((entry) => entry.code).join("\n"),
        )}>{t("ui.codepad.copy")}</button
    ><button
      on:click={() => {
        history = [];
        codepadMenu = null;
      }}>{t("ui.codepad.clearHistory")}</button
    ><button on:click={selectAllCodepadHistory}
      >{t("ui.codepad.selectAllHistory")}</button
    >
  </div>{/if}
