<script lang="ts">
  const { text }: { text: string } = $props();
  // Unicode presentation only: leave ordinary text and transcript contents intact.
  const chunks = $derived(text.split(/([\u{1F0A0}-\u{1F0FF}]+)/u));
</script>

{#each chunks as chunk, index (index)}{#if index % 2 === 1}<span
      class="terminal-card">{chunk}</span
    >{:else}{chunk}{/if}{/each}

<style>
  .terminal-card {
    font-family: var(--terminal-card-font, monospace);
  }
</style>
