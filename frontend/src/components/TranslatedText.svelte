<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { richText, type MessageKey } from "../i18n/catalog";
  const language = useLanguage();
  $: t = $language.t;
  export let message: MessageKey;
</script>

<span class="localized-text">{@html richText(t(message))}</span>
