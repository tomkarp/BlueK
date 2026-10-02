import { untrack } from "svelte";
import type { BluePlayStage } from "../../../runtime-contract/src/index";

import { beginWindowDrag } from "../windowInteraction";

import type { StageFrame } from "../bluePlayStage";

import {
  StageAudio,
  StageRenderer,
  decorateStage,
  measureImageSizes,
  stageKeyName,
} from "../bluePlayStage";

import type { ProjectResource } from "../../../runtime-contract/src/index";
type Resource = ProjectResource;

import type { ExecutionWorkspace } from "./ExecutionWorkspace.svelte";
import type { ProjectWorkspace } from "./ProjectWorkspace.svelte";
import type { WorkspaceUi } from "./WorkspaceUi.svelte";
interface BluePlayWorkspaceHost {
  session: () => Readonly<
    Pick<
      ExecutionWorkspace,
      "runtime" | "canExecute" | "resetRuntime" | "runMain"
    >
  > & {
    readonly client: Pick<
      ExecutionWorkspace["client"],
      "sendKey" | "sendClick" | "simulation"
    >;
  };
  project: () => Readonly<
    Pick<ProjectWorkspace, "library" | "runtimeResources">
  >;
  ui: () => Pick<WorkspaceUi, "error" | "status" | "viewportWidth">;
}

