import type { HistoryEntry, MainAction } from "../uiTypes";
import { tick } from "svelte";

import { codepadResult, codepadError } from "../uiParity";
import { LocalRuntimeClient } from "../localRuntimeClient";
import { createLocalRuntimeWorker } from "../localRuntimeWorkerFactory";

import { mainFiles } from "../mainEntries";

import { prepareRuntimeResources } from "../imageAlpha";

import { compileProject, executeCodepad } from "../codepadFlow";
import { isCompileError } from "../compileDiagnostics";
import type { RuntimeSnapshot } from "../../../runtime-contract/src/index";

import type { BluePlayWorkspace } from "./BluePlayWorkspace.svelte";
import type { ObjectWorkspace } from "./ObjectWorkspace.svelte";
import type { WorkspaceUi } from "./WorkspaceUi.svelte";
import type { EditorWorkspace } from "./EditorWorkspace.svelte";
import type { ProjectWorkspace } from "./ProjectWorkspace.svelte";
import type { TerminalWorkspace } from "./TerminalWorkspace.svelte";
interface ExecutionWorkspaceHost {
  play: () => Pick<
    BluePlayWorkspace,
    "clearWorld" | "allowWorld" | "acceptFrame" | "beep"
  >;
  objects: () => Pick<
    ObjectWorkspace,
    | "closeCalls"
    | "resetInspectors"
    | "refreshComputedInspectors"
    | "synchronize"
  >;
  ui: () => Pick<WorkspaceUi, "status" | "error">;
  editor: () => Pick<EditorWorkspace, "markDiagnostics" | "clearDiagnostics">;
  project: () => Readonly<
    Pick<
      ProjectWorkspace,
      "files" | "library" | "runtimeResources" | "writeHtmlExport"
    >
  >;
  terminal: () => Pick<
    TerminalWorkspace,
    "clearTerminal" | "appendOutput" | "focusTerminalWindow"
  >;
}

