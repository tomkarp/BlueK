import type { EditorWindowState } from "../uiTypes";

import { beginWindowDrag, beginWindowResize } from "../windowInteraction";
import { createEditorActions } from "../editorActions";

import type { Diagnostic } from "../../../runtime-contract/src/index";

import type { ProjectWorkspace } from "./ProjectWorkspace.svelte";
import type { WorkspaceUi } from "./WorkspaceUi.svelte";
import type { ObjectWorkspace } from "./ObjectWorkspace.svelte";
import type { TerminalWorkspace } from "./TerminalWorkspace.svelte";
interface EditorWorkspaceHost {
  project: () => Readonly<
    Pick<ProjectWorkspace, "currentFile" | "files" | "selectFile">
  >;
  ui: () => Pick<WorkspaceUi, "activeWindow" | "dialogError">;
  objects: () => Pick<ObjectWorkspace, "dismissMenu">;
  terminal: () => Readonly<Pick<TerminalWorkspace, "terminalOpen">>;
}

export class EditorWorkspace {
  constructor(private readonly host: EditorWorkspaceHost) {}
  editorWindows: EditorWindowState[] = $state([]);
  activeEditorId = $state("");
  editorTabbed = $state(false);
  editorGroup: EditorWindowState | null = $state(null);
  editorFormatters = new Map<string, () => boolean>();
  editorCommenters = new Map<string, () => boolean>();
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
  openEditor = (file = this.host.project().currentFile) => {
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
    this.host.ui().activeWindow = "editor";
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
    if (frame) this.updateEditorFrame(id, { maximized: !frame.maximized });
    this.activeEditorId = id;
    this.host.ui().activeWindow = "editor";
  };
  closeEditor = (id = this.activeEditorId) => {
    this.editorWindows = this.editorWindows.filter((item) => item.id !== id);
    if (this.activeEditorId === id)
      this.activeEditorId = this.editorWindows.at(-1)?.id || "";
    if (this.editorTabbed && this.editorWindows.length === 1) {
      this.editorWindows = this.editorWindows.map((item) => ({
        ...item,
        maximized: this.editorGroup?.maximized || false,
        position: this.editorGroup?.position || item.position,
        size: this.editorGroup?.size || item.size,
      }));
      this.editorGroup = null;
      this.editorTabbed = false;
    }
    if (!this.editorWindows.length) {
      this.editorGroup = null;
      this.editorTabbed = false;
      if (this.host.ui().activeWindow === "editor")
        this.host.ui().activeWindow = this.host.terminal().terminalOpen
          ? "terminal"
          : null;
    }
  };
  closeAllEditors = () => {
    this.editorWindows = [];
    this.editorGroup = null;
    this.editorTabbed = false;
    this.activeEditorId = "";
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
    if (frame && !frame.maximized)
      beginWindowDrag(event, ".editor-dialog", (position) =>
        this.updateEditorFrame(id, { position }),
      );
  };
  beginEditorResize = (event: PointerEvent, id: string, direction: string) => {
    const frame = this.editorFrame(id);
    if (frame && !frame.maximized)
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
    setFormatError: (message) => {
      this.host.ui().dialogError = message;
    },
  }).codeMirror;
  hasWindows = $derived(this.editorWindows.length > 0);
  resetWindows = () => {
    this.editorWindows = [];
    this.activeEditorId = "";
    this.editorGroup = null;
    this.editorTabbed = false;
  };
  removeFile = (fileId: string) => {
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
    }
  };
  clearDiagnostics = () => {
    if (this.compilerDiagnostics.length) this.markDiagnostics([]);
  };
}
