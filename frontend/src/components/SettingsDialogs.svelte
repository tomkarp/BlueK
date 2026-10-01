<script lang="ts">
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
      <h3 id="svelte-settings-title">Settings</h3>
      <section
        class="settings-section"
        aria-labelledby="settings-general-title"
      >
        <h4 id="settings-general-title">General</h4>
        <label class="settings-field">
          <span>Language</span>
          <select aria-label="Language" value="en">
            <option value="en">English (only for now)</option>
          </select>
        </label>
        <label class="settings-field settings-toggle">
          <span>Dark mode</span>
          <input
            type="checkbox"
            aria-label="Dark mode"
            bind:checked={darkMode}
          />
        </label>
      </section>
      <section class="settings-section" aria-labelledby="settings-editor-title">
        <h4 id="settings-editor-title">Editor</h4>
        <label class="settings-field">
          <span>Font size</span>
          <select aria-label="Font size" bind:value={editorFontSize}>
            {#each Array.from({ length: 21 }, (_, index) => index + 10) as size}
              <option value={size}>{size}px</option>
            {/each}
          </select>
        </label>
        <label class="settings-field settings-toggle">
          <span
            >Vim mode <span class="settings-inline-hint"
              >({vimShortcutLabel})</span
            ></span
          >
          <input
            type="checkbox"
            aria-label="Vim mode"
            checked={vimMode}
            on:change={(event) => setVimMode(event.currentTarget.checked)}
          />
        </label>
      </section>
      <div class="dialog-actions">
        <button on:click={() => (settingsNotice = false)}>Close</button>
      </div>
    </div>
  </div>{/if}
{#if shortcutsHelpOpen}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog shortcuts-help-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="shortcuts-help-title"
      use:containClicks
    >
      <h3 id="shortcuts-help-title">Keyboard Shortcuts</h3>
      <ul class="shortcuts-help-list">
        <li>
          <strong>{compileShortcutLabel}</strong><span>Compile the project</span
          >
        </li>
        <li><strong>{runShortcutLabel}</strong><span>Run main</span></li>
        <li><strong>{saveShortcutLabel}</strong><span>Save / Export</span></li>
        <li>
          <strong>{terminalShortcutLabel}</strong><span
            >Cycle the terminal: closed / window / split</span
          >
        </li>
        <li>
          <strong>{formatShortcutLabel}</strong><span
            >Format the current Kotlin file</span
          >
        </li>
        <li>
          <strong>{commentShortcutLabel}</strong><span
            >Comment / uncomment selected lines</span
          >
        </li>
        <li>
          <strong>{vimShortcutLabel}</strong><span
            >Switch Vim mode on / off</span
          >
        </li>
        <li>
          <strong>{editorNextShortcutLabel}</strong><span
            >Next editor window</span
          >
        </li>
        <li>
          <strong>{editorPrevShortcutLabel}</strong><span
            >Previous editor window</span
          >
        </li>
        <li>
          <strong>Escape</strong><span
            >Close the topmost dialog or window (in Vim mode: Shift+Escape)</span
          >
        </li>
      </ul>
      <div class="dialog-actions">
        <button on:click={() => (shortcutsHelpOpen = false)}>Close</button>
      </div>
    </div>
  </div>{/if}
