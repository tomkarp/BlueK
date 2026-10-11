<script lang="ts">
  import type { Language } from "./i18n/Language.svelte";
  export let language: Language;
  $: t = $language.t;

  /**
   * Shown instead of the player when a program cannot be loaded: an expired
   * short link, a project code opened as a program or a damaged link/file.
   */
  export let message: string;
  export let expired = false;
  /** Editable project behind a project code opened under /run/. */
  export let projectUrl: string | undefined = undefined;
  /** BlueK start page for hosted links. */
  export let homeUrl: string | undefined = undefined;
</script>

<main class="player">
  <section class="player-problem" role="alert" aria-label={t("ui.player.error")}>
    <strong>{t("ui.player.cannotStart")}</strong>
    <p>{$language.message(message)}</p>
    {#if expired}<p>{t("ui.transfer.shortLinkExpired")}</p>{/if}
  </section>
  {#if projectUrl || homeUrl}<nav class="player-actions">
      {#if projectUrl}<a class="player-button" href={projectUrl}>{t("ui.player.openBlueK")}</a>
      {:else}<a class="player-button" href={homeUrl}>{t("ui.player.openBlueKHome")}</a>{/if}
    </nav>{/if}
</main>

<style>
  /* The same appearance as the player's own problem panel. */
  :global(*) { box-sizing: border-box; }
  :global(body) { margin: 0; background: #e5e6e7; color: #222; font: 14px Arial, sans-serif; }
  .player { max-width: 720px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .player-problem { border: 1px solid #d49a9a; border-radius: 8px; background: #fff3f3; color: #8a0000; padding: 10px 14px; }
  .player-problem p { margin: 6px 0 0; overflow-wrap: anywhere; }
  .player-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .player-button {
    padding: 6px 12px; border: 1px solid #999; border-radius: 5px; background: linear-gradient(#fff, #d9d9d9);
    color: #222; font: inherit; text-decoration: none;
  }
  .player-button:hover { background: linear-gradient(#fff, #cfcfcf); }
</style>