export class ExecutionWorkspace {
  constructor(private readonly host: ExecutionWorkspaceHost) {}
  client: LocalRuntimeClient = new LocalRuntimeClient(createLocalRuntimeWorker);
  runtime: RuntimeSnapshot = $state.raw({
    generationId: "",
    revision: 0,
    phase: "uncompiled",
    classes: [],
    inspections: {},
    references: [],
    liveObjectIds: [],
    error: null,
    simulation: "inactive",
  });
  codepad = $state("");
  history: HistoryEntry[] = $state([]);
  codepadHistoryIndex = $state(-1);
  codepadOpen = $state(true);
  codepadMenu: { x: number; y: number; text?: string } | null = $state(null);
  compilerDialog = $state(false);
  /** The dialog reports an exception of a call, not a compile error (RT-82). */
  callException = $state(false);
  mainDialog: { action: MainAction; generationId: string } | null =
    $state(null);
  classes = $derived.by(() => {
    return this.runtime.classes || [];
  });
  canExecute = $derived.by(() => {
    return (
      this.runtime.phase === "ready" &&
      (this.runtime.simulation === "inactive" ||
        this.runtime.simulation === "paused")
    );
  });
  inputReady = $derived.by(() => {
    return this.runtime.phase === "waitingForInput";
  });
  programActive = $derived.by(() => {
    return (
      this.runtime.phase === "running" ||
      this.runtime.phase === "compiling" ||
      this.inputReady
    );
  });
  mainEntries = $derived.by(() => {
    return mainFiles(this.classes);
  });
  htmlExportBlocked = $derived.by(() => {
    return (
      this.runtime.phase !== "uncompiled" &&
      this.runtime.phase !== "compiling" &&
      !this.mainEntries.length
    );
  });
  markUncompiled = () => {
    this.client?.invalidate();
    this.host.play().clearWorld();
    this.host.objects().closeCalls();
    this.host.objects().resetInspectors();
    this.history = [];
    this.host.ui().status = "Uncompiled";
    this.host.ui().error = "";
  };
  compile = async (): Promise<boolean> => {
    if (!this.client || this.runtime.phase === "compiling") return false;
    this.host.ui().status = "Compiling…";
    this.host.ui().error = "";
    this.compilerDialog = false;
    this.host.editor().markDiagnostics([]);
    this.history = [];
    this.host.objects().resetInspectors();
    const result = await compileProject(
      this.client,
      this.host.project().files,
      Date.now(),
      this.host.project().library,
      await prepareRuntimeResources(this.host.project().runtimeResources),
    );
    if (!result.ok) {
      this.host.ui().status = "Compile error";
      this.host.ui().error =
        result.diagnostics
          .map(
            (item) =>
              `${item.fileName || ""}:${item.line}:${item.column}: ${item.message}`,
          )
          .join("\n") ||
        result.error ||
        "Compilation failed.";
      this.callException = false;
      this.compilerDialog = !this.host
        .editor()
        .markDiagnostics(result.diagnostics, true);
      return false;
    }
    // A warning (an accessor calling itself) opens its editor like an error would.
    this.host.editor().markDiagnostics(result.diagnostics, true);
    this.host.ui().status = "Compiled";
    return true;
  };
  runMain = async () => {
    await this.requestMain("start");
  };
  requestMain = async (action: MainAction) => {
    if (!this.canExecute || !this.mainEntries.length) return;
    if (this.mainDialog) return;
    if (this.mainEntries.length > 1) {
      this.mainDialog = { action, generationId: this.runtime.generationId };
      return;
    }
    await this.executeMain(
      this.mainEntries[0],
      action,
      this.runtime.generationId,
    );
  };
  chooseMain = async (fileName: string) => {
    const request = this.mainDialog;
    this.mainDialog = null;
    if (request?.action === "export")
      await this.host.project().writeHtmlExport(fileName, request.generationId);
    else if (request)
      await this.executeMain(fileName, request.action, request.generationId);
  };
  executeMain = async (
    fileName: string,
    action: MainAction,
    generationId: string,
  ) => {
    if (
      !this.canExecute ||
      generationId !== this.runtime.generationId ||
      !this.mainEntries.includes(fileName)
    )
      return;
    if (action === "reset") {
      await this.performReset(fileName);
      return;
    }
    this.host.play().allowWorld();
    this.host.ui().status = "Running…";
    try {
      const result = await this.client.execute({
        op: "main",
        fileName,
        generationId,
      });
      if (result.kind === "error")
        this.host.ui().error = result.display || "Execution failed.";
      else this.host.ui().status = "Ready";
      await this.host.objects().refreshComputedInspectors();
    } catch (reason) {
      if (this.runtime.phase !== "uncompiled") {
        this.host.ui().status = "Ready";
        this.host.ui().error =
          reason instanceof Error ? reason.message : String(reason);
      }
    }
  };
  executeCode = async (code = this.codepad.trim()) => {
    if (!this.client || !code) return;
    this.codepad = "";
    this.codepadHistoryIndex = -1;
    const result = await executeCodepad(
      this.client,
      this.host.project().files,
      Date.now(),
      code,
      this.host.project().library,
      await prepareRuntimeResources(this.host.project().runtimeResources),
    );
    if (result.kind === "compile-error") {
      this.host.ui().status = "Compile error";
      this.host.ui().error =
        result.compile.diagnostics
          .map(
            (item) =>
              `${item.fileName || ""}:${item.line}:${item.column}: ${item.message}`,
          )
          .join("\n") ||
        result.compile.error ||
        "Compilation failed.";
      this.callException = false;
      this.compilerDialog = !this.host
        .editor()
        .markDiagnostics(result.compile.diagnostics, true);
      return;
    }
    if (result.kind === "stale") return;
    if (result.kind === "error") {
      this.history = [...this.history, { code, error: result.error }];
    } else {
      const response = result.response;
      this.history = [
        ...this.history,
        response.kind === "error"
          ? { code, error: codepadError(response) }
          : response.kind === "object" || Boolean(response.objectId)
            ? {
                code,
                objectResult: true,
                result:
                  response.kind === "object"
                    ? undefined
                    : codepadResult(response),
                objectId: response.objectId,
                className:
                  response.className || response.type?.displayName || "Object",
              }
            : { code, result: codepadResult(response) },
      ];
    }
    await this.host.objects().refreshComputedInspectors();
    await tick();
    const historyElement = document.querySelector(".codepad-history");
    if (historyElement) historyElement.scrollTop = historyElement.scrollHeight;
    if (this.codepadOpen && !this.inputReady)
      document.querySelector<HTMLTextAreaElement>(".codepad textarea")?.focus();
  };
  submitCodepad = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" && this.history.length) {
      event.preventDefault();
      this.codepadHistoryIndex =
        this.codepadHistoryIndex < 0
          ? this.history.length - 1
          : Math.max(0, this.codepadHistoryIndex - 1);
      this.codepad = this.history[this.codepadHistoryIndex].code;
      return;
    }
    if (event.key === "ArrowDown" && this.history.length) {
      event.preventDefault();
      this.codepadHistoryIndex =
        this.codepadHistoryIndex < 0
          ? -1
          : Math.min(this.history.length, this.codepadHistoryIndex + 1);
      this.codepad =
        this.codepadHistoryIndex >= 0 &&
        this.codepadHistoryIndex < this.history.length
          ? this.history[this.codepadHistoryIndex].code
          : "";
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.executeCode();
    }
  };
  resetRuntime = async () => {
    if (this.host.project().library?.id === "blueplay") {
      await this.requestMain("reset");
      return;
    }
    await this.performReset();
  };
  performReset = async (fileName?: string) => {
    if (!this.client || this.runtime.phase === "compiling") return;
    this.host.terminal().clearTerminal();
    this.host.play().clearWorld();
    // Reset replaces the world, while the window keeps its presentation state.
    this.host.objects().resetInspectors();
    this.history = [];
    this.host.ui().error = "";
    this.host.ui().status = "Resetting…";
    try {
      const result = await this.client.reset(fileName);
      if ("kind" in result && result.kind === "error") {
        this.host.ui().status = "Reset failed";
        this.host.ui().error = result.display || "Reset failed.";
        return;
      }
      const diagnostics = result.diagnostics || [];
      if (diagnostics.some(isCompileError)) {
        this.host.ui().status = "Compile error";
        this.host.ui().error = diagnostics
          .map(
            (item) =>
              `${item.fileName || ""}:${item.line}:${item.column}: ${item.message}`,
          )
          .join("\n");
        this.callException = false;
        this.compilerDialog = !this.host
          .editor()
          .markDiagnostics(diagnostics, true);
      } else {
        this.host.editor().markDiagnostics(diagnostics);
        this.host.ui().status = "Compiled";
      }
    } catch (reason) {
      this.host.ui().status = "Reset failed";
      this.host.ui().error =
        reason instanceof Error ? reason.message : String(reason);
    }
  };
  connect = () => {
    $effect(() => {
      if (
        this.mainDialog &&
        (this.mainDialog.generationId !== this.runtime.generationId ||
          (this.mainDialog.action !== "export" && !this.canExecute))
      )
        this.mainDialog = null;
    });
    const unsubscribe = this.client.subscribe(() => {
      this.runtime = this.client.getSnapshot();
      this.host.objects().synchronize(this.runtime);
      if (
        this.runtime.phase === "waitingForInput" ||
        this.runtime.phase === "faulted"
      )
        this.host.terminal().focusTerminalWindow();
    });
    const output = this.client.onResponse((value) => {
      if (value.output) this.host.terminal().appendOutput(value.output);
      value.effects?.forEach((effect) => {
        if (effect.type === "sound" && effect.name === "beep")
          this.host.play().beep();
      });
    });
    const stage = this.client.stageStream(this.host.play().acceptFrame);
    return () => {
      unsubscribe();
      output();
      stage();
      this.client.invalidate();
    };
  };
  sourceEdited = () => {
    this.client.invalidate();
    this.host.editor().clearDiagnostics();
    this.host.objects().resetInspectors();
    this.history = [];
    this.host.ui().status = "Uncompiled";
    this.host.ui().error = "";
  };
  stopForProjectReplacement = async (): Promise<void> => {
    if (this.runtime.phase !== "uncompiled") await this.client.stop();
    this.host.play().clearWorld();
  };
  requestExport = (generationId: string) => {
    this.mainDialog = { action: "export", generationId };
  };
  reportCallError = (message: string, exception = false) => {
    this.host.ui().error = message;
    this.host.editor().markDiagnostics([]);
    this.callException = exception;
    this.compilerDialog = true;
  };
}
