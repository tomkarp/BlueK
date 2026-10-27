import type { EditorWindowState } from "../uiTypes";
import { tick } from "svelte";

import { beginWindowDrag, beginWindowResize } from "../windowInteraction";
import { createEditorActions } from "../editorActions";

import type { Diagnostic } from "../../../runtime-contract/src/index";

import type { ProjectWorkspace } from "./ProjectWorkspace.svelte";
import type { WorkspaceUi } from "./WorkspaceUi.svelte";
import type { ObjectWorkspace } from "./ObjectWorkspace.svelte";
import type { TerminalWorkspace } from "./TerminalWorkspace.svelte";
import type { ExecutionWorkspace } from "./ExecutionWorkspace.svelte";
interface EditorWorkspaceHost {
  project: () => Readonly<
    Pick<ProjectWorkspace, "currentFile" | "files" | "selectFile" | "resolvePendingClassRenames">
  >;
  ui: () => Pick<WorkspaceUi, "activeWindow" | "dialogError">;
  objects: () => Pick<ObjectWorkspace, "dismissMenu">;
  terminal: () => Readonly<Pick<TerminalWorkspace, "terminalOpen">>;
  session: () => Pick<ExecutionWorkspace, "setBreakpoint" | "runtime">;
}

interface EditorLayoutSnapshot {
  activeEditorId: string;
  editorTabbed: boolean;
  editorGroup: EditorWindowState | null;
  editorWindows: EditorWindowState[];
}

