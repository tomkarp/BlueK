import type { ActiveWindow } from "../uiTypes";

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
  vimMode = $state(false);
  darkMode = $state(false);
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
