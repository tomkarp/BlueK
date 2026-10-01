import { tick } from "svelte";

import { beginWindowDrag, beginWindowResize } from "../windowInteraction";

import { appendTerminal } from "../uiParity";

import type { WorkspaceUi } from "./WorkspaceUi.svelte";
import type { ExecutionWorkspace } from "./ExecutionWorkspace.svelte";
interface TerminalWorkspaceHost {
  ui: () => Pick<WorkspaceUi, "activeWindow">;
  session: () => Readonly<Pick<ExecutionWorkspace, "inputReady">> & {
    readonly client: Pick<
      ExecutionWorkspace["client"],
      "sendInput" | "sendEof"
    >;
  };
}

export class TerminalWorkspace {
  constructor(private readonly host: TerminalWorkspaceHost) {}
  terminal = $state("");
  terminalOpen = $state(false);
  terminalMaximized = $state(false);
  terminalSplit = $state(false);
  terminalSplitWidth = $state(430);
  terminalPosition: { left: number; top: number } | null = $state(null);
  terminalSize = $state({ width: 780, height: 520 });
  inputElement = $state<HTMLInputElement | null>(null);
  renderTerminal = () => {
    tick().then(() => {
      const output = document.querySelector(".terminal-output pre");
      if (output) output.scrollTop = output.scrollHeight;
    });
  };
  focusTerminalWindow = () => {
    this.terminalOpen = true;
    this.host.ui().activeWindow = "terminal";
  };
  clearTerminal = () => {
    this.terminal = "";
    this.renderTerminal();
  };
  toggleTerminalMaximized = () => {
    if (this.terminalSplit) {
      this.terminalSplit = false;
      this.terminalMaximized = true;
    } else this.terminalMaximized = !this.terminalMaximized;
  };
  toggleTerminalSplit = () => {
    this.terminalSplit = !this.terminalSplit;
    this.terminalMaximized = false;
    this.terminalPosition = null;
  };
  beginTerminalDrag = (event: PointerEvent) => {
    if (!this.terminalMaximized && !this.terminalSplit)
      beginWindowDrag(event, ".terminal-window", (position) => {
        this.terminalPosition = position;
      });
  };
  beginTerminalResize = (event: PointerEvent, direction: string) => {
    if (!this.terminalMaximized && !this.terminalSplit)
      beginWindowResize(event, ".terminal-window", direction, (frame) => {
        this.terminalPosition = frame.position;
        this.terminalSize = frame.size;
      });
  };
  beginTerminalSplitResize = (event: PointerEvent) => {
    if (!this.terminalSplit || event.button !== 0) return;
    const startX = event.clientX,
      startWidth = this.terminalSplitWidth;
    const move = (next: PointerEvent) => {
      this.terminalSplitWidth = Math.max(
        320,
        Math.min(
          Math.max(320, window.innerWidth - 520),
          startWidth - (next.clientX - startX),
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
  sendInput = async (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !this.host.session().inputReady) return;
    if (!this.inputElement) return;
    const value = this.inputElement.value;
    this.inputElement.value = "";
    this.terminal += `\u0001${value}\u0002\n`;
    await this.host.session().client.sendInput(value);
  };
  sendEof = async () => {
    if (!this.host.session().inputReady) return;
    await this.host.session().client.sendEof();
  };
  appendOutput = (output: string) => {
    this.focusTerminalWindow();
    this.terminal = appendTerminal(this.terminal, output);
    window.setTimeout(this.renderTerminal, 0);
  };
  connect = () => {
    $effect(() => {
      if (this.terminalOpen && this.host.session().inputReady)
        window.setTimeout(() => this.inputElement?.focus(), 0);
    });
  };
}
