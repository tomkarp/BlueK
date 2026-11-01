<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { richText, type MessageKey } from "../i18n/catalog";
  const language = useLanguage();
  const t = language.t;
  interface Props {
    message: MessageKey;
  }

  let { message }: Props = $props();
</script>

<span class="localized-text">{@html richText(t(message))}</span>
