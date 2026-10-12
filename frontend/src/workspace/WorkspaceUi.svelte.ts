import type { ActiveWindow } from "../uiTypes";

export type TerminalClearTrigger = "interactive" | "codepad" | "main";
export type TerminalClearSettings = Record<TerminalClearTrigger, boolean>;
const terminalSettingsKey = "bluek-terminal-auto-clear";
const uiSettingsKey = "bluek-ui-settings";

export class WorkspaceUi {
  dialogError = $state("");
  selectedObjectId = $state("");
  viewportWidth = $state(1280);
  activeWindow: ActiveWindow = $state(null);
  status = $state("Ready");
  error = $state("");
  paneSplit = $state(66);
  benchWidth: number | null = $state(null);
  settingsNotice = $state(false);
  editorFontSize = $state(16);
  terminalFontSize = $state(14);
  vimMode = $state(false);
  darkMode = $state(false);
  terminalAutoClear: TerminalClearSettings = $state({
    interactive: false,
    codepad: false,
    main: false,
  });
  restoreTerminalSettings = () => {
    try {
      const saved: unknown = JSON.parse(
        window.localStorage.getItem(terminalSettingsKey) || "null",
      );
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
      const values = saved as Record<string, unknown>;
      this.terminalAutoClear = {
        interactive: values.interactive === true,
        codepad: values.codepad === true,
        main: values.main === true,
      };
    } catch {
      // Blocked or invalid storage leaves the default settings available.
    }
  };
  setTerminalAutoClear = (trigger: TerminalClearTrigger, enabled: boolean) => {
    this.terminalAutoClear = { ...this.terminalAutoClear, [trigger]: enabled };
    try {
      window.localStorage.setItem(
        terminalSettingsKey,
        JSON.stringify(this.terminalAutoClear),
      );
    } catch {
      // Settings still work for this page when persistence is unavailable.
    }
  };
  restoreUiSettings = () => {
    try {
      const saved: unknown = JSON.parse(
        window.localStorage.getItem(uiSettingsKey) || "null",
      );
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
      const values = saved as Record<string, unknown>;
      this.darkMode = values.darkMode === true;
      this.vimMode = values.vimMode === true;
      this.editorFontSize =
        typeof values.editorFontSize === "number" &&
        Number.isInteger(values.editorFontSize) &&
        values.editorFontSize >= 10 &&
        values.editorFontSize <= 30
          ? values.editorFontSize
          : 16;
      this.terminalFontSize =
        typeof values.terminalFontSize === "number" &&
        Number.isInteger(values.terminalFontSize) &&
        values.terminalFontSize >= 10 &&
        values.terminalFontSize <= 30
          ? values.terminalFontSize
          : 14;
    } catch {
      // Blocked or invalid storage leaves the default settings available.
    }
  };
  private saveUiSettings = () => {
    try {
      window.localStorage.setItem(
        uiSettingsKey,
        JSON.stringify({
          darkMode: this.darkMode,
          vimMode: this.vimMode,
          editorFontSize: this.editorFontSize,
          terminalFontSize: this.terminalFontSize,
        }),
      );
    } catch {
      // Settings still work for this page when persistence is unavailable.
    }
  };
  setDarkMode = (enabled: boolean) => {
    this.darkMode = enabled;
    this.saveUiSettings();
  };
  setEditorFontSize = (size: number) => {
    if (!Number.isInteger(size) || size < 10 || size > 30) return;
    this.editorFontSize = size;
    this.saveUiSettings();
  };
  setTerminalFontSize = (size: number) => {
    if (!Number.isInteger(size) || size < 10 || size > 30) return;
    this.terminalFontSize = size;
    this.saveUiSettings();
  };
  shortcutsHelpOpen = $state(false);
  offlineDownloadOpen = $state(false);
  formatShortcutLabel = $state("Ctrl+I");
  commentShortcutLabel = $state("Ctrl+/");
  vimShortcutLabel = $state("Ctrl+Shift+V");
  compileShortcutLabel = $state("Ctrl+K");
  saveShortcutLabel = $state("Ctrl+S");
  terminalShortcutLabel = $state("Ctrl+#");
  runShortcutLabel = $state("Ctrl+Enter");
  editorNextShortcutLabel = $state("Ctrl+E");
  editorPrevShortcutLabel = $state("Ctrl+Shift+E");
  beginPaneResize = (event: PointerEvent) => {
    const start = event.clientY,
      initial = this.paneSplit;
    const move = (next: PointerEvent) => {
      this.paneSplit = Math.max(
        20,
        Math.min(
          82,
          initial +
            ((next.clientY - start) / Math.max(window.innerHeight, 1)) * 100,
        ),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  };
  beginBenchResize = (event: PointerEvent) => {
    const benchElement = document.querySelector<HTMLElement>(".lower .bench"),
      measuredWidth = benchElement?.getBoundingClientRect().width;
    const start = event.clientX,
      initial = this.benchWidth ?? measuredWidth ?? 260;
    const move = (next: PointerEvent) => {
      this.benchWidth = Math.max(
        120,
        Math.min(window.innerWidth * 0.65, initial + next.clientX - start),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  };
  setVimMode = (enabled: boolean) => {
    if (enabled === this.vimMode) return;
    this.vimMode = enabled;
    this.saveUiSettings();
    this.status = enabled ? "Vim mode on" : "Vim mode off";
  };
  initializeShortcuts = () => {
    const mod = /Mac/i.test(navigator.platform) ? "Cmd" : "Ctrl";
    this.formatShortcutLabel = mod + "+I";
    this.commentShortcutLabel = mod + "+/";
    this.vimShortcutLabel = mod + "+Shift+V";
    this.compileShortcutLabel = mod + "+K";
    this.saveShortcutLabel = mod + "+S";
    this.terminalShortcutLabel = mod + "+#";
    this.runShortcutLabel = mod + "+Enter";
    this.editorNextShortcutLabel = mod + "+E";
    this.editorPrevShortcutLabel = mod + "+Shift+E";
  };
}