export class BluePlayWorkspace {
  constructor(private readonly host: BluePlayWorkspaceHost) {}
  stage: StageFrame | null = $state.raw(null);
  resourceSizes: Record<string, { width: number; height: number }> = $state({});
  stageCanvas: HTMLCanvasElement | null = $state(null);
  speed = $state(50);
  stageWindowOpen = $state(false);
  stageWindowDismissed = $state(false);
  stageMaximized = $state(false);
  stagePosition: { left: number; top: number } | null = $state(null);
  stageDrawPending = $state(false);
  stageAudio = new StageAudio();
  stageKeysDown = new Set<string>();
  stageRenderer = new StageRenderer(() => this.scheduleStageDraw());
  stageHeight = $derived.by(() => {
    return this.stage
      ? ((this.stageMaximized
          ? this.host.ui().viewportWidth * 0.9
          : Math.min(this.host.ui().viewportWidth * 0.4, 420)) *
          this.stage.height) /
          Math.max(this.stage.width, 1)
      : 0;
  });
  stageWindowWidth = $derived.by(() => {
    return this.stage
      ? Math.min(
          Math.max(320, this.host.ui().viewportWidth - 24),
          Math.max(
            600,
            (this.stage.width || 1) * (this.stage.cellSize || 1) + 4,
          ),
        )
      : 760;
  });
  stageRunning = $derived.by(() => {
    return (
      this.host.project().library?.id === "blueplay" &&
      (this.host.session().runtime.simulation === "running" ||
        this.host.session().runtime.simulation === "stopping" ||
        this.host.session().runtime.simulation === "waiting")
    );
  });
  scheduleStageDraw = () => {
    if (this.stageDrawPending) return;
    this.stageDrawPending = true;
    requestAnimationFrame(() => {
      this.stageDrawPending = false;
      this.drawStageCanvas();
    });
  };
  stageKey = (event: KeyboardEvent, pressed: boolean) => {
    const key = stageKeyName(event.key);
    event.preventDefault();
    if (this.stageKeysDown.has(key) === pressed) return;
    if (pressed) this.stageKeysDown.add(key);
    else this.stageKeysDown.delete(key);
    this.host
      .session()
      .client?.sendKey(key, pressed)
      .catch(() => undefined);
  };
  releaseStageKeys = () => {
    for (const key of this.stageKeysDown)
      this.host
        .session()
        .client?.sendKey(key, false)
        .catch(() => undefined);
    this.stageKeysDown.clear();
  };
  stageClick = (event: MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    target.focus();
    if (!this.stage) return;
    event.preventDefault();
    const { x, y, actorId } = this.stageRenderer.pointer(
      this.stage,
      target.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );
    this.host
      .session()
      .client?.sendClick(x, y, actorId)
      .catch(() => undefined);
  };
  bluePlayAction = (action: "step" | "start" | "stop" | "setSpeed") => {
    if (
      !this.host.session().client ||
      this.host.project().library?.id !== "blueplay" ||
      !this.stage ||
      this.host.session().runtime.phase === "faulted"
    )
      return;
    if (
      action === "step" &&
      (this.stageRunning || !this.host.session().canExecute)
    )
      return;
    if (action === "start" && this.stageRunning) return;
    if (action === "stop" && !this.stageRunning) return;
    if (
      action === "setSpeed" &&
      this.host.session().runtime.phase !== "ready" &&
      this.host.session().runtime.phase !== "waitingForInput"
    )
      return;
    if (action === "start") this.stageCanvas?.focus();
    if (this.host.project().library?.id === "blueplay") {
      this.host
        .session()
        .client.simulation(
          action,
          action === "setSpeed" ? Number(this.speed) : undefined,
        )
        .then((result) => {
          if (result.kind === "error") {
            this.host.ui().error = result.display || "BluePlay action failed.";
            this.host.ui().status = "BluePlay error";
          } else if (action === "start") this.host.ui().status = "Running…";
          else if (action === "stop") this.host.ui().status = "Paused";
          else if (action === "step") this.host.ui().status = "Ready";
        })
        .catch((reason) => {
          this.host.ui().error =
            reason instanceof Error ? reason.message : String(reason);
          this.host.ui().status = "BluePlay error";
        });
      return;
    }
  };
  resetGame = async () => {
    if (!this.host.session().canExecute) return;
    await this.host.session().resetRuntime();
    if (
      this.host.project().library?.id !== "blueplay" &&
      this.host.session().canExecute
    )
      await this.host.session().runMain();
  };
  beginStageDrag = (event: PointerEvent) => {
    if (!this.stageMaximized)
      beginWindowDrag(
        event,
        ".stage-window",
        (position) => {
          this.stagePosition = position;
        },
        "minimum",
      );
  };
  refreshResourceSizes = async (list: Resource[]) => {
    const next = await measureImageSizes(list);
    if (JSON.stringify(next) !== JSON.stringify(this.resourceSizes))
      this.resourceSizes = next;
  };
  drawStageCanvas = () => {
    if (!this.stageCanvas || !this.stage) return;
    this.stageRenderer.draw(
      this.stageCanvas,
      this.stage,
      this.host.project().runtimeResources,
      window.devicePixelRatio,
    );
  };
  acceptFrame = (value: BluePlayStage) => {
    this.stage = decorateStage(
      value,
      this.host.project().runtimeResources,
      this.resourceSizes,
    );
    // Repeated snapshots must not reopen a window dismissed by the user.
    if (!this.stageWindowDismissed) this.stageWindowOpen = true;
    this.speed = Number(value.speed) || this.speed;
    this.stageAudio.playFrameSounds(
      value,
      this.host.project().runtimeResources,
    );
  };
  connect = () => {
    $effect(() => {
      const resources = this.host.project().runtimeResources;
      if (resources.length)
        untrack(() => {
          void this.refreshResourceSizes(resources);
        });
      else this.resourceSizes = {};
    });
    // New frames are decorated on arrival; only measured sizes or new
    // resources require decorating the current frame again.
    $effect(() => {
      const resources = this.host.project().runtimeResources,
        sizes = this.resourceSizes;
      untrack(() => {
        const frame = this.stage;
        if (frame && Object.keys(sizes).length) {
          const refreshed = decorateStage(frame, resources, sizes);
          if (JSON.stringify(refreshed.objects) !== JSON.stringify(frame.objects))
            this.stage = refreshed;
        }
      });
    });
    $effect(() => {
      void this.stage;
      void this.stageCanvas;
      void this.host.project().runtimeResources;
      untrack(this.scheduleStageDraw);
    });
  };
  clearWorld = () => {
    this.stage = null;
    this.stageWindowOpen = false;
    this.stageWindowDismissed = false;
  };
  allowWorld = () => {
    this.stageWindowDismissed = false;
  };
  showWorld = () => {
    this.allowWorld();
    this.stageWindowOpen = true;
  };
  beep = () => {
    this.stageAudio.beep();
  };
}