export class EditorWorkspace {
  constructor(private readonly host: EditorWorkspaceHost) {}
  editorWindows: EditorWindowState[] = $state([]);
  activeEditorId = $state("");
  editorTabbed = $state(false);
  editorGroup: EditorWindowState | null = $state(null);
  private workspaceMaxRestore: EditorLayoutSnapshot | null = null;
  editorFormatters = new Map<string, () => boolean>();
  editorCommenters = new Map<string, () => boolean>();
  breakpointTogglers = new Map<string, () => void>();
  debugNavigators = new Map<string, (line: number, column: number) => void>();
  breakpoints = $state.raw<{ fileId: string; line: number }[]>([]);
  diagnosticsRun = $state(0);
  compilerDiagnostics: Diagnostic[] = $state.raw([]);
  diagnosticsByFile = $derived.by(() => {
    return this.compilerDiagnostics.reduce<Record<string, Diagnostic[]>>(
      (map, item) => ({
        ...map,
        [item.fileName || ""]: [...(map[item.fileName || ""] || []), item],
      }),
      {},
    );
  });
  formatEditor = (id: string) => {
    this.editorFormatters.get(id)?.();
  };
  toggleEditorComments = (id: string) => {
    this.editorCommenters.get(id)?.();
  };
  revealPosition = async (
    fileName: string,
    line: number,
    column: number,
    preserveInspectorFocus = false,
  ) => {
    const file = this.host.project().files.find((item) => item.fileName === fileName);
    if (!file) return;
    this.openEditor(file, !preserveInspectorFocus);
    await tick();
    const editor = this.editorWindows.find((item) => item.fileId === file.id);
    if (editor) this.debugNavigators.get(editor.id)?.(line, column);
  };
  toggleBreakpoint = (id: string) => { this.breakpointTogglers.get(id)?.(); };
  toggleBreakpointAt = async (fileId: string, line: number) => {
    const file = this.host.project().files.find((item) => item.id === fileId);
    if (!file) return;
    const phase = this.host.session().runtime.phase;
    if (phase !== "uncompiled" && phase !== "ready" && phase !== "debugPaused") return;
    const existing = this.breakpoints.some((item) => item.fileId === fileId && item.line === line);
    this.breakpoints = existing
      ? this.breakpoints.filter((item) => item.fileId !== fileId || item.line !== line)
      : [...this.breakpoints, { fileId, line }];
    if (phase === "ready" || phase === "debugPaused") {
      const enabled = !existing;
      const accepted = await this.host.session().setBreakpoint(file.fileName, line, enabled);
      if (accepted) return;
      // The marker is optimistic while the worker validates it against Kotlite's
      // analyzed AST. Revert only if the user has not toggled this line again.
      const stillEnabled = this.breakpoints.some((item) => item.fileId === fileId && item.line === line);
      if (stillEnabled !== enabled) return;
      this.breakpoints = existing
        ? [...this.breakpoints, { fileId, line }]
        : this.breakpoints.filter((item) => item.fileId !== fileId || item.line !== line);
    }
  };
  updateBreakpoints = (fileId: string, lines: number[]) => {
    const file = this.host.project().files.find((item) => item.id === fileId);
    if (!file) return;
    const before = this.breakpoints.filter((item) => item.fileId === fileId).map((item) => item.line);
    const after = [...new Set(lines)].filter((line) => line > 0).sort((a, b) => a - b);
    if (before.join(",") === after.join(",")) return;
    this.breakpoints = [...this.breakpoints.filter((item) => item.fileId !== fileId), ...after.map((line) => ({ fileId, line }))];
  };
  linesFor = (fileId: string) => this.breakpoints.filter((item) => item.fileId === fileId).map((item) => item.line);
  syncBreakpoints = async () => {
    const retained: { fileId: string; line: number }[] = [];
    // Runtime commands share one worker channel. Register in order so each
    // acknowledgement returns the runtime to `ready` before the next command.
    for (const item of this.breakpoints) {
      const file = this.host.project().files.find((candidate) => candidate.id === item.fileId);
      if (file && await this.host.session().setBreakpoint(file.fileName, item.line, true)) retained.push(item);
    }
    this.breakpoints = retained;
  };
  openEditor = (file = this.host.project().currentFile, activate = true) => {
    if (!file) return;
    this.host.project().selectFile(file.id);
    const existing = this.editorWindows.find((item) => item.fileId === file.id);
    if (!existing) {
      const currentFrame =
        this.editorTabbed && this.editorGroup
          ? this.editorGroup
          : this.editorWindows.find((item) => item.id === this.activeEditorId);
      const next = {
        id: `editor-${file.id}`,
        fileId: file.id,
        maximized: currentFrame?.maximized || false,
        workspaceMaximized: currentFrame?.workspaceMaximized || false,
        position: currentFrame?.position ? { ...currentFrame.position } : null,
        size: currentFrame
          ? { ...currentFrame.size }
          : { width: 780, height: 520 },
      };
      this.editorWindows = [
        ...this.editorWindows,
        {
          ...next,
        },
      ];
      this.activeEditorId = next.id;
      if (this.editorWindows.length > 1 && !this.editorTabbed) {
        this.editorGroup = {
          ...next,
          ...(currentFrame
            ? {
                maximized: currentFrame.maximized,
                workspaceMaximized: currentFrame.workspaceMaximized,
                position: currentFrame.position
                  ? { ...currentFrame.position }
                  : null,
                size: { ...currentFrame.size },
              }
            : {}),
          id: "editor-group",
        };
        this.editorTabbed = true;
      }
    } else {
      this.activeEditorId = existing.id;
    }
    if (activate) this.host.ui().activeWindow = "editor";
    this.host.objects().dismissMenu();
  };
  collectEditors = () => {
    if (this.editorWindows.length < 2 || this.editorTabbed) return;
    const active =
      this.editorWindows.find((item) => item.id === this.activeEditorId) ||
      this.editorWindows[0];
    this.editorGroup = { ...active, id: "editor-group" };
    this.editorTabbed = true;
    this.activeEditorId = active.id;
    this.host.ui().activeWindow = "editor";
  };
  ungroupEditors = () => {
    if (this.workspaceMaxRestore) this.restoreEditorLayout();
    if (!this.editorTabbed || !this.editorGroup) return;
    const baseLeft =
      this.editorGroup.position?.left ??
      Math.max(8, (window.innerWidth - this.editorGroup.size.width) / 2);
    const baseTop =
      this.editorGroup.position?.top ??
      Math.max(8, (window.innerHeight - this.editorGroup.size.height) / 2);
    this.editorWindows = this.editorWindows.map((item, index) => ({
      ...item,
      maximized: false,
      workspaceMaximized: false,
      size: { ...this.editorGroup!.size },
      position: item.position || {
        left: Math.max(
          8,
          Math.min(window.innerWidth - 220, baseLeft + index * 32),
        ),
        top: Math.max(
          8,
          Math.min(window.innerHeight - 120, baseTop + index * 32),
        ),
      },
    }));
    this.editorGroup = null;
    this.editorTabbed = false;
  };
  selectEditorTab = (id: string) => {
    if (!this.editorWindows.some((item) => item.id === id)) return;
    this.activeEditorId = id;
    this.host.ui().activeWindow = "editor";
  };
  cycleEditor = (direction: 1 | -1) => {
    if (this.editorWindows.length < 2) return;
    const index = this.editorWindows.findIndex(
      (item) => item.id === this.activeEditorId,
    );
    const next =
      ((index < 0 ? 0 : index) + direction + this.editorWindows.length) %
      this.editorWindows.length;
    this.selectEditorTab(this.editorWindows[next].id);
  };
  toggleEditorMaximized = (id: string) => {
    const frame = this.editorFrame(id);
    if (frame?.maximized && this.workspaceMaxRestore) {
      this.restoreEditorLayout();
      this.host.ui().activeWindow = "editor";
      return;
    }
    if (frame)
      this.updateEditorFrame(id, {
        maximized: !frame.maximized,
        workspaceMaximized: false,
      });
    this.activeEditorId = id;
    this.host.ui().activeWindow = "editor";
  };
  toggleEditorWorkspaceMaximized = (id: string) => {
    const frame = this.editorFrame(id);
    const maximize = Boolean(frame && !frame.workspaceMaximized);
    if (maximize && !this.workspaceMaxRestore) {
      this.workspaceMaxRestore = {
        activeEditorId: this.activeEditorId,
        editorTabbed: this.editorTabbed,
        editorGroup: this.editorGroup
          ? {
              ...this.editorGroup,
              position: this.editorGroup.position
                ? { ...this.editorGroup.position }
                : null,
              size: { ...this.editorGroup.size },
            }
          : null,
        editorWindows: this.editorWindows.map((item) => ({
          ...item,
          position: item.position ? { ...item.position } : null,
          size: { ...item.size },
        })),
      };
    }
    if (frame)
      this.updateEditorFrame(id, {
        maximized: false,
        workspaceMaximized: maximize,
      });
    if (maximize && !this.editorTabbed && this.editorWindows.length > 1)
      this.collectEditors();
    if (!maximize && this.workspaceMaxRestore) {
      this.restoreEditorLayout();
    }
    if (maximize) this.activeEditorId = id;
    this.host.ui().activeWindow = "editor";
  };
  private restoreEditorLayout = () => {
    const snapshot = this.workspaceMaxRestore;
    if (!snapshot) return;
    const savedById = new Map(
      snapshot.editorWindows.map((item) => [item.id, item]),
    );
    const base =
      snapshot.editorGroup ||
      savedById.get(snapshot.activeEditorId) ||
      snapshot.editorWindows[0];
    const liveEditors = this.editorWindows;
    this.editorWindows = liveEditors.map((item, index) => {
      const saved = savedById.get(item.id);
      if (saved) {
        const frame = snapshot.editorTabbed && liveEditors.length === 1 && snapshot.editorGroup
          ? snapshot.editorGroup
          : saved;
        return {
          ...saved,
          maximized: frame.maximized,
          position: frame.position ? { ...frame.position } : null,
          size: { ...frame.size },
        };
      }
      const position = base?.position
        ? { left: base.position.left + index * 32, top: base.position.top + index * 32 }
        : null;
      return {
        ...item,
        maximized: base?.maximized || false,
        workspaceMaximized: false,
        position,
        size: base ? { ...base.size } : { ...item.size },
      };
    });
    this.editorTabbed = snapshot.editorTabbed && this.editorWindows.length > 1;
    this.editorGroup =
      this.editorTabbed && snapshot.editorGroup
        ? {
            ...snapshot.editorGroup,
            workspaceMaximized: false,
            position: snapshot.editorGroup.position
              ? { ...snapshot.editorGroup.position }
              : null,
            size: { ...snapshot.editorGroup.size },
          }
        : null;
    this.activeEditorId = this.editorWindows.some((item) => item.id === snapshot.activeEditorId)
      ? snapshot.activeEditorId
      : this.editorWindows.at(-1)?.id || "";
    this.workspaceMaxRestore = null;
  };
  closeEditor = (id = this.activeEditorId) => {
    void this.host.project().resolvePendingClassRenames();
    this.editorWindows = this.editorWindows.filter((item) => item.id !== id);
    if (this.activeEditorId === id)
      this.activeEditorId = this.editorWindows.at(-1)?.id || "";
    if (this.editorTabbed && this.editorWindows.length === 1) {
      this.editorWindows = this.editorWindows.map((item) => ({
        ...item,
        maximized: this.editorGroup?.maximized || false,
        workspaceMaximized: this.editorGroup?.workspaceMaximized || false,
        position: this.editorGroup?.position || item.position,
        size: this.editorGroup?.size || item.size,
      }));
      this.editorGroup = null;
      this.editorTabbed = false;
    }
    if (!this.editorWindows.length) {
      this.editorGroup = null;
      this.editorTabbed = false;
      this.workspaceMaxRestore = null;
      if (this.host.ui().activeWindow === "editor")
        this.host.ui().activeWindow = this.host.terminal().terminalOpen
          ? "terminal"
          : null;
    }
  };
  closeAllEditors = () => {
    void this.host.project().resolvePendingClassRenames();
    this.editorWindows = [];
    this.editorGroup = null;
    this.editorTabbed = false;
    this.activeEditorId = "";
    this.workspaceMaxRestore = null;
    if (this.host.ui().activeWindow === "editor")
      this.host.ui().activeWindow = this.host.terminal().terminalOpen
        ? "terminal"
        : null;
  };
  editorFrame = (id: string): EditorWindowState | null => {
    return this.editorTabbed
      ? this.editorGroup
      : this.editorWindows.find((item) => item.id === id) || null;
  };
  updateEditorFrame = (id: string, update: Partial<EditorWindowState>) => {
    if (this.editorTabbed && this.editorGroup)
      this.editorGroup = { ...this.editorGroup, ...update };
    else
      this.editorWindows = this.editorWindows.map((item) =>
        item.id === id ? { ...item, ...update } : item,
      );
  };
  beginEditorDrag = (event: PointerEvent, id: string) => {
    const frame = this.editorFrame(id);
    if (frame && !frame.maximized && !frame.workspaceMaximized)
      beginWindowDrag(event, ".editor-dialog", (position) =>
        this.updateEditorFrame(id, { position }),
      );
  };
  beginEditorResize = (event: PointerEvent, id: string, direction: string) => {
    const frame = this.editorFrame(id);
    if (frame && !frame.maximized && !frame.workspaceMaximized)
      beginWindowResize(event, ".editor-dialog", direction, (update) =>
        this.updateEditorFrame(id, update),
      );
  };
  markDiagnostics = (diagnostics: Diagnostic[], reveal = false): boolean => {
    this.compilerDiagnostics = diagnostics;
    this.diagnosticsRun += 1;
    const located = diagnostics.find((item) =>
      this.host.project().files.some((file) => file.fileName === item.fileName),
    );
    if (located && reveal)
      this.openEditor(
        this.host
          .project()
          .files.find((file) => file.fileName === located.fileName),
      );
    return Boolean(located);
  };
  closeFormatError = () => {
    this.host.ui().dialogError = "";
    this.diagnosticsRun += 1;
  };
  readonly codeMirror = createEditorActions({
    formatters: this.editorFormatters,
    commenters: this.editorCommenters,
    breakpointTogglers: this.breakpointTogglers,
    debugNavigators: this.debugNavigators,
    diagnosticsRun: () => this.diagnosticsRun,
    setFormatError: (message) => {
      this.host.ui().dialogError = message;
    },
  }).codeMirror;
  hasWindows = $derived(this.editorWindows.length > 0);
  resetWindows = () => {
    this.breakpoints = [];
    this.editorWindows = [];
    this.activeEditorId = "";
    this.editorGroup = null;
    this.editorTabbed = false;
    this.workspaceMaxRestore = null;
  };
  removeFile = (fileId: string) => {
    this.breakpoints = this.breakpoints.filter((item) => item.fileId !== fileId);
    this.editorWindows = this.editorWindows.filter(
      (item) => item.fileId !== fileId,
    );
    if (
      this.activeEditorId &&
      !this.editorWindows.some((item) => item.id === this.activeEditorId)
    )
      this.activeEditorId = this.editorWindows.at(-1)?.id || "";
    if (!this.editorWindows.length) {
      this.editorGroup = null;
      this.editorTabbed = false;
      this.workspaceMaxRestore = null;
    }
  };
  clearDiagnostics = () => {
    if (this.compilerDiagnostics.length) this.markDiagnostics([]);
  };
}
