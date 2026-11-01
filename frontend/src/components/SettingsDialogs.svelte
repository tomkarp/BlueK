<script lang="ts">
  import { languages, type Locale, useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import TranslatedText from "./TranslatedText.svelte";
  import UserHelpDialog from "./UserHelpDialog.svelte";
  import { containClicks } from "../uiActions";
  import type {
    TerminalClearSettings,
    TerminalClearTrigger,
  } from "../workspace/WorkspaceUi.svelte";

  interface Props {
    settingsNotice: boolean;
    shortcutsHelpOpen: boolean;
    darkMode: boolean;
    setDarkMode: (enabled: boolean) => void;
    editorFontSize: number;
    setEditorFontSize: (size: number) => void;
    terminalFontSize: number;
    setTerminalFontSize: (size: number) => void;
    vimMode: boolean;
    setVimMode: (enabled: boolean) => void;
    vimShortcutLabel: string;
    terminalAutoClear: TerminalClearSettings;
    setTerminalAutoClear: (
      trigger: TerminalClearTrigger,
      enabled: boolean,
    ) => void;
    compileShortcutLabel: string;
    runShortcutLabel: string;
    saveShortcutLabel: string;
    terminalShortcutLabel: string;
    formatShortcutLabel: string;
    commentShortcutLabel: string;
    editorNextShortcutLabel: string;
    editorPrevShortcutLabel: string;
    openFeedback: () => void;
  }

  let {
    settingsNotice = $bindable(),
    shortcutsHelpOpen = $bindable(),
    darkMode,
    setDarkMode,
    editorFontSize,
    setEditorFontSize,
    terminalFontSize,
    setTerminalFontSize,
    vimMode,
    setVimMode,
    vimShortcutLabel,
    terminalAutoClear,
    setTerminalAutoClear,
    compileShortcutLabel,
    runShortcutLabel,
    saveShortcutLabel,
    terminalShortcutLabel,
    formatShortcutLabel,
    commentShortcutLabel,
    editorNextShortcutLabel,
    editorPrevShortcutLabel,
    openFeedback,
  }: Props = $props();
  const terminalTriggers: TerminalClearTrigger[] = [
    "interactive",
    "codepad",
    "main",
  ];
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
            onchange={(event) =>
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
            checked={darkMode}
            onchange={(event) => setDarkMode(event.currentTarget.checked)}
          />
        </label>
      </section>
      <section class="settings-section" aria-labelledby="settings-editor-title">
        <h4 id="settings-editor-title">{t("ui.settings.editor")}</h4>
        <label class="settings-field">
          <span>{t("ui.settings.fontSize")}</span>
          <select
            aria-label={t("ui.settings.fontSize")}
            value={editorFontSize}
            onchange={(event) =>
              setEditorFontSize(Number(event.currentTarget.value))}
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
            onchange={(event) => setVimMode(event.currentTarget.checked)}
          />
        </label>
      </section>
      <section
        class="settings-section"
        aria-labelledby="settings-terminal-title"
      >
        <h4 id="settings-terminal-title">{t("ui.settings.terminal")}</h4>
        <label class="settings-field">
          <span>{t("ui.settings.terminalFontSize")}</span>
          <select
            aria-label={t("ui.settings.terminalFontSize")}
            value={terminalFontSize}
            onchange={(event) =>
              setTerminalFontSize(Number(event.currentTarget.value))}
          >
            {#each Array.from({ length: 21 }, (_, index) => index + 10) as size}
              <option value={size}>{size}px</option>
            {/each}
          </select>
        </label>
        <fieldset class="settings-option-group">
          <legend>{t("ui.settings.clearTerminalBefore")}</legend>
          <div class="settings-options-row">
            {#each terminalTriggers as trigger}
              <label class="settings-field settings-toggle">
                <input
                  type="checkbox"
                  checked={terminalAutoClear[trigger]}
                  onchange={(event) =>
                    setTerminalAutoClear(trigger, event.currentTarget.checked)}
                />
                <span
                  >{t(
                    trigger === "interactive"
                      ? "ui.settings.interactiveCalls"
                      : trigger === "codepad"
                        ? "ui.settings.codepadExecutions"
                        : "ui.settings.mainStarts",
                  )}</span
                >
              </label>
            {/each}
          </div>
          <p class="settings-hint settings-terminal-tip">
            <TranslatedText message="ui.settings.clearTerminalFromCode" />
          </p>
        </fieldset>
      </section>
      <div class="dialog-actions">
        <button onclick={() => (settingsNotice = false)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
{#if shortcutsHelpOpen}
  <UserHelpDialog close={() => (shortcutsHelpOpen = false)} {openFeedback}>
    {#snippet shortcuts()}
      <ul class="shortcuts-help-list">
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
    {/snippet}
  </UserHelpDialog>
{/if}
