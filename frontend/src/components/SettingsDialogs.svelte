<script lang="ts">
  import { languages, type Locale, useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import UserHelpDialog from "./UserHelpDialog.svelte";
  import { containClicks } from "../uiActions";

  export let settingsNotice: boolean;
  export let shortcutsHelpOpen: boolean;
  export let darkMode: boolean;
  export let editorFontSize: number;
  export let vimMode: boolean;
  export let setVimMode: (enabled: boolean) => void;
  export let vimShortcutLabel: string;
  export let compileShortcutLabel: string;
  export let runShortcutLabel: string;
  export let saveShortcutLabel: string;
  export let terminalShortcutLabel: string;
  export let formatShortcutLabel: string;
  export let commentShortcutLabel: string;
  export let editorNextShortcutLabel: string;
  export let editorPrevShortcutLabel: string;
  export let openFeedback: () => void;
</script>

{#if settingsNotice}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog settings-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="svelte-settings-title"
      use:containClicks
    >
      <h3 id="svelte-settings-title">{t("ui.common.settings")}</h3>
      <section
        class="settings-section"
        aria-labelledby="settings-general-title"
      >
        <h4 id="settings-general-title">{t("ui.settings.general")}</h4>
        <label class="settings-field">
          <span>{t("ui.settings.language")}</span>
          <select
            aria-label={t("ui.settings.language")}
            value={$language.locale}
            on:change={(event) =>
              language.set(event.currentTarget.value as Locale)}
          >
            {#each languages as item}<option value={item.value}
                >{item.name}</option
              >{/each}
          </select>
        </label>
        <label class="settings-field settings-toggle">
          <span>{t("ui.settings.darkMode")}</span>
          <input
            type="checkbox"
            aria-label={t("ui.settings.darkMode")}
            bind:checked={darkMode}
          />
        </label>
      </section>
      <section class="settings-section" aria-labelledby="settings-editor-title">
        <h4 id="settings-editor-title">{t("ui.settings.editor")}</h4>
        <label class="settings-field">
          <span>{t("ui.settings.fontSize")}</span>
          <select
            aria-label={t("ui.settings.fontSize")}
            bind:value={editorFontSize}
          >
            {#each Array.from({ length: 21 }, (_, index) => index + 10) as size}
              <option value={size}>{size}px</option>
            {/each}
          </select>
        </label>
        <label class="settings-field settings-toggle">
          <span
            >{t("ui.settings.vimMode")}
            <span class="settings-inline-hint">({vimShortcutLabel})</span></span
          >
          <input
            type="checkbox"
            aria-label={t("ui.settings.vimMode")}
            checked={vimMode}
            on:change={(event) => setVimMode(event.currentTarget.checked)}
          />
        </label>
      </section>
      <div class="dialog-actions">
        <button on:click={() => (settingsNotice = false)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if shortcutsHelpOpen}
  <UserHelpDialog close={() => (shortcutsHelpOpen = false)} {openFeedback}>
    <ul slot="shortcuts" class="shortcuts-help-list">
      <li>
        <strong>{compileShortcutLabel}</strong><span
          >{t("ui.settings.compileTheProject")}</span
        >
      </li>
      <li>
        <strong>{runShortcutLabel}</strong><span
          >{t("ui.settings.runMain")}</span
        >
      </li>
      <li>
        <strong>{saveShortcutLabel}</strong><span
          >{t("ui.common.saveExport")}</span
        >
      </li>
      <li>
        <strong>{terminalShortcutLabel}</strong><span
          >{t("ui.settings.cycleTheTerminalClosedWindowSplit")}</span
        >
      </li>
      <li>
        <strong>{formatShortcutLabel}</strong><span
          >{t("ui.settings.formatTheCurrentKotlinFile")}</span
        >
      </li>
      <li>
        <strong>{commentShortcutLabel}</strong><span
          >{t("ui.settings.commentUncommentSelectedLines")}</span
        >
      </li>
      <li>
        <strong>{vimShortcutLabel}</strong><span
          >{t("ui.settings.switchVimModeOnOff")}</span
        >
      </li>
      <li>
        <strong>{editorNextShortcutLabel}</strong><span
          >{t("ui.settings.nextEditorWindow")}</span
        >
      </li>
      <li>
        <strong>{editorPrevShortcutLabel}</strong><span
          >{t("ui.settings.previousEditorWindow")}</span
        >
      </li>
      <li>
        <strong>Escape</strong><span
          >{t("ui.settings.closeTheTopmostDialogOrWindowInVim")}</span
        >
      </li>
    </ul>
  </UserHelpDialog>
{/if}
