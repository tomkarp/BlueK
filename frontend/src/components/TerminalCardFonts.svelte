<svelte:options runes={true} />

<script lang="ts">
  import license from "../assets/card-fonts/OFL.txt?raw";
  import englishFont from "../assets/card-fonts/BlueKCardsEnglish.woff2?inline";
  import germanFont from "../assets/card-fonts/BlueKCardsGerman.woff2?inline";

  // Script asset imports are resolved for both extracted hosted CSS and
  // the single-file builds, whose Svelte styles are injected at runtime.
  const fontFaces = `
    @font-face {
      font-family: "BlueK Cards English";
      src: url("${englishFont}") format("woff2");
      font-display: swap;
      unicode-range: U+1F0A0-1F0FF;
    }
    @font-face {
      font-family: "BlueK Cards German";
      src: url("${germanFont}") format("woff2");
      font-display: swap;
      unicode-range: U+1F0A0-1F0FF;
    }
  `;
</script>

<!-- Keep attribution and the full license in hosted, offline and exported HTML. -->
<svelte:head>
  <meta name="bluek-card-font-license" content={license} />
  <svelte:element this={"style"}>{fontFaces}</svelte:element>
</svelte:head>

<style>
  :global(.terminal-output pre),
  :global(.player-terminal pre) {
    --terminal-card-font: "BlueK Cards English", monospace;
  }
  :global(.terminal-output pre:lang(de)),
  :global(.player-terminal pre:lang(de)) {
    --terminal-card-font: "BlueK Cards German", monospace;
  }
</style>
